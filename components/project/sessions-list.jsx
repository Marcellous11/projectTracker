"use client";

import { useState } from "react";
import { Uptime } from "@/components/hud/clock.jsx";

function fmtTokens(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd) {
  if (!usd) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(0)}`;
}

function fmtTools(tools, max = 5) {
  if (!tools?.length) return null;
  const head = tools.slice(0, max).map((t) => `${t.name} ${t.count}`).join(" · ");
  const rest = tools.length - max;
  return rest > 0 ? `${head} · +${rest} more` : head;
}

function basename(p) {
  if (!p) return "";
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function relTime(d) {
  if (!d) return "—";
  const s = Math.round((Date.now() - +new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Briefing voice. Click a row to expand and reveal last user prompt + branch
 * + permission mode. Hosted client-side because of the toggle; data arrives
 * server-side already.
 */
export default function SessionsList({ sessions = [], cwd = null }) {
  const [openId, setOpenId] = useState(null);
  const [resuming, setResuming] = useState(null); // claude session_id mid-fetch
  const [resumeError, setResumeError] = useState(null);

  async function resumeSession(claudeSessionId) {
    if (!cwd) { setResumeError("no cwd"); return; }
    setResuming(claudeSessionId);
    setResumeError(null);
    try {
      const res = await fetch("/api/claude/session/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd, resumeId: claudeSessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionId) {
        setResumeError(data?.error || `http ${res.status}`);
        return;
      }
      // Notify the PROMPT panel: jump into this newly-spawned bridge session.
      window.dispatchEvent(new CustomEvent("claude:resume-session", {
        detail: {
          cwd,
          bridgeSessionId: data.sessionId,
          pid: data.pid,
          startedAt: data.startedAt,
          resumedFrom: claudeSessionId,
        },
      }));
    } catch (err) {
      setResumeError(err?.message || String(err));
    } finally {
      setResuming(null);
    }
  }

  if (!sessions.length) {
    return (
      <section className="hud-module">
        <header className="hud-module-header">
          <span className="hud-label">SESSIONS</span>
          <span className="hud-mono text-[10px] text-hud-ink-dim">0 recorded</span>
        </header>
        <div className="hud-module-body">
          <p className="hud-mono text-[11px] text-hud-ink-dim">// no Claude sessions for this project</p>
        </div>
      </section>
    );
  }

  return (
    <section className="hud-module">
      <header className="hud-module-header">
        <span className="hud-label">SESSIONS</span>
        <span className="hud-mono text-[10px] text-hud-ink-dim">
          {sessions.length} total · {sessions.filter((s) => s.isLive).length} live
        </span>
      </header>

      <ul className="hud-module-body p-0 max-h-[420px] overflow-y-auto">
        {sessions.map((s) => {
          const isOpen = openId === s.sessionId;
          const tokens =
            (s.tokensTail?.input ?? 0) + (s.tokensTail?.output ?? 0) +
            (s.tokensTail?.cacheCreation ?? 0) + (s.tokensTail?.cacheRead ?? 0);
          return (
            <li key={s.sessionId} className={`border-b border-hud-border/60 last:border-b-0 ${isOpen ? "bg-foreground/5" : ""}`}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : s.sessionId)}
                className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-foreground/5 transition-colors"
              >
                <span
                  className={`inline-block size-1.5 rounded-full shrink-0 ${
                    s.isLive ? "bg-green hud-pulse-live" : s.isRecent ? "bg-[var(--color-blue)]" : "bg-muted-foreground/40"
                  }`}
                />
                <span suppressHydrationWarning className="hud-mono text-[10px] text-hud-ink-dim shrink-0 w-[64px] tabular-nums">
                  {s.isLive ? <Uptime since={s.startedAt} /> : relTime(s.lastActivityAt)}
                </span>
                <span className="flex-1 min-w-0 text-[12px] truncate">
                  {s.slug ? <span className="hud-mono text-[11px]">{s.slug}</span> : "session"}
                </span>
                <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 tabular-nums">
                  {fmtTokens(tokens)}t
                </span>
                {s.isLive && (
                  <span className="hud-mono text-[10px] text-green shrink-0 uppercase tracking-wider">LIVE</span>
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 flex flex-col gap-2 text-[11px]">
                  <Row label="STARTED">
                    {s.startedAt ? new Date(s.startedAt).toISOString().slice(0, 19).replace("T", " ") : "—"}
                  </Row>
                  <Row label="BRANCH">{s.gitBranch || "—"}</Row>
                  <Row label="MODEL">{s.model || "—"}</Row>
                  <Row label="MODE">{s.permissionMode || "default"}</Row>
                  <Row label="PROMPTS">
                    {s.summaryIsLowerBound ? "≥" : ""}{s.promptCountTail ?? 0}
                  </Row>
                  {s.costUSD > 0 && (
                    <Row label="COST">
                      {s.summaryIsLowerBound ? "~" : ""}{fmtCost(s.costUSD)}
                    </Row>
                  )}
                  {s.toolsUsed?.length > 0 && (
                    <Row label="TOOLS">{fmtTools(s.toolsUsed)}</Row>
                  )}
                  {s.filesTouched?.length > 0 && (
                    <Row label="FILES">
                      <span title={s.filesTouched.join("\n")}>
                        {s.filesTouched.slice(0, 3).map(basename).join(" · ")}
                        {s.filesTouched.length > 3 ? ` · +${s.filesTouched.length - 3} more` : ""}
                      </span>
                    </Row>
                  )}
                  {s.subagentCount > 0 && (
                    <Row label="SUBAGENTS">{s.subagentCount}</Row>
                  )}
                  {s.lastUserPrompt && (
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="hud-label">LAST USER PROMPT</span>
                      <p className="italic text-[12px] text-foreground/85 leading-snug">
                        "{s.lastUserPrompt}"
                      </p>
                    </div>
                  )}
                  {cwd && (
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-hud-ink-dim/15">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resumeSession(s.sessionId); }}
                        disabled={resuming === s.sessionId}
                        className="h-7 rounded-lg border border-green/50 px-3 text-[10px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40"
                      >
                        {resuming === s.sessionId ? "starting…" : "▶ resume in browser"}
                      </button>
                      {resumeError && (
                        <span className="hud-mono text-[10px] text-hot truncate">// {resumeError}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hud-label shrink-0 w-16">{label}</span>
      <span className="hud-mono text-foreground/80 truncate">{children}</span>
    </div>
  );
}
