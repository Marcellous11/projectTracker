#!/usr/bin/env node
// Pull live state for every tracked repo from the GitHub API and write a
// snapshot to data/github-state.json. The dashboard reads that snapshot (fast,
// no per-request API calls); a systemd timer re-runs this every few minutes so
// the snapshot stays current. GitHub is the source of truth for repo state.
//
// Auth: GH_TOKEN (or GITHUB_TOKEN) from the environment. The systemd unit loads
// it via EnvironmentFile=.env.local. Without a token, public repos still work
// (lower rate limit); private repos report an error.

import path from "node:path";
import fs from "node:fs";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "config", "repos.json");
const OUT = process.env.GITHUB_STATE_PATH || path.join(ROOT, "data", "github-state.json");
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "command-central-tracker",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function gh(url) {
  const res = await fetch(`https://api.github.com${url}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`GitHub ${res.status} ${url}`);
    err.status = res.status;
    err.body = body.slice(0, 200);
    throw err;
  }
  return res.json();
}

function summarizeChecks(runs) {
  if (!runs?.length) return { state: "none", total: 0, failed: 0, pending: 0 };
  let failed = 0;
  let pending = 0;
  for (const r of runs) {
    if (r.status !== "completed") pending++;
    else if (["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion)) failed++;
  }
  const state = failed > 0 ? "failure" : pending > 0 ? "pending" : "success";
  return { state, total: runs.length, failed, pending };
}

async function fetchRepo(entry) {
  const { repo, project = null, label = null } = entry;
  const base = { repo, project, label: label || repo.split("/")[1] };
  try {
    const info = await gh(`/repos/${repo}`);
    const branch = info.default_branch;

    const [commits, pulls] = await Promise.all([
      gh(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=15`).catch(() => []),
      gh(`/repos/${repo}/pulls?state=open&per_page=20&sort=updated&direction=desc`).catch(() => []),
    ]);
    const commitList = Array.isArray(commits) ? commits : [];
    const head = commitList[0] || null;
    const recentCommits = commitList.map((c) => ({
      sha: (c.sha || "").slice(0, 7),
      message: (c.commit?.message || "").split("\n")[0].slice(0, 140),
      author: c.commit?.author?.name || c.author?.login || "?",
      date: c.commit?.author?.date || null,
      url: c.html_url,
    }));

    let ci = { state: "none", total: 0, failed: 0, pending: 0 };
    if (head?.sha) {
      const checks = await gh(`/repos/${repo}/commits/${head.sha}/check-runs`).catch(() => null);
      if (checks?.check_runs) ci = summarizeChecks(checks.check_runs);
    }

    return {
      ...base,
      private: !!info.private,
      defaultBranch: branch,
      pushedAt: info.pushed_at,
      openIssues: info.open_issues_count,
      lastCommit: head
        ? {
            sha: head.sha.slice(0, 7),
            message: (head.commit?.message || "").split("\n")[0].slice(0, 140),
            author: head.commit?.author?.name || head.author?.login || "?",
            date: head.commit?.author?.date || info.pushed_at,
            url: head.html_url,
          }
        : null,
      openPRs: (Array.isArray(pulls) ? pulls : []).map((p) => ({
        number: p.number,
        title: p.title,
        draft: p.draft,
        updatedAt: p.updated_at,
        url: p.html_url,
      })),
      recentCommits,
      ci,
      url: info.html_url,
      fetchedAt: new Date().toISOString(),
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      error: err.status ? `${err.status} ${err.body || ""}`.trim() : err.message,
      fetchedAt: new Date().toISOString(),
    };
  }
}

async function main() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch (err) {
    console.error("cannot read config/repos.json:", err.message);
    process.exit(1);
  }
  const entries = cfg.repos || [];

  // Sequential-ish: small set, and keeps us well under rate limits.
  const repos = [];
  for (const e of entries) repos.push(await fetchRepo(e));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    authed: !!TOKEN,
    repos,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
  fs.renameSync(tmp, OUT); // atomic — the dashboard never reads a half-written file

  const ok = repos.filter((r) => !r.error).length;
  console.error(`github-sync: ${ok}/${repos.length} repos OK -> ${OUT}`);
}

main();
