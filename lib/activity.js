import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { getScannedProjects } from "./scan.js";
import { getAllRecentCommits } from "./git-aggregate.js";
import { getAllSessions, projectFolder } from "./sessions.js";
import { getQuakes } from "./external/quakes.js";
import { getTopHn } from "./external/hn.js";
import { getInfraStatus } from "./external/infra.js";
import { getKp } from "./external/space-weather.js";

/**
 * Merged activity stream — commits + sessions + STATUS.md mtime markers,
 * one chronological feed per request. Powers the Live Activity Ticker,
 * the Activity Heatmap, and the per-project Timeline.
 *
 * STATUS.md is surfaced only as a single "updated" event per mtime change
 * (no diffing — would require snapshotting prior versions). It's tagged
 * low-emphasis so the streak math can ignore it.
 */

/** @typedef {{
 *   ts: string,
 *   type: "commit"|"session"|"status"|"quake"|"hn"|"infra"|"space",
 *   projectRel: string, projectName: string, message: string,
 *   payload?: object
 * }} ActivityEvent
 *
 * External event types use a synthetic projectRel of `"//external/<source>"`
 * and projectName of the source tag (`USGS`, `HN`, etc.). The ticker renders
 * them with the same row layout — the rel column becomes a source label.
 */

function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

async function statMtime(p) {
  try { return (await fs.stat(p)).mtime.toISOString(); }
  catch { return null; }
}

async function commitEvents(projects, perProject) {
  const rows = await getAllRecentCommits(projects, perProject);
  return rows.map((r) => ({
    ts: r.commit.dateISO,
    type: "commit",
    projectRel: r.rel,
    projectName: r.name,
    message: r.commit.subject,
    payload: { hash: r.commit.short, author: r.commit.author, fullHash: r.commit.hash },
  }));
}

function sessionEvents(sessions, projectsByFolder) {
  const out = [];
  for (const s of sessions) {
    const folder = path.basename(path.dirname(s.filePath));
    const p = projectsByFolder.get(folder);
    if (!p) continue; // unmatched (could be a deleted project) — drop for now
    if (s.startedAt) {
      out.push({
        ts: s.startedAt,
        type: "session",
        projectRel: p.rel,
        projectName: p.name,
        message: s.slug
          ? `claude session started · ${s.slug}`
          : `claude session started`,
        payload: { sessionId: s.sessionId, slug: s.slug, kind: "started", filePath: s.filePath },
      });
    }
    // Emit "active" event only when it's a meaningfully different timestamp
    // (more than 5 min after start, or a different day).
    if (s.lastActivityAt && s.lastActivityAt !== s.startedAt) {
      const startMs = s.startedAt ? +new Date(s.startedAt) : 0;
      const lastMs = +new Date(s.lastActivityAt);
      if (lastMs - startMs > 5 * 60 * 1000) {
        out.push({
          ts: s.lastActivityAt,
          type: "session",
          projectRel: p.rel,
          projectName: p.name,
          message: s.slug
            ? `claude session active · ${s.slug}`
            : `claude session active`,
          payload: { sessionId: s.sessionId, slug: s.slug, kind: "active", filePath: s.filePath },
        });
      }
    }
  }
  return out;
}

async function statusEvents(projects, sinceMs) {
  const out = [];
  await Promise.all(projects.map(async (p) => {
    if (!p?.dir || !p?.rel) return;
    const ts = await statMtime(path.join(p.dir, "STATUS.md"));
    if (!ts) return;
    if (+new Date(ts) < sinceMs) return;
    out.push({
      ts,
      type: "status",
      projectRel: p.rel,
      projectName: p.name,
      message: "STATUS.md updated",
    });
  }));
  return out;
}

/* ------------------------------------------------------------------ *
 * External producers — each wraps a lib/external/* call in try-graceful
 * shape. They never throw; missing data → empty list. Synthetic projectRel
 * keeps the ticker rendering layout consistent.
 * ------------------------------------------------------------------ */

async function quakeEvents(sinceMs) {
  const rows = await getQuakes();
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((q) => q?.ts && +new Date(q.ts) >= sinceMs)
    .map((q) => ({
      ts: q.ts,
      type: "quake",
      projectRel: "//external/usgs",
      projectName: "USGS",
      message: `M${q.mag.toFixed(1)} · ${q.place}`,
      payload: { id: q.id, mag: q.mag, place: q.place, url: q.url },
    }));
}

async function hnEvents(sinceMs) {
  const rows = await getTopHn();
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((h) => h?.ts && +new Date(h.ts) >= sinceMs)
    .map((h) => ({
      ts: h.ts,
      type: "hn",
      projectRel: "//external/hn",
      projectName: "HN",
      message: `${h.title} · ${h.score}↑`,
      payload: { id: h.id, url: h.url, score: h.score },
    }));
}

async function infraEvents(sinceMs) {
  const services = await getInfraStatus();
  if (!Array.isArray(services)) return [];
  const out = [];
  for (const svc of services) {
    for (const inc of svc.incidents || []) {
      if (!inc?.ts) continue;
      if (+new Date(inc.ts) < sinceMs) continue;
      out.push({
        ts: inc.ts,
        type: "infra",
        projectRel: `//external/${svc.name}`,
        projectName: svc.name.toUpperCase(),
        message: `${inc.impact.toUpperCase()} · ${inc.name}`,
        payload: { id: inc.id, service: svc.name, impact: inc.impact, url: inc.url },
      });
    }
  }
  return out;
}

async function spaceEvents(sinceMs) {
  const kp = await getKp();
  if (!kp || !kp.storm || !kp.ts) return [];
  if (+new Date(kp.ts) < sinceMs) return [];
  return [{
    ts: kp.ts,
    type: "space",
    projectRel: "//external/swpc",
    projectName: "SWPC",
    message: `Kp ${kp.kp.toFixed(1)} · geomagnetic storm`,
    payload: { kp: kp.kp },
  }];
}

async function safeExternalProducers(sinceMs) {
  const results = await Promise.allSettled([
    quakeEvents(sinceMs),
    hnEvents(sinceMs),
    infraEvents(sinceMs),
    spaceEvents(sinceMs),
  ]);
  const out = [];
  for (const r of results) if (r.status === "fulfilled") out.push(...r.value);
  return out;
}

function capPerSourcePerProject(events, perProject) {
  if (!perProject) return events;
  const seen = new Map(); // key = `${type}:${projectRel}` → count
  return events.filter((e) => {
    const k = `${e.type}:${e.projectRel}`;
    const n = seen.get(k) || 0;
    if (n >= perProject) return false;
    seen.set(k, n + 1);
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const getActivityFeed = cache(async (opts = {}) => {
  const {
    perSourcePerProject = 8,
    maxTotal = 200,
    sinceDays = 30,
  } = opts;
  const sinceMs = Date.now() - sinceDays * 86400 * 1000;

  const projects = await getScannedProjects();
  const sessions = await getAllSessions();
  const projectsByFolder = new Map();
  for (const p of projects) {
    if (p?.dir) projectsByFolder.set(projectFolder(p.dir), p);
  }

  const [commits, status, external] = await Promise.all([
    commitEvents(projects, perSourcePerProject),
    statusEvents(projects, sinceMs),
    safeExternalProducers(sinceMs),
  ]);
  const ses = sessionEvents(sessions, projectsByFolder);

  let all = [...commits, ...ses, ...status, ...external]
    .filter((e) => e.ts && +new Date(e.ts) >= sinceMs)
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts));

  all = capPerSourcePerProject(all, perSourcePerProject);
  if (all.length > maxTotal) all = all.slice(0, maxTotal);
  return all;
});

export const getProjectActivity = cache(async (projectDir, opts = {}) => {
  const { sinceDays = 60, maxTotal = 120 } = opts;
  const sinceMs = Date.now() - sinceDays * 86400 * 1000;

  const projects = await getScannedProjects();
  const project = projects.find((p) => p?.dir === projectDir);
  if (!project) return [];

  const sessions = await getAllSessions();
  const folder = projectFolder(project.dir);
  const ours = sessions.filter((s) => path.basename(path.dirname(s.filePath)) === folder);
  const projectsByFolder = new Map([[folder, project]]);

  const [commits, status] = await Promise.all([
    commitEvents([project], 30),
    statusEvents([project], sinceMs),
  ]);
  const ses = sessionEvents(ours, projectsByFolder);

  return [...commits, ...ses, ...status]
    .filter((e) => e.ts && +new Date(e.ts) >= sinceMs)
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    .slice(0, maxTotal);
});

/**
 * Daily activity buckets for the heatmap. STATUS.md events are intentionally
 * excluded from the count — they're a mtime proxy, not a measure of work.
 */
export const getDailyActivity = cache(async (days = 84) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startMs = +start;

  // Build empty buckets for every day so the heatmap is gap-free.
  const buckets = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(dayKey(d), { date: dayKey(d), count: 0, commits: 0, sessions: 0 });
  }

  const feed = await getActivityFeed({ perSourcePerProject: 200, maxTotal: 10000, sinceDays: days });
  for (const e of feed) {
    if (!e.ts) continue;
    const t = +new Date(e.ts);
    if (t < startMs) continue;
    const k = dayKey(e.ts);
    const b = buckets.get(k);
    if (!b) continue;
    if (e.type === "commit") { b.count++; b.commits++; }
    else if (e.type === "session") { b.count++; b.sessions++; }
    // status events are intentionally not counted
  }
  return Array.from(buckets.values());
});

/** Current consecutive-day streak ending today (or yesterday, allowing a 1d grace). */
export async function getStreak(days = 84) {
  const daily = await getDailyActivity(days);
  // walk backward from the most recent day
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].count > 0) streak++;
    else if (streak === 0 && i === daily.length - 1) continue; // allow today to be empty
    else break;
  }
  let longest = 0, run = 0;
  for (const d of daily) {
    if (d.count > 0) { run++; longest = Math.max(longest, run); }
    else run = 0;
  }
  return { streak, longest };
}
