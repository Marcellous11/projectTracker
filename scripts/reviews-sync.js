#!/usr/bin/env node
// reviews-sync.js — gather Day/Week/Month context (calendar + email + project
// activity), have the cheap single-shot LLM (mm.sh) compose six summaries
// (each period × {looking back, looking ahead}), and write data/reviews.json.
//
// The dashboard /review page reads that snapshot (fast, no shelling out at
// request time); a systemd timer re-runs this every few hours to keep it fresh.
//
// Design rules (mirror github-sync.js):
//   - Atomic write (tmp + rename) so the page never reads a half-written file.
//   - NEVER throw — every data source degrades to empty on any failure/timeout.
//   - One-line status to stderr at the end.
//
// Data sources (Pi tools, shelled out via execFile, ANSI stripped):
//   Calendar : gcal-venv/bin/gcalcli --nocolor agenda <START> <END>
//   Email    : triage-emails.sh (kept rows) else himalaya envelope list (back only)
//   Projects : data/github-state.json (recentCommits filtered to window; openPRs)
//   AI       : mm.sh (single-shot LLM, 60s timeout, returns text)

import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";

const ROOT = process.cwd();
const OUT = process.env.REVIEWS_PATH || path.join(ROOT, "data", "reviews.json");
const GH_STATE = process.env.GITHUB_STATE_PATH || path.join(ROOT, "data", "github-state.json");
const MM = process.env.MM_PATH || "/home/marcellous11/.openclaw/mm.sh";
const GCALCLI = process.env.GCALCLI_PATH || "/home/marcellous11/.openclaw/gcal-venv/bin/gcalcli";
const TRIAGE = process.env.TRIAGE_PATH || "/home/marcellous11/.openclaw/triage-emails.sh";
const HIMALAYA = process.env.HIMALAYA_PATH || "/home/marcellous11/.local/bin/himalaya";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANSI = /\x1b\[[0-9;]*m/g;
function stripAnsi(s) {
  return String(s || "").replace(ANSI, "");
}

// Promise-wrapped execFile that NEVER rejects — resolves to stdout (ANSI
// stripped) or "" on any error/timeout/empty.
function run(cmd, args, timeout = 30000) {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout, maxBuffer: 1 << 22 }, (err, stdout) => {
        if (err && !stdout) return resolve("");
        resolve(stripAnsi(stdout).trim());
      });
    } catch {
      resolve("");
    }
  });
}

// Local YYYY-MM-DD in America/Chicago, offset by N days from today.
function ymd(daysOffset = 0) {
  const now = new Date();
  // Shift to Chicago wall-clock first, then offset whole days.
  const chicago = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  chicago.setDate(chicago.getDate() + daysOffset);
  const y = chicago.getFullYear();
  const m = String(chicago.getMonth() + 1).padStart(2, "0");
  const d = String(chicago.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// First day of the current month (Chicago), YYYY-MM-DD.
function firstOfMonth() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function agenda(start, end) {
  return run(GCALCLI, ["--nocolor", "agenda", start, end], 30000);
}

// Email — ONLY for "looking back". Prefer the triage helper (kept rows); fall
// back to a raw recent inbox slice. Returns "" if nothing useful.
let EMAIL_BACK = null; // memoized — same recent slice feeds day/week/month back
async function emailBack() {
  if (EMAIL_BACK != null) return EMAIL_BACK;
  let out = "";
  if (fs.existsSync(TRIAGE)) {
    out = await run(TRIAGE, [], 90000);
    // The triage script prints a header even when empty; treat the
    // "nothing important"/"unavailable" sentinels as empty.
    if (/nothing important|\[unavailable\]/i.test(out)) out = "";
  }
  if (!out && fs.existsSync(HIMALAYA)) {
    out = await run(HIMALAYA, ["envelope", "list", "-a", "gmail", "-s", "30"], 30000);
  }
  EMAIL_BACK = out || "";
  return EMAIL_BACK;
}

// Project activity from the github-sync snapshot.
function loadRepos() {
  try {
    const d = JSON.parse(fs.readFileSync(GH_STATE, "utf8"));
    return Array.isArray(d.repos) ? d.repos : [];
  } catch {
    return [];
  }
}

// Commits in [sinceISO, now] across all repos → flat list of {label, message, date}.
function commitsSince(repos, sinceISO) {
  const since = +new Date(sinceISO);
  const out = [];
  for (const r of repos) {
    if (r.error || !Array.isArray(r.recentCommits)) continue;
    for (const c of r.recentCommits) {
      const t = c.date ? +new Date(c.date) : NaN;
      if (Number.isFinite(t) && t >= since) {
        out.push({ label: r.label || r.repo, message: c.message, date: c.date });
      }
    }
  }
  out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return out;
}

// Open PRs across all repos → flat list of {label, number, title, draft}.
// Used for "likely to complete" in the look-aheads.
function openPRs(repos) {
  const out = [];
  for (const r of repos) {
    if (r.error || !Array.isArray(r.openPRs)) continue;
    for (const p of r.openPRs) {
      out.push({ label: r.label || r.repo, number: p.number, title: p.title, draft: p.draft, url: p.url });
    }
  }
  return out;
}

function commitLines(commits, limit = 30) {
  return commits.slice(0, limit).map((c) => `- [${c.label}] ${c.message}`).join("\n");
}
function prLines(prs) {
  return prs.map((p) => `- [${p.label}] #${p.number} ${p.title}${p.draft ? " (draft)" : ""}`).join("\n");
}

// Compose one summary via mm.sh. Returns the bullet string or null. Never throws.
async function compose(context) {
  const body = context.trim();
  if (!body) return null;
  const prompt =
    "Respond with 3-6 short bullet points, one line each, each starting with \"- \". " +
    "Be concrete and specific. No preamble, no headers, no closing line — just the bullets. " +
    "Skip empty or boilerplate items. " +
    body;
  const out = await run(MM, [prompt], 60000);
  return out || null;
}

// ---------------------------------------------------------------------------
// Period builders
// ---------------------------------------------------------------------------

const BACK_INTRO =
  "Write a recap of what happened during this period for a busy CS student / developer / job-seeker, " +
  "drawing on his calendar events, important emails, and project (code) activity below.\n\n";
const AHEAD_INTRO =
  "Write a look-ahead for the upcoming period for a busy CS student / developer / job-seeker. " +
  "Cover his upcoming calendar events and which projects look likely to finish soon " +
  "(judge from open pull requests and recent commit activity).\n\n";

function backContext({ label, eventsText, emailText, commits }) {
  let ctx = BACK_INTRO + `PERIOD: ${label} (looking back).\n\n`;
  ctx += "CALENDAR EVENTS:\n" + (eventsText || "(none)") + "\n\n";
  ctx += "IMPORTANT EMAIL:\n" + (emailText || "(none)") + "\n\n";
  ctx += "PROJECT ACTIVITY (commits, newest first):\n" + (commitLines(commits) || "(none)") + "\n";
  return ctx;
}

function aheadContext({ label, eventsText, commits, prs }) {
  let ctx = AHEAD_INTRO + `PERIOD: ${label} (looking ahead).\n\n`;
  ctx += "UPCOMING CALENDAR EVENTS:\n" + (eventsText || "(none)") + "\n\n";
  ctx += "OPEN PULL REQUESTS (candidates to complete):\n" + (prLines(prs) || "(none)") + "\n\n";
  ctx += "RECENT COMMIT VELOCITY (newest first):\n" + (commitLines(commits, 20) || "(none)") + "\n";
  return ctx;
}

async function main() {
  const repos = loadRepos();
  const today = ymd(0);
  const tomorrow = ymd(1);

  // --- Window boundaries (Chicago, YYYY-MM-DD) ---
  const weekAgo = ymd(-7);
  const monthStart = firstOfMonth();
  const in7 = ymd(7);
  const in31 = ymd(31);

  // --- Calendar (gathered in parallel) ---
  const [
    dayBackEvents,
    weekBackEvents,
    monthBackEvents,
    dayAheadEvents,
    weekAheadEvents,
    monthAheadEvents,
    emailText,
  ] = await Promise.all([
    agenda(today, tomorrow),
    agenda(weekAgo, tomorrow),
    agenda(monthStart, tomorrow),
    agenda(tomorrow, ymd(2)),
    agenda(tomorrow, in7),
    agenda(today, in31),
    emailBack(),
  ]);

  // --- Project activity windows ---
  const dayCommits = commitsSince(repos, today + "T00:00:00");
  const weekCommits = commitsSince(repos, weekAgo + "T00:00:00");
  const monthCommits = commitsSince(repos, monthStart + "T00:00:00");
  const prs = openPRs(repos);

  // --- Build context per half ---
  const ctx = {
    day: {
      back: backContext({ label: "today", eventsText: dayBackEvents, emailText, commits: dayCommits }),
      ahead: aheadContext({ label: "tomorrow", eventsText: dayAheadEvents, commits: weekCommits, prs }),
    },
    week: {
      back: backContext({ label: "the last 7 days", eventsText: weekBackEvents, emailText, commits: weekCommits }),
      ahead: aheadContext({ label: "the next 7 days", eventsText: weekAheadEvents, commits: weekCommits, prs }),
    },
    month: {
      back: backContext({ label: "this month so far", eventsText: monthBackEvents, emailText, commits: monthCommits }),
      ahead: aheadContext({ label: "the next ~month", eventsText: monthAheadEvents, commits: monthCommits, prs }),
    },
  };

  // --- Compose all six (sequential — keeps the local LLM unsaturated) ---
  const out = { generatedAt: new Date().toISOString() };
  for (const period of ["day", "week", "month"]) {
    const back = await compose(ctx[period].back);
    const ahead = await compose(ctx[period].ahead);
    out[period] = {
      back,
      ahead,
      context: {
        backEvents:
          period === "day" ? dayBackEvents : period === "week" ? weekBackEvents : monthBackEvents,
        aheadEvents:
          period === "day" ? dayAheadEvents : period === "week" ? weekAheadEvents : monthAheadEvents,
        commits: (period === "day" ? dayCommits : period === "week" ? weekCommits : monthCommits).slice(0, 12),
        prs: prs.slice(0, 12),
      },
    };
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = OUT + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
  fs.renameSync(tmp, OUT); // atomic

  const filled = ["day", "week", "month"].reduce(
    (n, p) => n + (out[p].back ? 1 : 0) + (out[p].ahead ? 1 : 0),
    0
  );
  console.error(`reviews-sync: ${filled}/6 summaries composed -> ${OUT}`);
}

main();
