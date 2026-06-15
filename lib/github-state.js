import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

// Reads the github-sync snapshot. The dashboard never calls the GitHub API at
// request time — the systemd timer keeps this file fresh.
const STATE_PATH =
  process.env.GITHUB_STATE_PATH ||
  path.resolve(process.cwd(), "data/github-state.json");

const STALE_MS = 30 * 60 * 1000; // 30 min without a sync = considered stale

export const getGithubState = cache(() => {
  try {
    const d = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const ageMs = d.generatedAt ? Date.now() - new Date(d.generatedAt).getTime() : null;
    return {
      ok: true,
      generatedAt: d.generatedAt,
      authed: !!d.authed,
      ageMs,
      stale: ageMs == null || ageMs > STALE_MS,
      repos: d.repos || [],
    };
  } catch {
    return { ok: false, generatedAt: null, authed: false, ageMs: null, stale: true, repos: [] };
  }
});

// Map keyed by local project rel, for merging GitHub state onto project cards.
export const getGithubByProject = cache(() => {
  const { repos } = getGithubState();
  const out = {};
  for (const r of repos) if (r.project) out[r.project] = r;
  return out;
});
