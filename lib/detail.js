import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { section, listItems, normalizeDate, daysBetween } from "./scan.js";
import { parseTodos, todoCounts } from "./todos.js";
import { getRecentCommits } from "./git.js";

const README_NAMES = ["README.md", "readme.md", "Readme.md"];
const README_CAP = 60_000; // guard against huge READMEs

async function readFirst(dir, names) {
  for (const n of names) {
    try {
      return await fs.readFile(path.join(dir, n), "utf8");
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Build the rich detail payload for one project directory: the full STATUS.md
 * (frontmatter + untruncated body), the README, and recent git commits.
 *
 * @returns {Promise<object>} see shape below
 */
export async function getProjectDetail(dir) {
  const rel = path.basename(dir);

  // --- STATUS.md (may be absent for untracked projects) ---
  let fm = {};
  let body = "";
  let hasStatus = false;
  try {
    const raw = await fs.readFile(path.join(dir, "STATUS.md"), "utf8");
    const parsed = matter(raw);
    fm = parsed.data || {};
    body = parsed.content?.trim() || "";
    hasStatus = true;
  } catch {
    hasStatus = false;
  }

  const lastWorked = normalizeDate(fm.last_worked);

  // --- README ---
  const readmeRaw = await readFirst(dir, README_NAMES);
  const readme = {
    present: Boolean(readmeRaw),
    content: readmeRaw ? readmeRaw.slice(0, README_CAP) : null,
  };

  // --- git activity ---
  const git = await getRecentCommits(dir);

  const todos = hasStatus ? parseTodos(body) : [];

  return {
    ok: true,
    dir,
    rel,
    name: String(fm.project || rel),
    hasStatus,
    status: hasStatus ? String(fm.status || "active").toLowerCase() : "untracked",
    priority: hasStatus ? String(fm.priority || "medium").toLowerCase() : null,
    lastWorked: lastWorked ? lastWorked.toISOString() : null,
    staleDays: lastWorked ? daysBetween(lastWorked, new Date()) : null,
    statusMarkdown: hasStatus ? body : null,
    nextAction: hasStatus ? section(body, "Next action") : "",
    blockers: hasStatus ? section(body, "Blockers") : "",
    recentlyDone: hasStatus ? listItems(section(body, "Recently done")) : [],
    todos,
    todoCounts: todoCounts(todos),
    readme,
    git,
  };
}
