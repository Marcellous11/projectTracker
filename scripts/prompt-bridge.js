#!/usr/bin/env node
/**
 * Claude prompt bridge daemon (Phase 14).
 *
 * Runs on the HOST. The Next.js container can't run `claude` (CLI not
 * installed, ~/.claude is mounted read-only), so when the browser submits
 * a prompt the container forwards it here over host.docker.internal.
 *
 * This is the WRITE counterpart to scripts/session-watcher.js's READ:
 *   - watcher: scans `ps` for live `claude` PIDs, writes data/live-sessions.json
 *   - bridge:  accepts {cwd, prompt}, spawns `claude -p ... --output-format stream-json`,
 *              streams the child's stdout (NDJSON) back to the caller.
 *
 * The spawned `claude` is a real Claude Code session — it writes the
 * usual ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl, so the watcher
 * picks it up automatically and the dashboard sidebar/pulse light up
 * for free.
 *
 * SECURITY: binds 127.0.0.1 only. Validates cwd against an allowlist
 * (BRIDGE_PROJECTS_ROOTS env, comma-separated; default Projects/Active).
 * No arbitrary shell — only `claude` with stream-json output.
 *
 * Two modes:
 *   - /spawn  — one-shot. Runs `claude -p <prompt>` and streams the answer.
 *   - /session/* — Phase 14c. Starts ONE long-lived `claude -p
 *     --input-format stream-json --output-format stream-json` per project
 *     and keeps stdin open across many user turns. The PID stays alive in
 *     `ps` so the existing session-watcher daemon picks it up and the
 *     dashboard sidebar shows pulsing green for the entire session.
 *     Stop = close stdin → claude exits cleanly. Sessions survive tab
 *     close; only explicit `/session/stop` (or bridge shutdown) ends them.
 *
 * No deps. Pure node:http + node:child_process + node:fs.
 */

import http from "node:http";
import { spawn } from "node:child_process";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(REPO_ROOT, "data", "prompt-bridge.json");
const TMP_FILE   = STATE_FILE + ".tmp";

const PORT      = Number(process.env.BRIDGE_PORT) || 4318;
const HOST      = "127.0.0.1";
const STATE_TICK_MS = 5000;
const CLAUDE_BIN = process.env.BRIDGE_CLAUDE_BIN || "claude";

// Allowlist of cwd roots. Browser→bridge `cwd` must resolve under one
// of these. Default covers the Projects tree this dashboard tracks.
const ALLOWED_ROOTS = (process.env.BRIDGE_PROJECTS_ROOTS ||
  path.join(os.homedir(), "Documents/Projects"))
  .split(",")
  .map((s) => path.resolve(s.trim()))
  .filter(Boolean);

/** spawnId → { child, startedAt, cwd, sessionId } — one-shot /spawn */
const active = new Map();

/**
 * sessionId → long-lived persistent session. We mint our OWN UUID at
 * spawn time so the API contract is well-defined immediately. Claude's
 * internal session_id (the JSONL filename) is captured opportunistically
 * once the first `system:init` event arrives — it appears after the
 * first user record is sent, not at spawn time, so we can't gate /start
 * on it without deadlocking.
 *
 *   {
 *     sessionId,              // our UUID (public)
 *     claudeSessionId,        // claude's, populated lazily
 *     cwd, pid, startedAt, lastActivityAt,
 *     child,                  // ChildProcess (stdin kept open)
 *     transcript,             // ring buffer of stream-json records
 *     subscribers,            // Set<res> — active NDJSON readers
 *     exited,                 // true once child closes
 *   }
 */
const sessions = new Map();
const MAX_TRANSCRIPT = 2000;

function jsonReply(res, code, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, {
    "content-type": "application/json",
    "content-length": buf.length,
  });
  res.end(buf);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

function isAllowed(cwd) {
  if (!cwd || typeof cwd !== "string") return false;
  const resolved = path.resolve(cwd);
  for (const root of ALLOWED_ROOTS) {
    if (resolved === root) return true;
    if (resolved.startsWith(root + path.sep)) return true;
  }
  return false;
}

/** Write one NDJSON record to the response. */
function writeNdjson(res, obj) {
  res.write(JSON.stringify(obj) + "\n");
}

/**
 * POST /spawn — body { cwd, prompt, sessionId? }.
 *
 * Response: chunked NDJSON. First line is our own `{type:"_meta", kind:"spawn", spawnId}`
 * sentinel so the container learns the spawnId for /interrupt. Subsequent lines
 * are passed through from `claude --output-format stream-json`. Final line is our
 * `{type:"_meta", kind:"exit", code, signal}` sentinel.
 */
async function handleSpawn(req, res) {
  const body = await readBody(req);
  if (!body) return jsonReply(res, 400, { error: "invalid json" });
  const { cwd, prompt, sessionId } = body;
  if (!cwd || !isAllowed(cwd)) {
    return jsonReply(res, 400, { error: "cwd not allowed", cwd, allowed: ALLOWED_ROOTS });
  }
  if (!existsSync(cwd)) return jsonReply(res, 400, { error: "cwd does not exist", cwd });
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return jsonReply(res, 400, { error: "prompt required" });
  }
  if (sessionId && !/^[a-f0-9-]{8,}$/i.test(sessionId)) {
    return jsonReply(res, 400, { error: "invalid sessionId" });
  }

  const spawnId = randomUUID();
  const args = ["--output-format", "stream-json", "--verbose"];
  if (sessionId) args.push("--resume", sessionId);
  args.push("-p", prompt);

  // Strip Anthropic auth env vars so claude falls back to the Max
  // subscription credentials in the keychain. Inheriting them would let an
  // `ANTHROPIC_API_KEY` exported in the user's shell win the precedence
  // race against the subscription and route browser prompts to API
  // billing — which is exactly how we hit "Credit balance is too low"
  // on first run. Keep the rest of the env (PATH, HOME, etc).
  const { ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ...cleanEnv } = process.env;

  let child;
  try {
    child = spawn(CLAUDE_BIN, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: cleanEnv,
    });
  } catch (e) {
    return jsonReply(res, 500, { error: "spawn failed", message: e?.message || String(e) });
  }

  active.set(spawnId, { child, startedAt: new Date().toISOString(), cwd, sessionId: sessionId || null });

  res.writeHead(200, {
    "content-type": "application/x-ndjson",
    "cache-control": "no-cache, no-transform",
    "x-spawn-id": spawnId,
  });
  writeNdjson(res, { type: "_meta", kind: "spawn", spawnId, pid: child.pid, cwd });

  // Line-buffer claude stdout so each JSON record arrives whole.
  let stdoutBuf = "";
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString("utf8");
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, idx);
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (line) res.write(line + "\n");
    }
  });

  // Surface stderr as meta lines so the browser can show "claude said: ..."
  // for genuine failures (missing auth, etc) without crashing the stream.
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) writeNdjson(res, { type: "_meta", kind: "stderr", text });
  });

  child.on("error", (err) => {
    writeNdjson(res, { type: "_meta", kind: "error", message: err?.message || String(err) });
  });

  child.on("close", (code, signal) => {
    if (stdoutBuf) res.write(stdoutBuf + "\n");
    writeNdjson(res, { type: "_meta", kind: "exit", code, signal });
    active.delete(spawnId);
    res.end();
  });

  // If the caller aborts (container saw the browser disconnect), kill claude.
  req.on("close", () => {
    if (!child.killed && child.exitCode === null) {
      try { child.kill("SIGINT"); } catch { /* ignore */ }
      // SIGINT lets claude flush; escalate if it lingers.
      setTimeout(() => {
        if (!child.killed && child.exitCode === null) {
          try { child.kill("SIGKILL"); } catch { /* ignore */ }
        }
      }, 2000);
    }
  });
}

async function handleInterrupt(req, res) {
  const body = await readBody(req);
  if (!body) return jsonReply(res, 400, { error: "invalid json" });
  const { spawnId } = body;
  const entry = active.get(spawnId);
  if (!entry) return jsonReply(res, 404, { error: "no such spawn", spawnId });
  try { entry.child.kill("SIGINT"); } catch { /* ignore */ }
  return jsonReply(res, 200, { ok: true, spawnId });
}

// ============================================================
// Persistent sessions (Phase 14c)
// ============================================================

/**
 * Update session.streamState from a stream-json event. This is the
 * authoritative classification for browser-launched sessions — the watcher's
 * JSONL-tail inference doesn't see anything until claude flushes a whole
 * turn, but we see every record the moment claude emits it, so the sidebar
 * can reflect the real state with no lag.
 *
 *   thinking   — turn in flight, no assistant content yet (or between
 *                tool_result and next assistant turn)
 *   tool       — assistant just emitted tool_use, waiting on tool_result
 *   responding — assistant just emitted text (terminal cue: "writing")
 *   idle       — `result` event landed, turn done
 */
function classifyEvent(session, evt) {
  if (!evt || typeof evt !== "object") return session.streamState;
  if (evt.type === "result") return "idle";
  if (evt.type === "assistant") {
    const content = Array.isArray(evt.message?.content) ? evt.message.content : [];
    if (content.some((c) => c?.type === "tool_use")) return "tool";
    if (evt.message?.stop_reason === "tool_use") return "tool";
    if (content.some((c) => c?.type === "text" && c.text)) return "responding";
    return session.streamState; // thinking/etc — no transition
  }
  if (evt.type === "user") {
    const content = Array.isArray(evt.message?.content) ? evt.message.content : [];
    if (content.some((c) => c?.type === "tool_result")) return "thinking"; // back to claude
    if (content.some((c) => c?.type === "text" && c.text)) return "thinking"; // fresh prompt
  }
  if (evt.type === "_meta" && (evt.kind === "closed" || evt.kind === "exit")) return "idle";
  return session.streamState;
}

function broadcast(session, evt) {
  session.transcript.push(evt);
  if (session.transcript.length > MAX_TRANSCRIPT) session.transcript.shift();
  session.lastActivityAt = new Date().toISOString();
  session.lastEventAt = new Date().toISOString();
  const prev = session.streamState;
  const next = classifyEvent(session, evt);
  if (next && next !== prev) {
    session.streamState = next;
    // State transitioned — refresh the on-disk snapshot so the dashboard
    // sees the change on its next read (debounced to avoid I/O storms).
    schedulePersist();
  }
  for (const res of session.subscribers) {
    try { res.write(JSON.stringify(evt) + "\n"); } catch { /* dropped client */ }
  }
}

let persistTimer = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistState().catch(() => { /* logged inside */ });
  }, 200);
}

// Periodic SSE heartbeat: writes a `_meta:ping` line to every subscriber so
// the connection stays warm through Next.js proxy buffers, Docker
// networking, and any HTTP keep-alive timers. The panel's reducer
// filters these out — they exist purely to keep bytes flowing.
const PING_INTERVAL_MS = 15_000;
setInterval(() => {
  const ping = { type: "_meta", kind: "ping", ts: new Date().toISOString() };
  const line = JSON.stringify(ping) + "\n";
  for (const s of sessions.values()) {
    if (s.exited || s.subscribers.size === 0) continue;
    for (const res of s.subscribers) {
      try { res.write(line); } catch { /* dropped client */ }
    }
  }
}, PING_INTERVAL_MS);

/**
 * Spawn a long-lived claude with stream-json on stdin+stdout. Returns the
 * session record immediately keyed by our minted UUID. Claude doesn't
 * emit `system:init` until the first user record arrives, so we don't
 * wait on it here — the caller can `/send` straight away.
 */
function spawnSession(cwd, resumeId = null) {
  const { ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ...cleanEnv } = process.env;
  // Permission mode: a browser session lives on the same machine, behind a
  // loopback-only bridge, run by the same user — same trust boundary as a
  // terminal `claude`. Without this flag, MCP tools and several built-ins
  // gate on an interactive prompt path the browser session can't supply
  // and auto-reject. Env-overridable for users who want stricter defaults.
  const permMode = process.env.BRIDGE_PERMISSION_MODE || "bypassPermissions";
  const args = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", permMode,
  ];
  if (resumeId) args.push("--resume", resumeId);
  const child = spawn(CLAUDE_BIN, args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: cleanEnv,
  });

  const sessionId = randomUUID();
  const session = {
    sessionId,
    claudeSessionId: null,
    cwd,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    lastEventAt: null,
    streamState: "idle", // becomes "thinking" on first /send
    child,
    transcript: [],
    subscribers: new Set(),
    exited: false,
  };
  sessions.set(sessionId, session);

  let stdoutBuf = "";
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString("utf8");
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, idx);
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (!line) continue;
      let evt;
      try { evt = JSON.parse(line); }
      catch { broadcast(session, { type: "_meta", kind: "stdout_raw", line }); continue; }

      // Capture claude's session_id for metadata + JSONL-file lookup.
      if (!session.claudeSessionId && evt.type === "system" && evt.subtype === "init" && evt.session_id) {
        session.claudeSessionId = evt.session_id;
      }
      broadcast(session, evt);
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) broadcast(session, { type: "_meta", kind: "stderr", text });
  });

  child.on("error", (err) => {
    broadcast(session, { type: "_meta", kind: "error", message: err?.message || String(err) });
  });

  child.on("close", (code, signal) => {
    session.exited = true;
    broadcast(session, { type: "_meta", kind: "closed", code, signal });
    for (const res of session.subscribers) {
      try { res.end(); } catch { /* ignore */ }
    }
    session.subscribers.clear();
    // Leave the entry in the map briefly so /sessions can show the exit; reaper drops it.
    setTimeout(() => sessions.delete(session.sessionId), 30 * 1000);
  });

  return session;
}

async function handleSessionStart(req, res) {
  const body = await readBody(req);
  if (!body) return jsonReply(res, 400, { error: "invalid json" });
  const { cwd, resumeId } = body;
  if (!cwd || !isAllowed(cwd)) {
    return jsonReply(res, 400, { error: "cwd not allowed", cwd, allowed: ALLOWED_ROOTS });
  }
  if (!existsSync(cwd)) return jsonReply(res, 400, { error: "cwd does not exist", cwd });
  if (resumeId && !/^[a-f0-9-]{8,}$/i.test(resumeId)) {
    return jsonReply(res, 400, { error: "invalid resumeId" });
  }

  // If a session already exists for this cwd:
  //   • plain start → reuse it (idempotent).
  //   • resume start → replace it. Closing stdin lets claude flush and
  //     exit; we then spawn a new process with --resume <id>.
  for (const s of sessions.values()) {
    if (s.exited || s.cwd !== cwd) continue;
    if (!resumeId) {
      return jsonReply(res, 200, {
        sessionId: s.sessionId, pid: s.pid, startedAt: s.startedAt, cwd: s.cwd, reused: true,
      });
    }
    // Resume requested → end the current session before starting the new one.
    try { s.child.stdin.end(); } catch { /* ignore */ }
    s.exited = true; // optimistic: the close handler will fire and finalize
  }

  let session;
  try { session = spawnSession(cwd, resumeId || null); }
  catch (e) { return jsonReply(res, 500, { error: "spawn failed", message: e?.message || String(e) }); }

  // Quick liveness check: if claude died within 300ms (auth fail, missing
  // bin), surface that to the caller instead of "successfully started".
  await new Promise((r) => setTimeout(r, 300));
  if (session.exited) {
    const lastErr = [...session.transcript].reverse().find((e) => e?.type === "_meta" && (e.kind === "stderr" || e.kind === "error" || e.kind === "closed"));
    return jsonReply(res, 500, {
      error: "claude exited immediately",
      detail: lastErr || null,
    });
  }

  return jsonReply(res, 200, {
    sessionId: session.sessionId, pid: session.pid, startedAt: session.startedAt, cwd: session.cwd,
    resumeId: resumeId || null,
  });
}

async function handleSessionSend(req, res) {
  const body = await readBody(req);
  if (!body) return jsonReply(res, 400, { error: "invalid json" });
  const { sessionId, prompt } = body;
  if (!sessionId || !prompt || typeof prompt !== "string" || !prompt.trim()) {
    return jsonReply(res, 400, { error: "sessionId and prompt required" });
  }
  const s = sessions.get(sessionId);
  if (!s || s.exited) return jsonReply(res, 404, { error: "no such session" });

  const record = {
    type: "user",
    message: { role: "user", content: [{ type: "text", text: prompt }] },
  };
  try {
    s.child.stdin.write(JSON.stringify(record) + "\n");
    s.lastActivityAt = new Date().toISOString();
  } catch (e) {
    return jsonReply(res, 500, { error: "stdin write failed", message: e?.message || String(e) });
  }
  // Echo the user record to subscribers + transcript so tabs reconnecting
  // later see what was asked, not just claude's answers. Claude itself only
  // emits assistant/result/tool_result events; user-text never appears in
  // its stdout. Without this echo, the replay would have no question mark.
  broadcast(s, record);
  return jsonReply(res, 200, { ok: true, sessionId });
}

/**
 * POST /session/tool-result — body { sessionId, toolUseId, content, isError? }
 *
 * Writes the stream-json user record claude expects when satisfying a
 * tool_use it just emitted (AskUserQuestion answer, externally-supplied
 * tool output, etc). Bridge mirrors the existing `/session/send` shape:
 * one stdin write, plus a broadcast() so all SSE subscribers see the
 * answer and reconnecting tabs replay it from the transcript ring.
 */
async function handleSessionToolResult(req, res) {
  const body = await readBody(req);
  if (!body) return jsonReply(res, 400, { error: "invalid json" });
  const { sessionId, toolUseId, content, isError } = body;
  if (!sessionId || !toolUseId) {
    return jsonReply(res, 400, { error: "sessionId and toolUseId required" });
  }
  const s = sessions.get(sessionId);
  if (!s || s.exited) return jsonReply(res, 404, { error: "no such session" });

  const record = {
    type: "user",
    message: {
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: toolUseId,
        content: content ?? "",
        is_error: !!isError,
      }],
    },
  };
  try {
    s.child.stdin.write(JSON.stringify(record) + "\n");
    s.lastActivityAt = new Date().toISOString();
  } catch (e) {
    return jsonReply(res, 500, { error: "stdin write failed", message: e?.message || String(e) });
  }
  broadcast(s, record);
  return jsonReply(res, 200, { ok: true, sessionId, toolUseId });
}

async function handleSessionStop(req, res) {
  const body = await readBody(req);
  if (!body) return jsonReply(res, 400, { error: "invalid json" });
  const { sessionId } = body;
  const s = sessions.get(sessionId);
  if (!s) return jsonReply(res, 404, { error: "no such session" });

  // Graceful: EOF on stdin → claude flushes and exits. Escalate if it hangs.
  try { s.child.stdin.end(); } catch { /* ignore */ }
  setTimeout(() => {
    if (s.exited) return;
    try { s.child.kill("SIGINT"); } catch { /* ignore */ }
    setTimeout(() => {
      if (s.exited) return;
      try { s.child.kill("SIGKILL"); } catch { /* ignore */ }
    }, 2000);
  }, 5000);
  return jsonReply(res, 200, { ok: true, sessionId });
}

function handleSessionStream(req, res) {
  const url = new URL(req.url, "http://x");
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return jsonReply(res, 400, { error: "sessionId required" });
  const s = sessions.get(sessionId);
  if (!s) return jsonReply(res, 404, { error: "no such session" });

  res.writeHead(200, {
    "content-type": "application/x-ndjson",
    "cache-control": "no-cache, no-transform",
    "x-session-id": sessionId,
  });

  // Replay the transcript so a reconnecting tab sees the full conversation,
  // then attach for live updates. Order matters: replay first, subscribe
  // second, so a record arriving mid-replay isn't duplicated.
  for (const evt of s.transcript) {
    try { res.write(JSON.stringify(evt) + "\n"); } catch { /* ignore */ }
  }
  if (s.exited) {
    res.write(JSON.stringify({ type: "_meta", kind: "already_closed" }) + "\n");
    res.end();
    return;
  }
  s.subscribers.add(res);
  req.on("close", () => {
    // Just unsubscribe — the session keeps running (sessions survive tab close).
    s.subscribers.delete(res);
  });
}

function handleSessionsList(_req, res) {
  const list = [];
  for (const s of sessions.values()) {
    if (!s.sessionId) continue;
    list.push({
      sessionId: s.sessionId,
      claudeSessionId: s.claudeSessionId,
      cwd: s.cwd,
      pid: s.pid,
      startedAt: s.startedAt,
      lastActivityAt: s.lastActivityAt,
      lastEventAt: s.lastEventAt,
      streamState: s.streamState,
      exited: s.exited,
      transcriptLen: s.transcript.length,
      subscribers: s.subscribers.size,
    });
  }
  return jsonReply(res, 200, { sessions: list });
}

function handleHealth(_req, res) {
  return jsonReply(res, 200, {
    ok: true,
    ts: new Date().toISOString(),
    pid: process.pid,
    activeSpawns: active.size,
    activeSessions: [...sessions.values()].filter((s) => s.sessionId && !s.exited).length,
    allowedRoots: ALLOWED_ROOTS,
    claudeBin: CLAUDE_BIN,
    // Visibility: confirms each spawn strips ANTHROPIC_API_KEY /
    // ANTHROPIC_AUTH_TOKEN so claude uses the Max subscription, not API.
    spawnEnvStripsApiKey: true,
    bridgeEnvHasApiKey: !!process.env.ANTHROPIC_API_KEY,
  });
}

const server = http.createServer((req, res) => {
  // Tight router — reject anything we don't recognize.
  if (req.method === "GET"  && req.url === "/health")          return handleHealth(req, res);
  if (req.method === "POST" && req.url === "/spawn")           return handleSpawn(req, res);
  if (req.method === "POST" && req.url === "/interrupt")       return handleInterrupt(req, res);
  if (req.method === "POST" && req.url === "/session/start")   return handleSessionStart(req, res);
  if (req.method === "POST" && req.url === "/session/send")    return handleSessionSend(req, res);
  if (req.method === "POST" && req.url === "/session/tool-result") return handleSessionToolResult(req, res);
  if (req.method === "POST" && req.url === "/session/stop")    return handleSessionStop(req, res);
  if (req.method === "GET"  && req.url.startsWith("/session/stream")) return handleSessionStream(req, res);
  if (req.method === "GET"  && req.url === "/sessions")        return handleSessionsList(req, res);
  jsonReply(res, 404, { error: "not found", method: req.method, url: req.url });
});

server.on("clientError", (_err, socket) => {
  try { socket.destroy(); } catch { /* ignore */ }
});

async function writeStateAtomic(payload) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(TMP_FILE, JSON.stringify(payload, null, 2));
  await fs.rename(TMP_FILE, STATE_FILE);
}

async function persistState() {
  try {
    await writeStateAtomic({
      ts: new Date().toISOString(),
      host: os.hostname(),
      port: PORT,
      pid: process.pid,
      activeSpawns: active.size,
      activeSessions: [...sessions.values()]
        .filter((s) => s.sessionId && !s.exited)
        .map((s) => ({
          sessionId: s.sessionId,
          claudeSessionId: s.claudeSessionId,
          cwd: s.cwd,
          pid: s.pid,
          startedAt: s.startedAt,
          lastActivityAt: s.lastActivityAt,
          lastEventAt: s.lastEventAt,
          streamState: s.streamState,
        })),
      allowedRoots: ALLOWED_ROOTS,
    });
  } catch (e) {
    process.stderr.write(`[bridge] persistState failed: ${e?.message || e}\n`);
  }
}

async function shutdown() {
  // One-shot spawns: interrupt directly. Long-lived sessions: close stdin
  // so claude exits cleanly with its session JSONL flushed.
  for (const { child } of active.values()) {
    try { child.kill("SIGINT"); } catch { /* ignore */ }
  }
  for (const s of sessions.values()) {
    if (s.exited) continue;
    try { s.child.stdin.end(); } catch { /* ignore */ }
  }
  try {
    await writeStateAtomic({
      ts: new Date().toISOString(),
      host: os.hostname(),
      port: PORT,
      pid: process.pid,
      activeSpawns: 0,
      activeSessions: [],
      shutdownAt: new Date().toISOString(),
    });
  } catch { /* ignore */ }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);

server.listen(PORT, HOST, async () => {
  await persistState();
  setInterval(persistState, STATE_TICK_MS);
  process.stdout.write(
    `[bridge] listening on http://${HOST}:${PORT} · claude=${CLAUDE_BIN} · roots=${ALLOWED_ROOTS.join(",")}\n`
  );
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    process.stderr.write(
      `[bridge] ANTHROPIC_API_KEY/AUTH_TOKEN present in env; stripping from spawn (will use subscription auth)\n`
    );
  }
});
