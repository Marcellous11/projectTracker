/**
 * Stable callsign generator. Each project gets a deterministic codename like
 * TRACKER-01 derived from its `rel` (relative path under the projects root) —
 * stable across renders so the same project always reads the same callsign
 * in the dashboard, even after STATUS.md changes.
 *
 * Format: <UPPERCASE-FIRST-TOKEN>-<2-DIGIT-HASH>
 *   token = first segment of basename split on dashes/spaces/underscores
 *   hash  = djb2(rel) mod 100
 */

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h >>> 0; // unsigned
}

function firstToken(s) {
  const base = String(s).split("/").pop() || "";
  const m = /^[A-Za-z0-9]+/.exec(base.replace(/[\s_]+/g, "-"));
  return (m ? m[0] : "PROJ").toUpperCase();
}

export function codename(rel) {
  const token = firstToken(rel);
  const num = String(djb2(rel) % 100).padStart(2, "0");
  return `${token}-${num}`;
}

/** Build a {rel -> codename} map. Convenience for batched rendering. */
export function codenameMap(projects = []) {
  const out = {};
  for (const p of projects) out[p.rel] = codename(p.rel);
  return out;
}
