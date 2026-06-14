"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Module from "@/components/hud/module.jsx";
import {
  UserCard, AssistantCard, ToolCard, ResultCard, SystemCard, MetaCard,
} from "./event-renderers.jsx";
import ThinkingSpinner from "./thinking-spinner.jsx";
import AskUserQuestionCard from "./ask-user-question-card.jsx";

/**
 * Browser-side UI for a long-lived `claude` session on the host.
 *
 * Lifecycle:
 *   idle      — no claude process for this cwd. Start button visible.
 *   starting  — POST /start fired, waiting for sessionId.
 *   live      — process running, EventSource subscribed to /stream.
 *               Each prompt POSTs to /send; the response arrives via the
 *               already-open SSE connection. Tabs that reload while live
 *               rejoin via /sessions lookup and replay the transcript.
 *   stopping  — POST /stop fired, waiting for _meta:closed.
 *
 * Sessions survive tab close. Only an explicit Stop (or bridge shutdown)
 * ends a session — closing the tab just drops this subscriber from the
 * fan-out; the claude process keeps running and shows up in the sidebar.
 */

function reducer(state, action) {
  switch (action.type) {
    case "reset":
      return { ...initial };
    case "starting":
      return { ...state, items: [], status: "starting", error: null, result: null,
        spinnerActive: false, turnStartedAt: null, usage: null };
    case "live":
      return {
        ...state,
        sessionId: action.sessionId, pid: action.pid, startedAt: action.startedAt,
        status: "live", error: null,
      };
    case "stopping":
      return { ...state, status: "stopping" };
    case "stopped":
      return { ...state, status: "idle", sessionId: null, pid: null,
        spinnerActive: false, turnStartedAt: null };
    case "event": {
      const items = [...state.items];
      const evt = action.event;
      let spinnerActive = state.spinnerActive;
      let turnStartedAt = state.turnStartedAt;
      let usage = state.usage;

      if (evt.type === "_meta") {
        // Server-side keepalive heartbeats — never render.
        if (evt.kind === "ping") return state;
        if (evt.kind === "closed" || evt.kind === "already_closed") {
          items.push({ id: action.id, kind: "meta", meta: evt });
          return { ...state, items, status: "idle", sessionId: null, pid: null,
            spinnerActive: false, turnStartedAt: null };
        }
        items.push({ id: action.id, kind: "meta", meta: evt });
        return { ...state, items };
      }
      if (evt.type === "system") {
        // Skip hook noise; surface only init events.
        if (evt.subtype !== "init") return state;
        const claudeSessionId = evt.session_id || state.claudeSessionId;
        items.push({ id: action.id, kind: "system", payload: evt });
        return { ...state, items, claudeSessionId };
      }
      if (evt.type === "assistant") {
        const content = Array.isArray(evt.message?.content) ? evt.message.content : [];
        for (const block of content) {
          if (block?.type === "text" && block.text) {
            items.push({ id: action.id + ":t" + items.length, kind: "assistant", text: block.text });
          } else if (block?.type === "tool_use") {
            const isAsk = block.name === "AskUserQuestion";
            items.push({
              id: action.id + ":tool:" + block.id,
              kind: "tool",
              toolUseId: block.id,
              name: block.name,
              input: block.input,
              output: null,
              running: true,
              isError: false,
              // AskUserQuestion needs an in-browser picker; render its card
              // until the user submits (or the bridge replays a tool_result).
              interactive: isAsk,
              questions: isAsk ? (block.input?.questions || []) : null,
              submittingAnswer: false,
            });
          }
        }
        // Intentionally do NOT clear `spinnerActive` here. A turn can emit
        // multiple assistant chunks ("let me check" → tool_use → more text)
        // with non-trivial gaps between them. The spinner should stay
        // pinned at the bottom of the transcript until the final `result`
        // event arrives, so the user always knows claude is still working.
        if (evt.message?.usage) usage = evt.message.usage;
        return { ...state, items, lastActivityAt: new Date().toISOString(),
          spinnerActive, turnStartedAt, usage };
      }
      if (evt.type === "user") {
        const content = Array.isArray(evt.message?.content) ? evt.message.content : [];
        for (const block of content) {
          if (block?.type === "text" && block.text) {
            // Bridge-echoed human prompt: a new turn begins. Start the
            // gerund spinner ticking from this moment.
            items.push({ id: action.id + ":u" + items.length, kind: "user", text: block.text });
            spinnerActive = true;
            turnStartedAt = Date.now();
            usage = null;
          } else if (block?.type === "tool_result") {
            const idx = items.findIndex(
              (it) => it.kind === "tool" && it.toolUseId === block.tool_use_id
            );
            if (idx !== -1) {
              items[idx] = {
                ...items[idx],
                output: block.content,
                isError: !!block.is_error,
                running: false,
                // Resolved → no longer interactive (hides the picker; the
                // ⎿ summary shows the chosen answer instead).
                interactive: false,
                submittingAnswer: false,
              };
            } else {
              items.push({
                id: action.id, kind: "tool", toolUseId: block.tool_use_id,
                name: "(unknown)", input: null, output: block.content,
                isError: !!block.is_error, running: false,
              });
            }
            // Tool finished; claude is back to thinking until the next chunk.
            // (spinnerActive is already true from the user-submit; we just
            // keep it on through the tool round-trip.)
          }
        }
        return { ...state, items, lastActivityAt: new Date().toISOString(),
          spinnerActive, turnStartedAt, usage };
      }
      if (evt.type === "result") {
        items.push({ id: action.id + ":result", kind: "result", payload: evt });
        return { ...state, items, result: evt, lastActivityAt: new Date().toISOString(),
          spinnerActive: false, turnStartedAt: null, usage: evt.usage || usage };
      }
      // Unknown event — surface raw for debugging.
      items.push({ id: action.id, kind: "raw", raw: evt });
      return { ...state, items };
    }
    case "fail":
      return { ...state, status: "idle", error: action.error,
        spinnerActive: false, turnStartedAt: null };
    case "stream":
      return { ...state, stream: action.value };
    case "markSubmittingAnswer": {
      const items = state.items.map((it) =>
        it.kind === "tool" && it.toolUseId === action.toolUseId
          ? { ...it, submittingAnswer: action.submitting }
          : it
      );
      return { ...state, items };
    }
    default:
      return state;
  }
}

const initial = {
  items: [], sessionId: null, claudeSessionId: null, pid: null,
  startedAt: null, lastActivityAt: null,
  status: "idle", error: null, result: null,
  // Turn-in-flight bookkeeping powers the gerund spinner.
  spinnerActive: false, turnStartedAt: null, usage: null,
  // SSE connection bookkeeping.
  stream: "disconnected", // "connected" | "reconnecting" | "disconnected"
};

export default function PromptPanel({ cwd, projectSlug }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [text, setText] = useState("");
  const sseRef = useRef(null);
  const scrollRef = useRef(null);
  const counterRef = useRef(0);

  // === SSE subscribe helper with auto-reconnect ===
  // EventSource's built-in reconnect gives up after enough 4xx/5xx; long
  // sessions through dev-mode Next.js + the bridge proxy chain do
  // occasionally see the connection drop with no clean recovery. We wrap
  // the connect in an explicit retry-on-close loop with exponential
  // backoff, and broadcast the connection status so the user can SEE
  // whether their tab is actually attached.
  const reconnectRef = useRef({ timer: null, retries: 0, sessionId: null });

  const openStream = useCallback((sessionId) => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch { /* ignore */ }
      sseRef.current = null;
    }
    if (reconnectRef.current.timer) {
      clearTimeout(reconnectRef.current.timer);
      reconnectRef.current.timer = null;
    }
    reconnectRef.current.retries = 0;
    reconnectRef.current.sessionId = sessionId;

    function connect() {
      const url = `/api/claude/session/stream?sessionId=${encodeURIComponent(sessionId)}`;
      const src = new EventSource(url);
      sseRef.current = src;
      dispatch({ type: "stream", value: reconnectRef.current.retries > 0 ? "reconnecting" : "reconnecting" });

      src.onopen = () => {
        reconnectRef.current.retries = 0;
        dispatch({ type: "stream", value: "connected" });
      };

      src.onmessage = (e) => {
        let evt;
        try { evt = JSON.parse(e.data); } catch { return; }
        dispatch({ type: "event", id: `e${++counterRef.current}`, event: evt });
      };

      src.onerror = () => {
        // EventSource will set readyState=CLOSED on hard failures (HTTP errors,
        // some proxy disconnects). When that happens, we explicitly retry —
        // the browser's own auto-reconnect won't.
        if (src.readyState !== EventSource.CLOSED) {
          dispatch({ type: "stream", value: "reconnecting" });
          return;
        }
        try { src.close(); } catch { /* ignore */ }
        if (sseRef.current !== src) return; // panel moved on to a newer session
        if (reconnectRef.current.sessionId !== sessionId) return;
        reconnectRef.current.retries += 1;
        const r = reconnectRef.current.retries;
        if (r > 20) {
          dispatch({ type: "stream", value: "disconnected" });
          return;
        }
        const delay = Math.min(500 * Math.pow(1.6, r), 15000);
        dispatch({ type: "stream", value: "reconnecting" });
        reconnectRef.current.timer = setTimeout(() => {
          reconnectRef.current.timer = null;
          if (reconnectRef.current.sessionId === sessionId) connect();
        }, delay);
      };

      return src;
    }

    return connect();
  }, []);

  // === On mount: discover existing session for this cwd, reconnect if found ===
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/claude/sessions?cwd=${encodeURIComponent(cwd)}`);
        if (!res.ok) return;
        const { sessions } = await res.json();
        if (cancelled || !sessions || sessions.length === 0) return;
        const s = sessions[0];
        dispatch({ type: "live", sessionId: s.sessionId, pid: s.pid, startedAt: s.startedAt });
        openStream(s.sessionId);
      } catch { /* network errors → stay idle */ }
    })();
    return () => {
      cancelled = true;
      if (sseRef.current) { try { sseRef.current.close(); } catch { /* ignore */ } }
      sseRef.current = null;
      if (reconnectRef.current.timer) {
        clearTimeout(reconnectRef.current.timer);
        reconnectRef.current.timer = null;
      }
      reconnectRef.current.sessionId = null;
    };
  }, [cwd, openStream]);

  // === Resume hook: SessionsList dispatches `claude:resume-session` after
  // calling /session/start with a JSONL session_id; we drop the old SSE,
  // reset the transcript, and tail the freshly-spawned bridge session. ===
  useEffect(() => {
    function onResume(e) {
      const d = e.detail || {};
      if (!d.bridgeSessionId || d.cwd !== cwd) return; // belongs to a different panel/cwd
      if (sseRef.current) { try { sseRef.current.close(); } catch { /* ignore */ } }
      dispatch({ type: "reset" });
      dispatch({ type: "live", sessionId: d.bridgeSessionId, pid: d.pid, startedAt: d.startedAt });
      openStream(d.bridgeSessionId);
    }
    window.addEventListener("claude:resume-session", onResume);
    return () => window.removeEventListener("claude:resume-session", onResume);
  }, [cwd, openStream]);

  // === Auto-scroll ===
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.items.length]);

  // === Start ===
  const start = useCallback(async () => {
    dispatch({ type: "starting" });
    try {
      const res = await fetch("/api/claude/session/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionId) {
        dispatch({ type: "fail", error: data?.error || `http ${res.status}` });
        return;
      }
      dispatch({ type: "live", sessionId: data.sessionId, pid: data.pid, startedAt: data.startedAt });
      openStream(data.sessionId);
    } catch (err) {
      dispatch({ type: "fail", error: err?.message || String(err) });
    }
  }, [cwd, openStream]);

  // === Send ===
  const send = useCallback(async () => {
    const prompt = text.trim();
    if (!prompt || state.status !== "live" || !state.sessionId) return;

    // Self-heal: if our SSE has died, the response would otherwise never
    // reach us. Reopen now so claude's reply has a destination.
    if (state.stream !== "connected") openStream(state.sessionId);

    setText("");
    try {
      const res = await fetch("/api/claude/session/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, prompt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        dispatch({ type: "fail", error: data?.error || `http ${res.status}` });
      }
      // Response (assistant text, tool calls, result) arrives via the
      // already-open SSE connection — we don't read this body.
    } catch (err) {
      dispatch({ type: "fail", error: err?.message || String(err) });
    }
  }, [text, state.status, state.sessionId, state.stream, openStream]);

  // === Submit AskUserQuestion answer back to claude ===
  const submitToolResult = useCallback(async (toolUseId, formattedContent) => {
    if (!state.sessionId) return;
    dispatch({ type: "markSubmittingAnswer", toolUseId, submitting: true });
    try {
      const res = await fetch("/api/claude/session/tool-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, toolUseId, content: formattedContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        dispatch({ type: "fail", error: data?.error || `http ${res.status}` });
      }
      // The bridge broadcasts the user.tool_result; the reducer's user
      // branch will flip the tool item to non-interactive on receive.
    } catch (err) {
      dispatch({ type: "fail", error: err?.message || String(err) });
    } finally {
      dispatch({ type: "markSubmittingAnswer", toolUseId, submitting: false });
    }
  }, [state.sessionId]);

  // === Stop ===
  const stop = useCallback(async () => {
    if (!state.sessionId) return;
    dispatch({ type: "stopping" });
    try {
      await fetch("/api/claude/session/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      // The bridge will deliver _meta:closed via SSE; reducer transitions to idle.
    } catch { /* ignore — the closed event will still come */ }
  }, [state.sessionId]);

  const onKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }, [send]);

  const sidShort = state.sessionId ? state.sessionId.slice(0, 8) : null;
  const streamLabel =
    state.status !== "live" ? null :
    state.stream === "connected"    ? "stream ✓" :
    state.stream === "reconnecting" ? "stream ↻ reconnecting" :
                                       "stream ⊘ disconnected";
  const captionBits = [
    cwd ? `cwd ${cwd.split("/").slice(-3).join("/")}` : null,
    sidShort ? `session ${sidShort}` : null,
    state.pid ? `pid ${state.pid}` : null,
    state.status,
    streamLabel,
  ].filter(Boolean);

  const headerRight = (
    <div className="flex items-center gap-2">
      {state.status === "idle" && (
        <button
          type="button"
          onClick={start}
          className="h-7 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 transition-colors"
        >
          ▶ start session
        </button>
      )}
      {state.status === "starting" && (
        <span className="hud-mono text-[10px] uppercase tracking-[0.18em] text-warm">starting…</span>
      )}
      {(state.status === "live" || state.status === "stopping") && (
        <button
          type="button"
          onClick={stop}
          disabled={state.status === "stopping"}
          className="h-7 rounded-lg border border-hot/60 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-hot hover:bg-hot/10 disabled:opacity-40"
        >
          {state.status === "stopping" ? "stopping…" : "■ stop session"}
        </button>
      )}
    </div>
  );

  return (
    <Module title="CLAUDE SESSION" voice="signals" caption={captionBits.join(" · ")} right={headerRight}>
      <div className="flex flex-col gap-3">
        <div ref={scrollRef} className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {state.items.length === 0 && (
            <p className="hud-mono text-[10px] text-hud-ink-dim">
              {state.status === "idle"
                ? "// no active session — click start to spawn `claude` on the host in this cwd"
                : "// waiting for first event…"}
            </p>
          )}
          {state.items.map((it) => {
            if (it.kind === "user") return <UserCard key={it.id} text={it.text} />;
            if (it.kind === "assistant") return <AssistantCard key={it.id} text={it.text} />;
            if (it.kind === "tool") {
              const interactiveSlot = it.interactive && it.questions ? (
                <AskUserQuestionCard
                  questions={it.questions}
                  submitting={!!it.submittingAnswer}
                  onSubmit={(formatted) => submitToolResult(it.toolUseId, formatted)}
                />
              ) : null;
              return (
                <ToolCard key={it.id} name={it.name} input={it.input}
                  output={it.output} isError={it.isError} running={it.running}
                  interactiveSlot={interactiveSlot} />
              );
            }
            if (it.kind === "system") return <SystemCard key={it.id} payload={it.payload} />;
            if (it.kind === "meta") return <MetaCard key={it.id} meta={it.meta} />;
            if (it.kind === "result") return <ResultCard key={it.id} result={it.payload} />;
            if (it.kind === "raw") return (
              <pre key={it.id} className="hud-mono text-[10px] text-hud-ink-dim overflow-x-auto">
                {JSON.stringify(it.raw)}
              </pre>
            );
            return null;
          })}
          {state.spinnerActive && (
            <ThinkingSpinner startedAt={state.turnStartedAt} usage={state.usage} />
          )}
          {state.error && <p className="hud-mono text-[11px] text-hot">// {state.error}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t border-hud-ink-dim/20 pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={state.status === "live" ? "ask claude…" : "start a session to chat"}
            rows={3}
            disabled={state.status !== "live"}
            className="min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm hud-mono outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="hud-mono text-[10px] text-hud-ink-dim">
              {state.status === "live" ? "// cmd-enter to send" : `// session ${state.status}`}
            </span>
            <button
              type="button"
              onClick={send}
              disabled={state.status !== "live" || !text.trim()}
              className="h-8 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              send
            </button>
          </div>
        </div>
      </div>
    </Module>
  );
}
