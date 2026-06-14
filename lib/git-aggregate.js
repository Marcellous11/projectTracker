import { cache } from "react";
import { getRecentCommits } from "./git.js";

/**
 * Fetch recent commits across many projects with bounded concurrency so we
 * don't spawn 30+ git processes at once. Per-project results retain their
 * project metadata for downstream rendering (commits-feed module).
 */

const CONCURRENCY = 6;

async function pool(items, worker, size = CONCURRENCY) {
  const out = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * @param {Array<{dir, rel, name}>} projects
 * @param {number} perProject
 * @returns {Promise<Array<{rel, name, commit}>>} flat list of commits, each
 *   tagged with project identity. Caller may sort/limit.
 */
export const getAllRecentCommits = cache(async (projects, perProject = 5) => {
  const candidates = (projects || []).filter((p) => p && p.dir);
  const results = await pool(candidates, async (p) => {
    const g = await getRecentCommits(p.dir, perProject);
    if (!g.isRepo || !g.commits?.length) return [];
    return g.commits.map((c) => ({
      rel: p.rel,
      name: p.name,
      commit: c,
    }));
  });
  return results.flat();
});
