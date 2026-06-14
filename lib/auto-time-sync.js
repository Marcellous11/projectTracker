import { getDb, now } from "./db.js";
import { getScannedProjects } from "./scan.js";
import { getSessionsByProject } from "./sessions.js";

/**
 * Roll up Claude session activity into `time_entries` (source='auto').
 *
 * Reuses the forward mapping in lib/sessions.js — for each scanned project,
 * `getSessionsByProject` returns the sessions whose folder name matches
 * `projectFolder(p.dir)`. We never reverse-decode session folder names
 * (that's ambiguous because real paths contain hyphens).
 *
 * Upsert by sessionId: a session JSONL grows over the lifetime of a Claude
 * Code conversation, so ended_at + last_synced_at update in place.
 */
export async function syncAutoTime() {
  const projects = await getScannedProjects();
  const byRel = await getSessionsByProject(projects);
  const db = getDb();
  const t = now();

  const upsert = db.prepare(`
    INSERT INTO time_entries (
      project_rel, started_at, ended_at, source, session_id,
      note, billable, rate_cents, currency, last_synced_at, created_at, updated_at
    )
    VALUES (@project_rel, @started_at, @ended_at, 'auto', @session_id,
            @note, 0, NULL, NULL, @last_synced_at, @created_at, @updated_at)
    ON CONFLICT(session_id) WHERE source = 'auto' DO UPDATE SET
      ended_at = excluded.ended_at,
      note = COALESCE(excluded.note, time_entries.note),
      last_synced_at = excluded.last_synced_at,
      updated_at = excluded.updated_at
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const tx = db.transaction((batch) => {
    for (const row of batch) {
      const existing = db.prepare(
        "SELECT id, updated_at FROM time_entries WHERE session_id = ? AND source = 'auto'"
      ).get(row.session_id);
      upsert.run(row);
      if (existing) updated++;
      else inserted++;
    }
  });

  const batch = [];
  for (const p of projects) {
    if (!p?.rel) continue;
    const sessions = byRel[p.rel] || [];
    for (const s of sessions) {
      if (!s?.sessionId || !s?.startedAt || !s?.lastActivityAt) { skipped++; continue; }
      const start = +new Date(s.startedAt);
      const end = +new Date(s.lastActivityAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { skipped++; continue; }
      const note = s.lastUserPrompt ? String(s.lastUserPrompt).slice(0, 200) : null;
      batch.push({
        project_rel: p.rel,
        started_at: start,
        ended_at: end,
        session_id: s.sessionId,
        note,
        last_synced_at: t,
        created_at: t,
        updated_at: t,
      });
    }
  }

  if (batch.length) tx(batch);

  return { inserted, updated, skipped, total: batch.length, ranAt: t };
}
