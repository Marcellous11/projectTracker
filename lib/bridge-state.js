import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { encodeCwd } from "./sessions.js";

/**
 * Reader for the prompt-bridge daemon's snapshot file
 * (scripts/prompt-bridge.js). React `cache()`-wrapped so one render
 * touches the file once.
 *
 * Per-session record shape (mirrors the bridge):
 *   { sessionId, claudeSessionId, cwd, pid, startedAt,
 *     lastActivityAt, lastEventAt, streamState }
 *
 * streamState ∈ {idle, thinking, responding, tool} — the bridge sets
 * this from the moment claude emits each stream-json record, so the
 * dashboard reflects browser-launched sessions in near-real-time without
 * having to wait for JSONL writes (which only land between turns).
 *
 * `online` means the snapshot is fresh — bridge wrote within STALE_MS.
 */

const STATE_FILE = path.resolve(process.cwd(), "data", "prompt-bridge.json");
const STALE_MS   = 30 * 1000;

export const getBridgeState = cache(async () => {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const data = JSON.parse(raw);
    const tsMs = +new Date(data?.ts);
    if (!Number.isFinite(tsMs)) return offline();
    const ageMs = Date.now() - tsMs;
    const list = Array.isArray(data.activeSessions) ? data.activeSessions : [];
    // Key by encoded folder name so callers can intersect with the
    // JSONL pulse map keyed the same way.
    const byFolder = {};
    for (const s of list) {
      if (!s?.cwd) continue;
      const folder = encodeCwd(s.cwd);
      // Newest-activity-wins if two bridge sessions share a cwd.
      const prev = byFolder[folder];
      if (!prev) { byFolder[folder] = s; continue; }
      const a = +new Date(s.lastEventAt || s.lastActivityAt || s.startedAt);
      const b = +new Date(prev.lastEventAt || prev.lastActivityAt || prev.startedAt);
      if (a > b) byFolder[folder] = s;
    }
    return {
      online: ageMs <= STALE_MS && !data.shutdownAt,
      ageMs,
      ts: data.ts,
      sessions: list,
      byFolder,
    };
  } catch {
    return offline();
  }
});

function offline() {
  return { online: false, ageMs: null, ts: null, sessions: [], byFolder: {} };
}
