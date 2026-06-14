import { cache } from "react";
import { getApHeadlines } from "./news/ap.js";
import { getNprHeadlines } from "./news/npr.js";
import { getBbcHeadlines } from "./news/bbc.js";
import { getReutersHeadlines } from "./news/reuters.js";
import { getRedditHeadlines } from "./news/reddit.js";
import { getGdeltHeadlines } from "./news/gdelt.js";
import { getWikipediaHeadlines } from "./news/wikipedia.js";
import { dedupe } from "./news/_dedupe.js";

/**
 * Unified news entry. Fetches every enabled source in parallel via
 * Promise.allSettled (one source down ≠ all down), dedupes, sorts.
 *
 * `scope`:
 *   - "local" | "federal" | "world" | "context" → just that slice
 *   - "all" (default) → everything
 *
 * `mix: true` → interleave by source so the topbar rotation doesn't show
 *   five AP headlines in a row before the first NPR one. Used by the chip.
 *
 * `limit` defaults to 30 (good for the /news panel). Topbar passes 6.
 */
export const getHeadlines = cache(async (opts = {}) => {
  const { scope = "all", limit = 30, mix = false } = opts;

  const results = await Promise.allSettled([
    getApHeadlines(),
    getNprHeadlines(),
    getBbcHeadlines(),
    getReutersHeadlines(),
    getRedditHeadlines(),
    getGdeltHeadlines(),
    getWikipediaHeadlines(),
  ]);
  let all = [];
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) all.push(...r.value);
  }

  // Filter to scope.
  if (scope !== "all") {
    all = all.filter((a) => a.scope === scope);
  }

  // Dedupe across sources (URL + title heuristics).
  all = dedupe(all);

  // Sort: newest first, with WCE pushed to the bottom (it's daily-flat).
  all.sort((a, b) => {
    if (a.scope === "context" && b.scope !== "context") return 1;
    if (b.scope === "context" && a.scope !== "context") return -1;
    return +new Date(b.ts) - +new Date(a.ts);
  });

  if (mix) {
    // Round-robin by source so consecutive items aren't the same source.
    const buckets = new Map();
    for (const a of all) {
      if (!buckets.has(a.source)) buckets.set(a.source, []);
      buckets.get(a.source).push(a);
    }
    const ordered = [];
    let done = false;
    while (!done) {
      done = true;
      for (const bucket of buckets.values()) {
        if (bucket.length) {
          ordered.push(bucket.shift());
          done = false;
        }
      }
    }
    all = ordered;
  }

  return all.slice(0, limit);
});

/** Convenience: counts per source after dedupe — used by the /news header. */
export async function getHeadlineCounts() {
  const all = await getHeadlines({ scope: "all", limit: 1000 });
  const counts = { local: 0, federal: 0, world: 0, context: 0 };
  for (const a of all) {
    if (counts[a.scope] != null) counts[a.scope]++;
  }
  return counts;
}
