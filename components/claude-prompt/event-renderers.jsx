"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Terminal-native flavor renderers for the browser PROMPT panel.
 *
 * Goal: feel like the Claude Code terminal client, not like a chat app.
 *   - User prompts get a dim `>` prefix.
 *   - Assistant text is just rendered markdown — no card, no border.
 *   - Tool calls show `● ToolName(short args)`; results follow on a
 *     `  ⎿  …` line, just like the terminal's tree formatting.
 *   - System/meta/result lines are slim dim captions.
 *
 * Cards are gone on purpose. Everything is mono-spaced flowing text
 * separated by leading glyphs and indentation, matching the terminal.
 */

export function UserCard({ text }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="hud-mono text-sm text-green/80 select-none">&gt;</span>
      <pre className="whitespace-pre-wrap break-words hud-mono text-sm text-foreground/95 flex-1">{text}</pre>
    </div>
  );
}

export function AssistantCard({ text }) {
  return (
    <div className="md-body text-sm leading-relaxed py-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// --- tool rendering --------------------------------------------------

function inputHeadline(name, input) {
  if (!input || typeof input !== "object") return "";
  if (name === "Bash") return input.command || "";
  if (name === "Read") return shortPath(input.file_path);
  if (name === "Write") return shortPath(input.file_path);
  if (name === "Edit" || name === "MultiEdit") return shortPath(input.file_path);
  if (name === "Grep") {
    const where = input.path ? ` in ${shortPath(input.path)}` : "";
    return `${input.pattern || ""}${where}`;
  }
  if (name === "Glob") return input.pattern || "";
  if (name === "WebFetch") return input.url || "";
  if (name === "WebSearch") return `"${input.query || ""}"`;
  if (name === "Task" || name === "Agent") {
    return input.description || input.subagent_type || "";
  }
  if (name === "TodoWrite") return `${(input.todos || []).length} items`;
  try {
    const s = JSON.stringify(input);
    return s.length > 120 ? s.slice(0, 120) + "…" : s;
  } catch { return ""; }
}

function shortPath(p) {
  if (!p || typeof p !== "string") return "";
  // Trim cwd-y prefixes for terminal-style readability.
  const parts = p.split("/").filter(Boolean);
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-3).join("/");
}

function flattenToolResult(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content.map((c) => {
    if (typeof c === "string") return c;
    if (c?.type === "text") return c.text || "";
    return JSON.stringify(c);
  }).join("\n");
}

/** Terminal-style one-line summary of a tool result, mirroring `claude` CLI. */
function resultSummary(name, output, isError) {
  if (isError) {
    const text = flattenToolResult(output);
    if (!text) return "error";
    const first = text.split("\n", 1)[0] || text;
    return first.length > 200 ? first.slice(0, 200) + "…" : first;
  }
  if (output == null) return null;
  const text = flattenToolResult(output);
  if (!text) return "(no output)";
  if (name === "Read") {
    const lines = text.split("\n").length;
    return `Read ${lines} line${lines === 1 ? "" : "s"}`;
  }
  if (name === "Write" || name === "Edit" || name === "MultiEdit") {
    return text.split("\n")[0].slice(0, 100) || "ok";
  }
  if (name === "Glob" || name === "Grep") {
    const lines = text.split("\n").filter(Boolean).length;
    return `${lines} ${name === "Glob" ? "path" : "match"}${lines === 1 ? "" : "es"}`;
  }
  // Default: first line, capped.
  const first = text.split("\n", 1)[0] || "";
  if (text.includes("\n")) {
    const nLines = text.split("\n").length;
    return first.length > 100
      ? first.slice(0, 100) + `… (+${nLines - 1} more lines)`
      : `${first}  (+${nLines - 1} more lines)`;
  }
  return first.length > 200 ? first.slice(0, 200) + "…" : first;
}

export function ToolCard({ name, input, output, isError, running, interactiveSlot = null }) {
  const head = inputHeadline(name, input);
  const bulletColor = isError ? "text-hot" : running ? "text-warm" : "text-green";
  const text = output != null ? flattenToolResult(output) : "";
  const summary = interactiveSlot ? null : (running ? "running…" : resultSummary(name, output, isError));
  const showExpand = text && text.length > 0 && !running && !interactiveSlot;

  return (
    <div className="py-1 hud-mono text-sm leading-relaxed">
      <div className="flex gap-2">
        <span className={`select-none ${bulletColor}`}>●</span>
        <div className="flex-1 min-w-0">
          <div className="text-foreground/95">
            <span className="font-semibold">{name}</span>
            {head && <span className="text-hud-ink-dim">({head})</span>}
          </div>
          {summary && (
            <div className="flex gap-2 pl-1">
              <span className="text-hud-ink-dim select-none">⎿</span>
              <span className={`${isError ? "text-hot" : "text-foreground/75"} flex-1 min-w-0 break-words`}>
                {summary}
              </span>
            </div>
          )}
          {interactiveSlot}
          {showExpand && (
            <details className="pl-4 mt-0.5">
              <summary className="text-[11px] text-hud-ink-dim/70 hover:text-hud-ink-dim cursor-pointer select-none">
                ctrl+r to expand ({text.length.toLocaleString()} chars)
              </summary>
              <pre className="whitespace-pre-wrap break-words text-xs text-foreground/70 mt-1 pl-1 border-l border-hud-ink-dim/15">
                {text.length > 4000 ? text.slice(0, 4000) + "\n…" : text}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResultCard({ result }) {
  const cost = typeof result?.total_cost_usd === "number" ? `~$${result.total_cost_usd.toFixed(4)}` : null;
  const dur = typeof result?.duration_ms === "number" ? `${(result.duration_ms / 1000).toFixed(1)}s` : null;
  const turns = typeof result?.num_turns === "number" ? `${result.num_turns} turn${result.num_turns === 1 ? "" : "s"}` : null;
  const ok = result?.subtype === "success" && !result?.is_error;
  const bits = [dur, turns, cost].filter(Boolean).join(" · ");
  return (
    <div className="hud-mono text-[11px] text-hud-ink-dim py-1 flex items-baseline gap-2">
      <span className={`select-none ${ok ? "text-green" : "text-hot"}`}>{ok ? "✓" : "✗"}</span>
      <span>{ok ? "done" : "error"}</span>
      {bits && <span>· {bits}</span>}
      {!ok && result?.result && (
        <span className="text-hot break-all">— {String(result.result).slice(0, 240)}</span>
      )}
    </div>
  );
}

export function SystemCard({ payload }) {
  const sid = payload?.session_id ? String(payload.session_id).slice(0, 8) : null;
  const model = payload?.model || null;
  return (
    <div className="hud-mono text-[10px] text-hud-ink-dim/80 py-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
      {model && <span>model {model}</span>}
      {sid && <span>· session {sid}</span>}
      {payload?.cwd && <span>· cwd {shortPath(payload.cwd)}</span>}
    </div>
  );
}

export function MetaCard({ meta }) {
  if (meta?.kind === "spawn") {
    return (
      <div className="hud-mono text-[10px] text-hud-ink-dim py-0.5">
        ▸ spawned pid {meta.pid}
      </div>
    );
  }
  if (meta?.kind === "closed" || meta?.kind === "exit") {
    const ok = meta.code === 0;
    return (
      <div className={`hud-mono text-[10px] py-0.5 ${ok ? "text-hud-ink-dim" : "text-hot"}`}>
        ◾ session ended{meta.code != null ? ` · exit ${meta.code}` : ""}{meta.signal ? ` · signal ${meta.signal}` : ""}
      </div>
    );
  }
  if (meta?.kind === "stderr" || meta?.kind === "error") {
    return (
      <div className="hud-mono text-xs text-hot py-1 flex gap-2">
        <span className="select-none">⚠</span>
        <pre className="whitespace-pre-wrap break-words flex-1">{meta.text || meta.message}</pre>
      </div>
    );
  }
  return null;
}
