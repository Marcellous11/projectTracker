import { cache } from "react";
import { unstable_cache } from "next/cache";

/**
 * Shared fetch primitives for all lib/external/* sources.
 *
 * Two layers of caching: React `cache()` for per-request memoization (a single
 * server render touching the same source twice fires once), and `unstable_cache`
 * for cross-request TTL (a busy ticker poll doesn't hammer NOAA).
 *
 * `safeFetch` never throws — failures, timeouts, and non-2xx all collapse to
 * `null`. Callers must treat null as "no signal" and render a dim placeholder
 * rather than an error boundary.
 */

const DEFAULT_TIMEOUT_MS = 2000;

export async function safeFetch(url, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, parse = "json" } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "project-tracker/1.0 (+local)", ...(headers || {}) },
      // Bypass Next's built-in fetch cache; we use unstable_cache for that.
      cache: "no-store",
    });
    if (!res.ok) return null;
    if (parse === "text") return await res.text();
    if (parse === "raw")  return res;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Wrap a fetcher so it's:
 *   1. memoized per request (React cache)
 *   2. revalidated cross-request after `revalidate` seconds (unstable_cache)
 *
 * The unstable_cache key includes a versioned prefix so deploys can invalidate
 * by bumping the version (we don't expose that here — yet).
 */
// Bump when a fetcher's parse logic changes — busts any persisted cache
// entries that may contain stale-shape values (e.g. .next/cache surviving
// a container restart on a named volume).
const CACHE_VERSION = "v3";

export function makeCached(name, fetcher, revalidate, extraKey = []) {
  const cached = unstable_cache(
    async (...args) => {
      try { return await fetcher(...args); }
      catch { return null; }
    },
    ["external", CACHE_VERSION, name, ...extraKey],
    { revalidate, tags: [`external:${name}`] }
  );
  return cache(async (...args) => cached(...args));
}
