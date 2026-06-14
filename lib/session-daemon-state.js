import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

/**
 * Reader for the host-side session watcher daemon's snapshot file
 * (scripts/session-watcher.js). React `cache()`-wrapped so one render
 * touches the file once.
 *
 * `online` means the snapshot is fresh — daemon wrote within STALE_MS
 * (default 30s). Older or missing → callers fall back to mtime-only
 * pulse and the topbar shows a "⊘ daemon offline" indicator.
 */

const DAEMON_FILE = path.resolve(process.cwd(), "data", "live-sessions.json");
const STALE_MS    = 30 * 1000;

export const getDaemonState = cache(async () => {
  try {
    const raw = await fs.readFile(DAEMON_FILE, "utf8");
    const data = JSON.parse(raw);
    const tsMs = +new Date(data?.ts);
    if (!Number.isFinite(tsMs)) return offline();
    const ageMs = Date.now() - tsMs;
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const byFolder = {};
    for (const s of sessions) {
      if (!s?.folder) continue;
      // First-write-wins: keep the oldest PID if multiple processes share a cwd.
      if (!byFolder[s.folder]) byFolder[s.folder] = s;
      else if (s.startedAt && byFolder[s.folder].startedAt &&
               +new Date(s.startedAt) < +new Date(byFolder[s.folder].startedAt)) {
        byFolder[s.folder] = s;
      }
    }
    return {
      online: ageMs <= STALE_MS && !data.shutdownAt,
      ageMs,
      ts: data.ts,
      sessions,
      byFolder,
    };
  } catch {
    return offline();
  }
});

function offline() {
  return { online: false, ageMs: null, ts: null, sessions: [], byFolder: {} };
}
