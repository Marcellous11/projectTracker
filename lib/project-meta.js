import { cache } from "react";
import { getDb, now } from "./db.js";

function normalizeInput(patch = {}) {
  const out = {};
  if (patch.client_id !== undefined) {
    if (patch.client_id == null || patch.client_id === "") out.client_id = null;
    else {
      const n = Number(patch.client_id);
      if (!Number.isInteger(n) || n < 1) throw new Error("invalid client_id");
      out.client_id = n;
    }
  }
  if (patch.rate_cents !== undefined) {
    if (patch.rate_cents == null || patch.rate_cents === "") out.rate_cents = null;
    else {
      const n = Number(patch.rate_cents);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) throw new Error("rate out of range");
      out.rate_cents = Math.round(n);
    }
  }
  if (patch.currency !== undefined) {
    const v = patch.currency == null ? null : String(patch.currency).trim().toUpperCase();
    if (v && !/^[A-Z]{3}$/.test(v)) throw new Error("currency must be 3 letters");
    out.currency = v || null;
  }
  if (patch.codename !== undefined) {
    const v = patch.codename == null ? null : String(patch.codename).trim();
    if (v && v.length > 40) throw new Error("codename too long");
    out.codename = v || null;
  }
  if (patch.notes !== undefined) {
    const v = patch.notes == null ? null : String(patch.notes);
    if (v && v.length > 5000) throw new Error("notes too long");
    out.notes = v || null;
  }
  if (patch.archived_at !== undefined) {
    if (patch.archived_at === false || patch.archived_at == null) out.archived_at = null;
    else if (patch.archived_at === true) out.archived_at = Date.now();
    else {
      const n = Number(patch.archived_at);
      if (!Number.isFinite(n)) throw new Error("invalid archived_at");
      out.archived_at = Math.round(n);
    }
  }
  return out;
}

/** Joined read: project_meta + client snapshot for that rel. Null if no row yet. */
export const getMeta = cache((rel) => {
  if (!rel) return null;
  const db = getDb();
  return db.prepare(`
    SELECT pm.*,
      c.id   AS client_id_resolved,
      c.name AS client_name,
      c.color AS client_color,
      c.default_rate_cents AS client_default_rate_cents,
      c.default_currency   AS client_default_currency
    FROM project_meta pm
    LEFT JOIN clients c ON c.id = pm.client_id
    WHERE pm.rel = ?
  `).get(rel) || null;
});

/** All meta rows, joined with their client. Used for dashboard groupings. */
export const listMeta = cache(() => {
  const db = getDb();
  return db.prepare(`
    SELECT pm.*,
      c.name AS client_name,
      c.color AS client_color,
      c.default_rate_cents AS client_default_rate_cents,
      c.default_currency AS client_default_currency
    FROM project_meta pm
    LEFT JOIN clients c ON c.id = pm.client_id
  `).all();
});

/** {rel -> meta} keyed map for cheap per-row lookup. */
export const metaByRel = cache(() => {
  const rows = listMeta();
  const out = {};
  for (const r of rows) out[r.rel] = r;
  return out;
});

export function upsertMeta(rel, patch) {
  if (!rel) throw new Error("rel required");
  const data = normalizeInput(patch);
  const db = getDb();
  const t = now();
  const existing = db.prepare("SELECT rel FROM project_meta WHERE rel = ?").get(rel);
  if (existing) {
    const keys = Object.keys(data);
    if (keys.length === 0) return getMeta(rel);
    const sets = keys.map((k) => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE project_meta SET ${sets}, updated_at = @t WHERE rel = @rel`).run({
      ...data, t, rel,
    });
  } else {
    db.prepare(`
      INSERT INTO project_meta (rel, client_id, rate_cents, currency, codename, notes, archived_at, created_at, updated_at)
      VALUES (@rel, @client_id, @rate_cents, @currency, @codename, @notes, @archived_at, @t, @t)
    `).run({
      rel,
      client_id: data.client_id ?? null,
      rate_cents: data.rate_cents ?? null,
      currency: data.currency ?? null,
      codename: data.codename ?? null,
      notes: data.notes ?? null,
      archived_at: data.archived_at ?? null,
      t,
    });
  }
  return getMeta(rel);
}

/** rows whose rel is no longer present on disk (for orphan reconciliation UI). */
export function findOrphans(scannedRels) {
  const db = getDb();
  const all = db.prepare("SELECT rel FROM project_meta").all().map((r) => r.rel);
  const known = new Set(scannedRels);
  return all.filter((r) => !known.has(r));
}

/** Resolve the effective billable rate: project override → client default → null. */
export function effectiveRate(meta) {
  if (!meta) return { rate_cents: null, currency: null };
  return {
    rate_cents: meta.rate_cents ?? meta.client_default_rate_cents ?? null,
    currency: meta.currency || meta.client_default_currency || "USD",
  };
}
