import { cache } from "react";
import { getDb, now } from "./db.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalizeInput(patch = {}) {
  const out = {};
  if (patch.name !== undefined) {
    const v = String(patch.name).trim();
    if (!v) throw new Error("name required");
    if (v.length > 120) throw new Error("name too long");
    out.name = v;
  }
  if (patch.color !== undefined) {
    const v = patch.color == null ? null : String(patch.color).trim();
    if (v && !HEX.test(v)) throw new Error("color must be #rrggbb");
    out.color = v || null;
  }
  if (patch.contact_email !== undefined) {
    const v = patch.contact_email == null ? null : String(patch.contact_email).trim();
    if (v && v.length > 200) throw new Error("email too long");
    out.contact_email = v || null;
  }
  if (patch.contact_phone !== undefined) {
    const v = patch.contact_phone == null ? null : String(patch.contact_phone).trim();
    if (v && v.length > 50) throw new Error("phone too long");
    out.contact_phone = v || null;
  }
  if (patch.default_rate_cents !== undefined) {
    const v = patch.default_rate_cents;
    if (v == null || v === "") out.default_rate_cents = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) throw new Error("rate out of range");
      out.default_rate_cents = Math.round(n);
    }
  }
  if (patch.default_currency !== undefined) {
    const v = patch.default_currency == null ? null : String(patch.default_currency).trim().toUpperCase();
    if (v && !/^[A-Z]{3}$/.test(v)) throw new Error("currency must be 3 letters");
    out.default_currency = v || null;
  }
  if (patch.notes !== undefined) {
    const v = patch.notes == null ? null : String(patch.notes);
    if (v && v.length > 5000) throw new Error("notes too long");
    out.notes = v || null;
  }
  if (patch.country !== undefined) {
    const v = patch.country == null ? null : String(patch.country).trim().toUpperCase();
    if (v && !/^[A-Z]{2}$/.test(v)) throw new Error("country must be ISO-2");
    out.country = v || null;
  }
  if (patch.tz !== undefined) {
    const v = patch.tz == null ? null : String(patch.tz).trim();
    if (v && v.length > 60) throw new Error("tz too long");
    out.tz = v || null;
  }
  return out;
}

export const listClients = cache(() => {
  const db = getDb();
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM project_meta pm WHERE pm.client_id = c.id) AS project_count
    FROM clients c
    ORDER BY LOWER(c.name)
  `).all();
});

export const getClient = cache((id) => {
  const db = getDb();
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(Number(id)) || null;
});

export function createClient(input) {
  const data = normalizeInput(input);
  if (!data.name) throw new Error("name required");
  const db = getDb();
  const t = now();
  const info = db.prepare(`
    INSERT INTO clients (name, color, contact_email, contact_phone, default_rate_cents, default_currency, notes, country, tz, created_at, updated_at)
    VALUES (@name, @color, @contact_email, @contact_phone, @default_rate_cents, @default_currency, @notes, @country, @tz, @t, @t)
  `).run({
    name: data.name,
    color: data.color ?? null,
    contact_email: data.contact_email ?? null,
    contact_phone: data.contact_phone ?? null,
    default_rate_cents: data.default_rate_cents ?? null,
    default_currency: data.default_currency ?? "USD",
    notes: data.notes ?? null,
    country: data.country ?? null,
    tz: data.tz ?? null,
    t,
  });
  return getClient(info.lastInsertRowid);
}

export function updateClient(id, patch) {
  const data = normalizeInput(patch);
  const keys = Object.keys(data);
  if (keys.length === 0) return getClient(id);
  const db = getDb();
  const sets = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE clients SET ${sets}, updated_at = @t WHERE id = @id`).run({
    ...data,
    t: now(),
    id: Number(id),
  });
  return getClient(id);
}

export function deleteClient(id) {
  const db = getDb();
  const info = db.prepare("DELETE FROM clients WHERE id = ?").run(Number(id));
  return info.changes > 0;
}
