import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import { parseTodos, todoCounts } from "./todos.js";

// Folders we never treat as projects or descend into.
const IGNORE = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vscode",
  ".idea",
]);

// Files that mark a directory as a project in its own right (vs. a grouping
// folder that just holds projects). If a folder has any of these, we treat
// the folder as one project and do NOT descend into its children.
const PROJECT_MARKERS = [
  ".git",
  "package.json",
  "README.md",
  "readme.md",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
];

const VALID_STATUS = new Set(["active", "blocked", "paused", "done"]);
const VALID_PRIORITY = new Set(["high", "medium", "low"]);

const STATUS_FILE = "STATUS.md";

/** Resolve the root folder to scan. */
export function projectsRoot() {
  return (
    process.env.PROJECTS_ROOT ||
    // Default: the parent of this dashboard folder.
    path.resolve(process.cwd(), "..")
  );
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listDirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !IGNORE.has(e.name) && !e.name.startsWith("."))
    .map((e) => e.name);
}

async function hasMarker(dir) {
  for (const m of PROJECT_MARKERS) {
    if (await exists(path.join(dir, m))) return true;
  }
  return false;
}

/**
 * Parse a STATUS.md file into a structured record. Returns a record with
 * `valid: false` and a reason if the frontmatter can't be read, so the
 * dashboard can surface the problem rather than silently dropping it.
 */
async function parseStatus(statusPath, dir, root) {
  const rel = path.relative(root, dir) || path.basename(dir);
  let raw;
  try {
    raw = await fs.readFile(statusPath, "utf8");
  } catch (err) {
    return { tracked: true, valid: false, dir, rel, error: `unreadable: ${err.message}` };
  }

  let fm, body;
  try {
    const parsed = matter(raw);
    fm = parsed.data || {};
    body = parsed.content || "";
  } catch (err) {
    return { tracked: true, valid: false, dir, rel, error: `bad frontmatter: ${err.message}` };
  }

  const warnings = [];
  const status = String(fm.status || "").trim().toLowerCase();
  const priority = String(fm.priority || "").trim().toLowerCase();
  if (!VALID_STATUS.has(status)) warnings.push(`status "${fm.status}" is not one of ${[...VALID_STATUS].join("/")}`);
  if (fm.priority && !VALID_PRIORITY.has(priority)) warnings.push(`priority "${fm.priority}" is not high/medium/low`);

  const lastWorked = normalizeDate(fm.last_worked);
  if (fm.last_worked && !lastWorked) warnings.push(`last_worked "${fm.last_worked}" is not YYYY-MM-DD`);

  const todos = parseTodos(body);

  return {
    tracked: true,
    valid: true,
    dir,
    rel,
    name: String(fm.project || path.basename(dir)),
    status: VALID_STATUS.has(status) ? status : "active",
    priority: VALID_PRIORITY.has(priority) ? priority : "medium",
    lastWorked, // Date | null
    staleDays: lastWorked ? daysBetween(lastWorked, new Date()) : null,
    nextAction: section(body, "Next action"),
    blockers: section(body, "Blockers"),
    recentlyDone: listItems(section(body, "Recently done")),
    todos,
    todoCounts: todoCounts(todos),
    warnings,
  };
}

/** A project folder with no STATUS.md yet — surfaced so it can't go dark. */
function untracked(dir, root) {
  const rel = path.relative(root, dir) || path.basename(dir);
  return {
    tracked: false,
    valid: true,
    dir,
    rel,
    name: path.basename(dir),
    status: "untracked",
    priority: "medium",
    lastWorked: null,
    staleDays: null,
    todos: [],
    todoCounts: { todo: 0, doing: 0, done: 0, open: 0 },
    warnings: [],
  };
}

/**
 * Discover projects under `root`.
 *
 * Rules (handles the mixed nesting in the projects folder):
 *  - A depth-1 folder with a STATUS.md  -> tracked project.
 *  - A depth-1 folder with a project marker (.git/README/package.json) but no
 *    STATUS.md -> single untracked project (we do NOT descend).
 *  - A depth-1 folder that is empty -> untracked project (so it stays visible).
 *  - Otherwise it's a grouping folder: descend one level and apply the same
 *    STATUS.md / untracked logic to each child.
 */
export async function scanProjects(root = projectsRoot()) {
  const out = [];
  const topDirs = await listDirs(root);

  for (const name of topDirs) {
    const dir = path.join(root, name);
    const statusPath = path.join(dir, STATUS_FILE);

    if (await exists(statusPath)) {
      out.push(await parseStatus(statusPath, dir, root));
      continue;
    }
    if (await hasMarker(dir)) {
      out.push(untracked(dir, root));
      continue;
    }

    const children = await listDirs(dir);
    if (children.length === 0) {
      out.push(untracked(dir, root)); // empty grouping — keep it on the radar
      continue;
    }
    for (const childName of children) {
      const childDir = path.join(dir, childName);
      const childStatus = path.join(childDir, STATUS_FILE);
      if (await exists(childStatus)) {
        out.push(await parseStatus(childStatus, childDir, root));
      } else {
        out.push(untracked(childDir, root));
      }
    }
  }

  return out.sort(sortKey);
}

/**
 * Per-request memoized scan. The shared (dash) layout and the overview page
 * both need the project list; `cache` collapses them to a single scan per
 * request without persisting across requests (so `force-dynamic` stays fresh).
 */
export const getScannedProjects = cache((root = projectsRoot()) => scanProjects(root));

// --- ordering -------------------------------------------------------------

// Lower rank sorts first. Blocked work demands attention, then active work
// (coldest first), then untracked, then paused, then done.
function bucket(p) {
  if (!p.valid) return 0;
  if (p.status === "blocked") return 1;
  if (p.status === "active") return 2;
  if (p.status === "untracked") return 3;
  if (p.status === "paused") return 4;
  return 5; // done
}

function sortKey(a, b) {
  const ba = bucket(a);
  const bb = bucket(b);
  if (ba !== bb) return ba - bb;
  // Within active: coldest (most stale) first.
  if (a.status === "active" && b.status === "active") {
    return (b.staleDays ?? -1) - (a.staleDays ?? -1);
  }
  return a.name.localeCompare(b.name);
}

// --- markdown helpers -----------------------------------------------------

/** Extract the body text under a `## Heading` until the next `## `. */
export function section(body, heading) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex(
    (l) => l.trim().toLowerCase() === `## ${heading.toLowerCase()}`
  );
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  const chunk = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return chunk;
}

/** Parse a markdown bullet list into an array of item strings. */
export function listItems(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
}

// --- dates ----------------------------------------------------------------

/** Accept a Date or YYYY-MM-DD string; return a Date or null. */
export function normalizeDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d) ? null : d;
}

export function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / ms);
}
