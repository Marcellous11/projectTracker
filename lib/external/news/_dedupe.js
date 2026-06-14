/**
 * Cross-source dedupe for news articles. Two checks:
 *   1. Canonical URL match (strips query, fragment, www., trailing slash).
 *   2. Normalized-title near-match (lowercase, no punctuation, first 8 words).
 *
 * When a duplicate is found, the higher-priority source wins (AP > Reuters >
 * NPR > BBC > GDELT > Reddit > Wikipedia). Items keep their original `ts`
 * (we don't pick the freshest — wire stories that get republished should
 * still show the original timestamp).
 */

// Priority tiebreak when two sources surface the same wire story (higher
// wins). Phase 9 swapped the dead AP/Reuters feeds for Google News (tag USA)
// and Al Jazeera (tag AJZ); kept legacy AP/RTRS entries so the table also
// fits any old cached items.
const PRIORITY = { AP: 6, USA: 6, RTRS: 5, AJZ: 5, NPR: 4, BBC: 3, GDLT: 2, RDDT: 1, WCE: 0 };

function canonUrl(url) {
  if (typeof url !== "string") return "";
  try {
    const u = new URL(url);
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    let path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function normTitle(t) {
  if (typeof t !== "string") return "";
  return t
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

/**
 * @param {Array<{id?:string,source:string,title:string,url:string,ts:string,scope?:string,summary?:string}>} items
 * @returns deduped list, sorted by original index when no tie.
 */
export function dedupe(items) {
  if (!Array.isArray(items) || items.length < 2) return items || [];
  const byUrl = new Map();
  const byTitle = new Map();
  const out = [];

  for (const it of items) {
    if (!it?.title || !it?.url) continue;
    const cu = canonUrl(it.url);
    const nt = normTitle(it.title);
    const existingUrl = cu ? byUrl.get(cu) : null;
    const existingTitle = nt ? byTitle.get(nt) : null;
    const existing = existingUrl ?? existingTitle;

    if (existing) {
      const incomingP = PRIORITY[it.source] ?? 0;
      const existingP = PRIORITY[existing.source] ?? 0;
      if (incomingP > existingP) {
        // Swap in place: remove the older entry from out + indices, add new.
        const idx = out.indexOf(existing);
        if (idx >= 0) out[idx] = it;
        if (cu) byUrl.set(cu, it);
        if (nt) byTitle.set(nt, it);
      }
      // else: drop the duplicate silently
    } else {
      out.push(it);
      if (cu) byUrl.set(cu, it);
      if (nt) byTitle.set(nt, it);
    }
  }
  return out;
}
