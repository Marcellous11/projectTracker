import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { getScannedProjects, projectsRoot, daysBetween } from "./scan.js";
import { getGithubState } from "./github-state.js";

// The tracked-repos roster config. `project` ties a repo to a local checkout
// (by scanned `rel`); null = GitHub-only (no local checkout).
const CONFIG_PATH =
  process.env.REPOS_CONFIG_PATH ||
  path.resolve(process.cwd(), "config/repos.json");

const ACTIVE_WINDOW_DAYS = 14;

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return Array.isArray(raw.repos) ? raw.repos : [];
  } catch {
    return [];
  }
}

/** Whole days since an ISO timestamp, or null if unparseable. */
function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return daysBetween(d, new Date());
}

/**
 * Derive a status for a GitHub-only repo from its github-state entry.
 *  - github error or no entry      -> "untracked"
 *  - pushed within ACTIVE_WINDOW   -> "active"
 *  - otherwise                     -> "paused"
 */
function deriveStatus(gh) {
  if (!gh || gh.error) return "untracked";
  const days = daysSince(gh.pushedAt);
  if (days == null) return "untracked";
  return days <= ACTIVE_WINDOW_DAYS ? "active" : "paused";
}

/**
 * Build the project roster from `config/repos.json` instead of a raw
 * filesystem scan. The SET and ORDER come from the config; for each entry we
 * either reuse the matching scanned project (full STATUS.md/git data) or
 * synthesize a minimal object with the same shape so downstream modules don't
 * crash on GitHub-only repos.
 *
 * Returns objects shaped like `getScannedProjects` output, each additionally
 * carrying: `tracked: true`, `repo`, `github`, `hasLocal`, and a friendly
 * `name` from the config label.
 */
export const getTrackedProjects = cache(async (root = projectsRoot()) => {
  const config = readConfig();
  const scanned = await getScannedProjects(root);
  const byRel = new Map(scanned.map((p) => [p.rel, p]));

  const { repos: ghRepos } = getGithubState();
  const ghByRepo = new Map(ghRepos.map((r) => [r.repo, r]));

  const out = [];
  for (const entry of config) {
    const gh = ghByRepo.get(entry.repo) || null;
    const local = entry.project ? byRel.get(entry.project) : null;

    let base;
    if (local) {
      // Reuse the full scanned object (STATUS.md + git data).
      base = { ...local, hasLocal: true };
    } else {
      // GitHub-only: synthesize a minimal object with the scanned shape. Leave
      // STATUS.md-derived fields (nextAction/blockers/lastWorked/todos) absent
      // so next-actions/blockers/etc. skip it, and omit `dir`/`valid` so the
      // git-commit aggregator and STATUS modules don't pick it up.
      base = {
        rel: entry.project || `gh:${entry.repo}`,
        name: entry.label,
        status: deriveStatus(gh),
        staleDays: daysSince(gh?.pushedAt),
        todoCounts: { open: 0 },
        todos: [],
        hasLocal: false,
      };
    }

    out.push({
      ...base,
      name: entry.label, // always prefer the friendly config label
      tracked: true,
      repo: entry.repo,
      github: gh,
    });
  }

  return out;
});
