#!/usr/bin/env node
/**
 * Claude session watcher daemon (Phase 10).
 *
 * Runs on the HOST (not inside the Docker container — macOS Docker can't
 * see host processes). Every TICK_MS, scans for `claude` CLI processes,
 * maps each PID to its working directory via lsof, encodes the cwd into
 * the same folder name `lib/sessions.js` uses, and atomically writes a
 * snapshot to data/live-sessions.json. The Next.js dashboard reads that
 * file on SSR to distinguish "session open and idle" from "JSONL recently
 * written" pulses.
 *
 * No deps. Pure node:child_process + fs.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_FILE  = path.join(REPO_ROOT, "data", "live-sessions.json");
const TMP_FILE  = OUT_FILE + ".tmp";
const TICK_MS   = Number(process.env.SESSION_WATCHER_INTERVAL_MS) || 1500;
const EXEC_TIMEOUT_MS = 1500;
const SESSIONS_ROOT = path.join(os.homedir(), ".claude", "projects");
const TAIL_BYTES = 16 * 1024;            // last 16KB is plenty for the trailing events
const RESPONDING_WINDOW_MS = 5 * 1000;   // "just responded" feels fresh within 5s

/** Same encoding as lib/sessions.js encodeCwd — every non-alnum → "-". */
function encodeCwd(absPath) {
  return String(absPath).replace(/[^A-Za-z0-9]/g, "-");
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: EXEC_TIMEOUT_MS }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout);
    });
  });
}

/**
 * All PIDs whose argv[0] is the `claude` CLI — bare or with any args.
 *
 * Matches `claude`, `claude --resume <id>`, `claude -p --input-format
 * stream-json ...` (Phase 14c browser-launched sessions), etc. Excludes
 * `/Applications/Claude.app/...` desktop helpers because their argv[0] is
 * a path, not the bareword.
 */
async function listClaudePids() {
  const out = await run("/bin/ps", ["-ax", "-o", "pid,command"]);
  if (!out) return [];
  const pids = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!m) continue;
    const cmd = m[2].trim();
    if (cmd === "claude" || cmd.startsWith("claude ")) pids.push(Number(m[1]));
  }
  return pids;
}

/** Cwd for a single PID via lsof. Returns null if process died or perms. */
async function cwdForPid(pid) {
  const out = await run("/usr/sbin/lsof", ["-p", String(pid), "-a", "-d", "cwd", "-Fpn"]);
  if (!out) return null;
  // -Fpn output: lines like "p96229", "n/Users/m.curtis/..."
  for (const line of out.split("\n")) {
    if (line.startsWith("n")) return line.slice(1).trim() || null;
  }
  return null;
}

/** Process start time as ISO. Uses BSD ps -o lstart= (single line, %a %b %e %T %Y). */
async function startedAtForPid(pid) {
  const out = await run("/bin/ps", ["-p", String(pid), "-o", "lstart="]);
  if (!out) return null;
  const s = out.trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Tail the most recent JSONL in this session's folder and classify the
 * conversation state. Returns { streamState, lastEventAt, lastEventType }
 * — streamState ∈ {"responding", "tool", "waiting"}. Null/null/null on
 * any read or parse failure (caller treats as "waiting").
 */
async function classifyStream(folder) {
  const dir = path.join(SESSIONS_ROOT, folder);
  let mostRecent = null;
  let mostRecentMtime = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
      const full = path.join(dir, e.name);
      const st = await fs.stat(full).catch(() => null);
      if (!st) continue;
      if (st.mtimeMs > mostRecentMtime) {
        mostRecentMtime = st.mtimeMs;
        mostRecent = full;
      }
    }
  } catch { return { streamState: null, lastEventAt: null, lastEventType: null }; }
  if (!mostRecent) return { streamState: null, lastEventAt: null, lastEventType: null };

  // Read the last TAIL_BYTES of the file (or the whole file if smaller).
  let buf = "";
  try {
    const fh = await fs.open(mostRecent, "r");
    try {
      const st = await fh.stat();
      const start = Math.max(0, st.size - TAIL_BYTES);
      const len = st.size - start;
      const out = Buffer.alloc(len);
      await fh.read(out, 0, len, start);
      buf = out.toString("utf8");
    } finally { await fh.close(); }
  } catch { return { streamState: null, lastEventAt: null, lastEventType: null }; }

  // Find the most recent line whose type is a real conversation event
  // (assistant or user). Metadata events (ai-title, agent-name, attachment,
  // permission-mode, last-prompt, file-history-snapshot) are noise for
  // state-tracking — they fire on hooks and would mask the real signal.
  const lines = buf.split("\n").filter(Boolean);
  let lastMsg = null;
  let secondToLast = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let evt;
    try { evt = JSON.parse(lines[i]); } catch { continue; }
    if (!evt || (evt.type !== "assistant" && evt.type !== "user")) continue;
    if (!lastMsg) { lastMsg = evt; continue; }
    secondToLast = evt;
    break;
  }
  if (!lastMsg) return { streamState: "waiting", lastEventAt: null, lastEventType: null };

  const ageMs = Date.now() - mostRecentMtime;
  const msg = lastMsg.message || {};
  const role = msg.role || lastMsg.role || "";
  const stop = msg.stop_reason || "";
  const contentTypes = Array.isArray(msg.content)
    ? msg.content.map((c) => (c && typeof c === "object" ? c.type : null)).filter(Boolean)
    : [];
  const hasToolResult = contentTypes.includes("tool_result");
  const hasToolUse    = contentTypes.includes("tool_use");

  // Decision tree:
  //   1. Assistant requested a tool, no user/tool_result follows → "tool"
  //   2. User just delivered a tool_result, no assistant follows → "tool"
  //   3. Assistant just landed (end_turn within RESPONDING_WINDOW) → "responding"
  //   4. User just typed (non-tool_result, within RESPONDING_WINDOW) → "responding"
  //   5. Default → "waiting"
  let streamState = "waiting";
  if (role === "assistant" && (stop === "tool_use" || hasToolUse)) {
    streamState = "tool";
  } else if (role === "user" && hasToolResult) {
    streamState = "tool";
  } else if (role === "assistant" && ageMs <= RESPONDING_WINDOW_MS) {
    streamState = "responding";
  } else if (role === "user" && !hasToolResult && ageMs <= RESPONDING_WINDOW_MS) {
    streamState = "responding";
  }
  return {
    streamState,
    lastEventAt: new Date(mostRecentMtime).toISOString(),
    lastEventType: lastMsg.type,
  };
}

async function snapshot() {
  const pids = await listClaudePids();
  const rows = await Promise.all(pids.map(async (pid) => {
    const [cwd, startedAt] = await Promise.all([cwdForPid(pid), startedAtForPid(pid)]);
    if (!cwd) return null;
    const folder = encodeCwd(cwd);
    const stream = await classifyStream(folder);
    return { pid, cwd, folder, startedAt, ...stream };
  }));
  return rows.filter(Boolean);
}

async function writeAtomic(payload) {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(TMP_FILE, JSON.stringify(payload, null, 2));
  await fs.rename(TMP_FILE, OUT_FILE);
}

async function tick() {
  try {
    const sessions = await snapshot();
    await writeAtomic({
      ts: new Date().toISOString(),
      intervalMs: TICK_MS,
      host: os.hostname(),
      sessions,
    });
  } catch (e) {
    // Best-effort: never let a single tick failure kill the loop. Log to
    // stderr so launchd captures it in watcher.err for debugging.
    process.stderr.write(`[watcher] tick failed: ${e?.message || e}\n`);
  }
}

async function shutdown() {
  try {
    await writeAtomic({
      ts: new Date().toISOString(),
      intervalMs: TICK_MS,
      host: os.hostname(),
      sessions: [],
      shutdownAt: new Date().toISOString(),
    });
  } catch { /* ignore */ }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);

// First tick immediately, then on interval.
await tick();
setInterval(tick, TICK_MS);
process.stdout.write(`[watcher] started · writing ${OUT_FILE} every ${TICK_MS}ms\n`);
