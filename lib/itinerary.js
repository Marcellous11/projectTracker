import { getDb, now } from "./db.js";

// The itinerary capture queue. Plain SQLite-backed CRUD; the rows are also read
// out-of-band by Monday (OpenClaw) via scripts/itinerary-export.js so the agent
// can pick up what was captured while browsing.

const VALID = new Set(["open", "sent", "done"]);

export function listItinerary({ status, project } = {}) {
  const db = getDb();
  const where = [];
  const args = [];
  if (status && VALID.has(status)) {
    where.push("status = ?");
    args.push(status);
  }
  if (project) {
    where.push("project = ?");
    args.push(String(project));
  }
  if (where.length) {
    return db
      .prepare(
        `SELECT * FROM itinerary WHERE ${where.join(" AND ")} ORDER BY created_at DESC`
      )
      .all(...args);
  }
  // Default view: everything not yet done, newest first, with done items after.
  return db
    .prepare(
      `SELECT * FROM itinerary
       ORDER BY (status = 'done') ASC, created_at DESC`
    )
    .all();
}

export function addItem({ body, project } = {}) {
  const text = String(body || "").trim();
  if (!text) throw new Error("empty item");
  if (text.length > 2000) throw new Error("item too long");
  const db = getDb();
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO itinerary (body, project, status, created_at, updated_at)
       VALUES (?, ?, 'open', ?, ?)`
    )
    .run(text, project ? String(project).slice(0, 200) : null, ts, ts);
  return db.prepare("SELECT * FROM itinerary WHERE id = ?").get(info.lastInsertRowid);
}

export function setStatus(id, status) {
  if (!VALID.has(status)) throw new Error("bad status");
  const db = getDb();
  db.prepare("UPDATE itinerary SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now(),
    id
  );
  return db.prepare("SELECT * FROM itinerary WHERE id = ?").get(id);
}

// Mark every still-open item as sent (the "Send to Monday" button).
export function markAllSent() {
  const db = getDb();
  const info = db
    .prepare("UPDATE itinerary SET status = 'sent', updated_at = ? WHERE status = 'open'")
    .run(now());
  return info.changes;
}

export function removeItem(id) {
  getDb().prepare("DELETE FROM itinerary WHERE id = ?").run(id);
}

export function counts() {
  const db = getDb();
  const rows = db
    .prepare("SELECT status, COUNT(*) AS n FROM itinerary GROUP BY status")
    .all();
  const out = { open: 0, sent: 0, done: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}
