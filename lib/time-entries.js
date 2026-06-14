import { cache } from "react";
import { getDb, now } from "./db.js";
import { getMeta, effectiveRate } from "./project-meta.js";

const VALID_SOURCE = new Set(["manual", "auto"]);

function intOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function snapshotRate(project_rel) {
  const meta = getMeta(project_rel);
  return effectiveRate(meta);
}

/**
 * List time entries with optional filters. All filters are AND-combined.
 *
 * @param {object} f
 * @param {string} [f.project]    — exact project_rel
 * @param {number} [f.client_id]  — via project_meta
 * @param {string} [f.source]     — "manual" | "auto"
 * @param {number} [f.from]       — unix ms; rows with started_at >= from
 * @param {number} [f.to]         — unix ms; rows with started_at < to
 * @param {number} [f.limit]      — default 500
 */
export function listEntries(f = {}) {
  const db = getDb();
  const where = [];
  const args = {};
  if (f.project) { where.push("te.project_rel = @project"); args.project = f.project; }
  if (f.source) {
    if (!VALID_SOURCE.has(f.source)) throw new Error("invalid source filter");
    where.push("te.source = @source"); args.source = f.source;
  }
  if (f.client_id != null) {
    where.push("pm.client_id = @client_id");
    args.client_id = Number(f.client_id);
  }
  if (f.from != null) { where.push("te.started_at >= @from"); args.from = Number(f.from); }
  if (f.to != null) { where.push("te.started_at < @to"); args.to = Number(f.to); }
  const limit = Number.isFinite(Number(f.limit)) ? Math.max(1, Math.min(5000, Number(f.limit))) : 500;
  const sql = `
    SELECT te.*,
      pm.client_id AS pm_client_id,
      c.name AS client_name,
      c.color AS client_color
    FROM time_entries te
    LEFT JOIN project_meta pm ON pm.rel = te.project_rel
    LEFT JOIN clients c ON c.id = pm.client_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY te.started_at DESC
    LIMIT ${limit}
  `;
  return db.prepare(sql).all(args);
}

export const getEntry = cache((id) => {
  const db = getDb();
  return db.prepare(`
    SELECT te.*,
      c.name AS client_name,
      c.color AS client_color
    FROM time_entries te
    LEFT JOIN project_meta pm ON pm.rel = te.project_rel
    LEFT JOIN clients c ON c.id = pm.client_id
    WHERE te.id = ?
  `).get(Number(id)) || null;
});

/** Returns the single currently-running entry (if any), or null. Used by the topbar chip. */
export function getRunningEntry() {
  const db = getDb();
  return db.prepare(`
    SELECT te.*,
      c.name AS client_name,
      c.color AS client_color
    FROM time_entries te
    LEFT JOIN project_meta pm ON pm.rel = te.project_rel
    LEFT JOIN clients c ON c.id = pm.client_id
    WHERE te.ended_at IS NULL AND te.source = 'manual'
    ORDER BY te.started_at DESC
    LIMIT 1
  `).get() || null;
}

export function startTimer({ project_rel, note = null }) {
  if (!project_rel) throw new Error("project_rel required");
  const { rate_cents, currency } = snapshotRate(project_rel);
  const db = getDb();
  const t = now();
  try {
    const info = db.prepare(`
      INSERT INTO time_entries (project_rel, started_at, source, note, billable, rate_cents, currency, created_at, updated_at)
      VALUES (?, ?, 'manual', ?, 1, ?, ?, ?, ?)
    `).run(project_rel, t, note ? String(note).slice(0, 500) : null, rate_cents, currency, t, t);
    return getEntry(info.lastInsertRowid);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      const existing = db.prepare(
        "SELECT id FROM time_entries WHERE project_rel = ? AND ended_at IS NULL"
      ).get(project_rel);
      const e = new Error(`a timer is already running for ${project_rel}`);
      e.code = "TIMER_ALREADY_RUNNING";
      e.existingId = existing?.id ?? null;
      throw e;
    }
    throw err;
  }
}

export function stopTimer(id) {
  const db = getDb();
  const t = now();
  const info = db.prepare(`
    UPDATE time_entries
    SET ended_at = ?, updated_at = ?
    WHERE id = ? AND ended_at IS NULL
  `).run(t, t, Number(id));
  if (info.changes === 0) return null;
  return getEntry(id);
}

export function createManualEntry({ project_rel, started_at, ended_at, note = null, billable = 1, rate_cents, currency }) {
  if (!project_rel) throw new Error("project_rel required");
  const s = intOrNull(started_at);
  const e = intOrNull(ended_at);
  if (s == null) throw new Error("started_at required");
  if (e == null) throw new Error("ended_at required");
  if (e <= s) throw new Error("ended_at must be after started_at");
  let rc = intOrNull(rate_cents);
  let cy = currency ? String(currency).trim().toUpperCase() : null;
  if (rc == null) {
    const snap = snapshotRate(project_rel);
    rc = snap.rate_cents;
    if (!cy) cy = snap.currency;
  }
  if (cy && !/^[A-Z]{3}$/.test(cy)) throw new Error("currency must be 3 letters");
  const db = getDb();
  const t = now();
  const info = db.prepare(`
    INSERT INTO time_entries (project_rel, started_at, ended_at, source, note, billable, rate_cents, currency, created_at, updated_at)
    VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?)
  `).run(project_rel, s, e, note ? String(note).slice(0, 500) : null, billable ? 1 : 0, rc, cy, t, t);
  return getEntry(info.lastInsertRowid);
}

export function updateEntry(id, patch = {}) {
  const sets = [];
  const args = { id: Number(id), t: now() };
  if (patch.note !== undefined) {
    sets.push("note = @note");
    args.note = patch.note ? String(patch.note).slice(0, 500) : null;
  }
  if (patch.billable !== undefined) {
    sets.push("billable = @billable");
    args.billable = patch.billable ? 1 : 0;
  }
  if (patch.started_at !== undefined) {
    sets.push("started_at = @started_at");
    args.started_at = intOrNull(patch.started_at);
  }
  if (patch.ended_at !== undefined) {
    sets.push("ended_at = @ended_at");
    args.ended_at = intOrNull(patch.ended_at);
  }
  if (patch.rate_cents !== undefined) {
    sets.push("rate_cents = @rate_cents");
    args.rate_cents = intOrNull(patch.rate_cents);
  }
  if (patch.currency !== undefined) {
    const v = patch.currency ? String(patch.currency).trim().toUpperCase() : null;
    if (v && !/^[A-Z]{3}$/.test(v)) throw new Error("currency must be 3 letters");
    sets.push("currency = @currency");
    args.currency = v;
  }
  if (sets.length === 0) return getEntry(id);
  const db = getDb();
  db.prepare(`UPDATE time_entries SET ${sets.join(", ")}, updated_at = @t WHERE id = @id`).run(args);
  return getEntry(id);
}

export function deleteEntry(id) {
  const db = getDb();
  const info = db.prepare("DELETE FROM time_entries WHERE id = ?").run(Number(id));
  return info.changes > 0;
}

/** Sum duration_ms grouped by project_rel within a date range. */
export function totalsByProject({ from = null, to = null, billable = null } = {}) {
  const db = getDb();
  const where = ["te.ended_at IS NOT NULL"];
  const args = {};
  if (from != null) { where.push("te.started_at >= @from"); args.from = Number(from); }
  if (to != null) { where.push("te.started_at < @to"); args.to = Number(to); }
  if (billable === true)  { where.push("te.billable = 1"); }
  if (billable === false) { where.push("te.billable = 0"); }
  return db.prepare(`
    SELECT te.project_rel,
      SUM(te.duration_ms) AS total_ms,
      COUNT(*) AS entry_count
    FROM time_entries te
    WHERE ${where.join(" AND ")}
    GROUP BY te.project_rel
    ORDER BY total_ms DESC
  `).all(args);
}

/** Sum duration_ms grouped by client_id (via project_meta). */
export function totalsByClient({ from = null, to = null, billable = null } = {}) {
  const db = getDb();
  const where = ["te.ended_at IS NOT NULL"];
  const args = {};
  if (from != null) { where.push("te.started_at >= @from"); args.from = Number(from); }
  if (to != null) { where.push("te.started_at < @to"); args.to = Number(to); }
  if (billable === true)  { where.push("te.billable = 1"); }
  if (billable === false) { where.push("te.billable = 0"); }
  return db.prepare(`
    SELECT pm.client_id, c.name AS client_name, c.color AS client_color,
      SUM(te.duration_ms) AS total_ms,
      COUNT(*) AS entry_count
    FROM time_entries te
    LEFT JOIN project_meta pm ON pm.rel = te.project_rel
    LEFT JOIN clients c ON c.id = pm.client_id
    WHERE ${where.join(" AND ")}
    GROUP BY pm.client_id
    ORDER BY total_ms DESC
  `).all(args);
}
