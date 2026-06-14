import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { cache } from "react";
import { getDaemonState } from "./session-daemon-state.js";
import { getBridgeState } from "./bridge-state.js";
import { estimateCostUSD } from "./pricing.js";

const FILE_TOOLS = new Set(["Read", "Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SUBAGENT_TOOLS = new Set(["Agent", "Task"]);

/**
 * Claude Code session discovery.
 *
 * Claude stores per-session JSONL files at:
 *   ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl
 * where encoded-cwd = absolute cwd with every "/" replaced by "-".
 *
 * Decoding folder names back is ambiguous because real paths contain
 * hyphens (e.g. "WC-woodcab"). We never decode — we always go
 *   dir → encodeCwd(dir) → exact folder match
 * from the projects already discovered by lib/scan.js.
 *
 * Session JSONLs can be many MB. We never readFile() the whole thing.
 * Strategy per file:
 *   1. stat()  → mtime classifies live / recent / cold
 *   2. cold files: stat only (no read)
 *   3. recent/live: fs.open, read HEAD_BYTES from start + TAIL_BYTES from end
 *   Cap per-file I/O at ~40KB.
 */

const SESSIONS_ROOT = path.join(os.homedir(), ".claude", "projects");
const LIVE_THRESHOLD_MS   = 3 * 60 * 1000;
const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;
// Sessions begin with a SessionStart hook_success attachment that can be tens
// of KB on its own (CLAUDE.md + skills list embed). 64KB reliably reaches
// the first real user message in observed transcripts.
const HEAD_BYTES = 64 * 1024;
const TAIL_BYTES = 32 * 1024;

/**
 * Encode a cwd to its session-folder name. Claude Code maps every
 * non-alphanumeric character to "-" per-character (no collapsing). So
 *   /Users/m.curtis/.config/wezterm
 * becomes
 *   -Users-m-curtis--config-wezterm
 * (the `/` and `.` between `curtis` and `config` produce a double-dash).
 */
export function encodeCwd(absPath) {
  return String(absPath).replace(/[^A-Za-z0-9]/g, "-");
}

/**
 * Translate a container project dir back to its host equivalent. When the
 * dashboard runs in Docker, PROJECTS_ROOT is mounted at /projects but the
 * session folders on disk encode the *host* path (e.g. /Users/m.curtis/...).
 * Without this translation, encodeCwd(p.dir) won't match the folder name.
 *
 * When HOST_PROJECTS_ROOT is unset (host run), this is a no-op.
 */
export function toHostPath(dir) {
  const containerRoot = process.env.PROJECTS_ROOT;
  const hostRoot = process.env.HOST_PROJECTS_ROOT;
  if (!hostRoot || !containerRoot) return dir;
  if (dir === containerRoot) return hostRoot;
  if (dir.startsWith(containerRoot + "/")) return hostRoot + dir.slice(containerRoot.length);
  return dir;
}

/** encodeCwd(toHostPath(dir)) — used everywhere we need a session folder name. */
export function projectFolder(dir) {
  return encodeCwd(toHostPath(dir));
}

async function listSessionDirs() {
  try {
    const entries = await fs.readdir(SESSIONS_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listSessionFiles(folder) {
  const abs = path.join(SESSIONS_ROOT, folder);
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => ({ filePath: path.join(abs, e.name), name: e.name }));
  } catch {
    return [];
  }
}

function parseJsonlLines(text) {
  const out = [];
  if (!text) return out;
  const lines = text.split("\n");
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* partial / truncated — skip */ }
  }
  return out;
}

function pickMeta(objs) {
  // First user message is the most reliable carrier of cwd/slug/branch.
  for (const obj of objs) {
    if (obj?.type === "user" && obj?.message?.role === "user") {
      return {
        slug: obj.slug ?? null,
        cwd: obj.cwd ?? null,
        gitBranch: obj.gitBranch ?? null,
        startedAt: obj.timestamp ?? null,
        permissionMode: obj.permissionMode ?? null,
      };
    }
  }
  // Fallback: any record carrying cwd or slug.
  for (const obj of objs) {
    if (obj?.cwd || obj?.slug) {
      return {
        slug: obj.slug ?? null,
        cwd: obj.cwd ?? null,
        gitBranch: obj.gitBranch ?? null,
        startedAt: obj.timestamp ?? null,
        permissionMode: obj.permissionMode ?? null,
      };
    }
  }
  return { slug: null, cwd: null, gitBranch: null, startedAt: null, permissionMode: null };
}

/**
 * Walk parsed JSONL objects and extract everything we display per session.
 * Pure over `objs` so we can feed it head, tail, or both. Dedupe by uuid
 * happens at the caller (head+tail can overlap on small files).
 *
 * Counting rules:
 *  - A "prompt" is a user record with a text content block. Tool results,
 *    hook attachments, and other role:"user" carriers do NOT count.
 *  - Sidechain (subagent) turns never count as prompts and their tool use
 *    is not folded into the parent's tool histogram — we count the parent's
 *    Agent invocations instead.
 */
function summarizeObjs(objs) {
  let lastUserPromptTs = -Infinity;
  let lastUserPrompt = null;
  let promptCount = 0;
  let model = null;
  let permissionMode = null;
  const tokens = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 };
  const toolsUsed = new Map();
  const filesTouched = new Set();
  let subagentCount = 0;

  for (const obj of objs) {
    const isSidechain = !!obj?.isSidechain;
    const ts = obj?.timestamp ? +new Date(obj.timestamp) : 0;

    if (obj?.type === "user" && obj?.message?.role === "user" && !isSidechain && !obj?.isMeta) {
      const content = obj.message.content;
      let text = null;
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        const t = content.find((c) => c?.type === "text" && c.text);
        if (t) text = t.text;
      }
      if (text) {
        promptCount++;
        if (ts >= lastUserPromptTs) {
          lastUserPromptTs = ts;
          lastUserPrompt = text;
        }
      }
    }

    if (obj?.type === "assistant" && !isSidechain) {
      const content = obj?.message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type !== "tool_use" || !c?.name) continue;
          toolsUsed.set(c.name, (toolsUsed.get(c.name) || 0) + 1);
          if (SUBAGENT_TOOLS.has(c.name)) subagentCount++;
          if (FILE_TOOLS.has(c.name)) {
            const p = c.input?.file_path || c.input?.notebook_path;
            if (p) filesTouched.add(p);
          }
        }
      }
    }

    if (obj?.message?.model) model = obj.message.model;
    if (obj?.permissionMode) permissionMode = obj.permissionMode;
    const u = obj?.message?.usage;
    if (u) {
      tokens.input         += u.input_tokens ?? 0;
      tokens.output        += u.output_tokens ?? 0;
      tokens.cacheCreation += u.cache_creation_input_tokens ?? 0;
      tokens.cacheRead     += u.cache_read_input_tokens ?? 0;
    }
  }
  if (lastUserPrompt && lastUserPrompt.length > 280) {
    lastUserPrompt = lastUserPrompt.slice(0, 280) + "…";
  }
  return {
    lastUserPrompt,
    promptCount,
    model,
    permissionMode,
    tokens,
    toolsUsed,
    filesTouched,
    subagentCount,
  };
}

async function readHeadTail(filePath, size) {
  let fh;
  try {
    fh = await fs.open(filePath, "r");
    const headBuf = Buffer.alloc(Math.min(HEAD_BYTES, size));
    await fh.read(headBuf, 0, headBuf.length, 0);
    let tailBuf;
    if (size > HEAD_BYTES) {
      const tailLen = Math.min(TAIL_BYTES, size);
      tailBuf = Buffer.alloc(tailLen);
      await fh.read(tailBuf, 0, tailLen, Math.max(0, size - tailLen));
    } else {
      tailBuf = headBuf; // small file: head and tail overlap completely
    }
    return { head: headBuf.toString("utf8"), tail: tailBuf.toString("utf8") };
  } finally {
    if (fh) await fh.close().catch(() => {});
  }
}

async function summarizeOne(filePath) {
  let stat;
  try { stat = await fs.stat(filePath); }
  catch { return null; }

  const now = Date.now();
  const lastActivityMs = stat.mtimeMs;
  const ageMs = now - lastActivityMs;
  const sessionId = path.basename(filePath, ".jsonl");

  const base = {
    sessionId,
    filePath,
    size: stat.size,
    startedAt: null,
    lastActivityAt: new Date(lastActivityMs).toISOString(),
    slug: null,
    cwd: null,
    gitBranch: null,
    model: null,
    permissionMode: null,
    lastUserPrompt: null,
    promptCountTail: 0,
    promptCountIsLowerBound: false,
    summaryIsLowerBound: false,
    tokensTail: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
    costUSD: 0,
    toolsUsed: [],
    filesTouched: [],
    subagentCount: 0,
    isLive: ageMs <= LIVE_THRESHOLD_MS,
    isRecent: ageMs <= RECENT_THRESHOLD_MS,
  };

  // Cold file → stat only.
  if (ageMs > RECENT_THRESHOLD_MS) return base;

  try {
    const { head, tail } = await readHeadTail(filePath, stat.size);
    const headObjs = parseJsonlLines(head);
    // For the tail, drop the first chunk (likely partial after splitting by \n).
    const tailText = stat.size > HEAD_BYTES
      ? tail.slice(tail.indexOf("\n") + 1)
      : tail;
    const tailObjs = parseJsonlLines(tailText);

    // Try head for start metadata; fall back to tail (every user record carries cwd/slug).
    let meta = pickMeta(headObjs);
    if (!meta.cwd && !meta.slug) {
      const fromTail = pickMeta(tailObjs);
      // Keep tail-derived cwd/slug; prefer head startedAt if present, else stat.birthtime.
      meta = {
        ...fromTail,
        startedAt: meta.startedAt ?? fromTail.startedAt ?? new Date(stat.birthtimeMs || stat.ctimeMs).toISOString(),
      };
    }
    if (!meta.startedAt) meta.startedAt = new Date(stat.birthtimeMs || stat.ctimeMs).toISOString();

    // Union head+tail. On small files head and tail point at the same bytes,
    // so dedupe by uuid before summarizing.
    const seen = new Set();
    const merged = [];
    for (const o of [...headObjs, ...tailObjs]) {
      const k = o?.uuid;
      if (k) {
        if (seen.has(k)) continue;
        seen.add(k);
      }
      merged.push(o);
    }
    const sum = summarizeObjs(merged);
    const summaryIsLowerBound = stat.size > HEAD_BYTES + TAIL_BYTES;

    return {
      ...base,
      startedAt: meta.startedAt,
      slug: meta.slug,
      cwd: meta.cwd,
      gitBranch: meta.gitBranch,
      model: sum.model,
      permissionMode: sum.permissionMode ?? meta.permissionMode,
      lastUserPrompt: sum.lastUserPrompt,
      promptCountTail: sum.promptCount,
      promptCountIsLowerBound: summaryIsLowerBound,
      summaryIsLowerBound,
      tokensTail: sum.tokens,
      costUSD: estimateCostUSD(sum.model, sum.tokens),
      toolsUsed: [...sum.toolsUsed.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      filesTouched: [...sum.filesTouched],
      subagentCount: sum.subagentCount,
    };
  } catch {
    return base;
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** All sessions across all known folders, newest activity first. */
export const getAllSessions = cache(async () => {
  const folders = await listSessionDirs();
  const fileLists = await Promise.all(folders.map((f) => listSessionFiles(f)));

  // Flat list of {filePath, folder}
  const all = [];
  fileLists.forEach((files, i) => {
    for (const f of files) all.push({ ...f, folder: folders[i] });
  });

  // Stat first (cheap), classify recent/cold; for recent, do the head+tail read.
  const summaries = await Promise.all(all.map((entry) => summarizeOne(entry.filePath)));
  return summaries
    .filter(Boolean)
    .sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt));
});

/**
 * Cheap, stat-only pulse map enriched with the host daemon's
 * "process open" signal (Phase 10).
 *
 *   liveNow      — JSONL mtime ≤ 3 min (actively typing / tool calls)
 *   idle         — daemon sees a `claude` PID in this dir but mtime > 3 min
 *   processOpen  — daemon sees any `claude` PID in this dir (liveNow || idle)
 *   recent       — mtime ≤ 24 h (closed but written recently)
 *   pid / processStartedAt — populated when processOpen
 */
export const getSessionPulseMap = cache(async () => {
  const [folders, daemon, bridge] = await Promise.all([
    listSessionDirs(),
    getDaemonState(),
    getBridgeState(),
  ]);
  const out = {};
  await Promise.all(folders.map(async (folder) => {
    const files = await listSessionFiles(folder);
    let lastMs = 0;
    for (const f of files) {
      try {
        const s = await fs.stat(f.filePath);
        if (s.mtimeMs > lastMs) lastMs = s.mtimeMs;
      } catch { /* skip */ }
    }
    const mtimeFresh = lastMs ? (Date.now() - lastMs) <= LIVE_THRESHOLD_MS : false;
    const recent     = lastMs ? (Date.now() - lastMs) <= RECENT_THRESHOLD_MS : false;
    const proc = daemon.online ? daemon.byFolder[folder] : null;
    const bridgeSession = bridge.online ? bridge.byFolder[folder] : null;

    // Phase 12 follow-up: "liveNow" means Claude is actively working *here*,
    // not just "the JSONL was recently touched." When the daemon is online
    // and the process isn't open, the fresh mtime is the *fading echo* of a
    // session that just closed — that's `recent` (blue), not `live` (green).
    // When the daemon is offline, we fall back to mtime-only (degraded mode).
    let liveNow = daemon.online ? (mtimeFresh && !!proc) : mtimeFresh;
    let streamState = proc?.streamState ?? null;
    let lastEventAt = proc?.lastEventAt ?? null;

    // Phase 14e: bridge-known sessions get authoritative streamState. The
    // bridge sees every claude stream-json record the moment it lands, so
    // it knows in real time whether claude is thinking/responding/running
    // a tool — without waiting for JSONL writes (which only happen between
    // turns). This is what makes the sidebar dot turn amber the instant
    // a tool starts running, instead of only when the watcher catches up.
    if (bridgeSession && bridgeSession.streamState && bridgeSession.streamState !== "idle") {
      streamState = bridgeSession.streamState;
      liveNow = true;
      if (bridgeSession.lastEventAt) lastEventAt = bridgeSession.lastEventAt;
    }

    out[folder] = {
      liveNow,
      recent,
      lastActiveAt: lastMs ? new Date(lastMs).toISOString() : null,
      processOpen: !!proc || !!bridgeSession,
      idle: (!!proc || !!bridgeSession) && !liveNow,
      pid: proc?.pid ?? bridgeSession?.pid ?? null,
      processStartedAt: proc?.startedAt ?? bridgeSession?.startedAt ?? null,
      streamState,
      lastEventAt,
    };
  }));
  // Surface daemon-known folders even if there's no JSONL directory for
  // them yet (e.g. brand-new Claude session before its first message).
  if (daemon.online) {
    for (const s of daemon.sessions) {
      if (out[s.folder]) continue;
      out[s.folder] = {
        liveNow: false,
        recent: false,
        lastActiveAt: null,
        processOpen: true,
        idle: true,
        pid: s.pid,
        processStartedAt: s.startedAt,
        streamState: s.streamState ?? null,
        lastEventAt: s.lastEventAt ?? null,
      };
    }
  }
  // Same for bridge-known sessions in folders we haven't otherwise seen.
  if (bridge.online) {
    for (const s of bridge.sessions) {
      const folder = encodeCwd(s.cwd);
      if (out[folder]) continue;
      const active = s.streamState && s.streamState !== "idle";
      out[folder] = {
        liveNow: active,
        recent: false,
        lastActiveAt: s.lastEventAt || s.lastActivityAt || null,
        processOpen: true,
        idle: !active,
        pid: s.pid,
        processStartedAt: s.startedAt,
        streamState: s.streamState ?? null,
        lastEventAt: s.lastEventAt ?? null,
      };
    }
  }
  return out;
});

/**
 * Map a list of {dir} projects to their pulse entries. Builds the encoded
 * folder name from each project's dir and looks it up — never decodes.
 * @returns {Record<rel, {liveNow,lastActiveAt,recent}>}
 */
export async function getPulseForProjects(projects = []) {
  const map = await getSessionPulseMap();
  const out = {};
  for (const p of projects) {
    if (!p?.dir || !p?.rel) continue;
    const folder = projectFolder(p.dir);
    out[p.rel] = map[folder] || {
      liveNow: false,
      recent: false,
      lastActiveAt: null,
      processOpen: false,
      idle: false,
      pid: null,
      processStartedAt: null,
      streamState: null,
      lastEventAt: null,
    };
  }
  return out;
}

/** Group all sessions by their owning project (matched via dir → encodeCwd). */
export const getSessionsByProject = cache(async (projects = []) => {
  const all = await getAllSessions();
  const byFolder = new Map();
  for (const s of all) {
    // sessions in a folder have a deterministic folder name; derive from filePath.
    const folder = path.basename(path.dirname(s.filePath));
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(s);
  }
  const out = {};
  for (const p of projects) {
    if (!p?.dir || !p?.rel) continue;
    const folder = projectFolder(p.dir);
    out[p.rel] = byFolder.get(folder) || [];
  }
  return out;
});

/** Live-only summary — used by the topbar. */
export async function getLiveSessionCount() {
  const all = await getAllSessions();
  return all.filter((s) => s.isLive).length;
}
