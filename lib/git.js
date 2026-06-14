import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Field separator unlikely to appear in commit text.
const SEP = "\x1f";

/**
 * Read recent commits for a project directory.
 *
 * Uses `git log` with `--no-optional-locks` so it never tries to write a
 * lock/index file — safe against the read-only `/projects` mount. Returns a
 * graceful empty result when the folder isn't a git repo or git is missing.
 *
 * @returns {Promise<{isRepo: boolean, commits: Array<{hash,short,dateISO,author,subject}>, error: string|null}>}
 */
export async function getRecentCommits(dir, limit = 12) {
  // Cheap repo check first — avoids spawning git for non-repos.
  try {
    await fs.access(path.join(dir, ".git"));
  } catch {
    return { isRepo: false, commits: [], error: null };
  }

  const format = ["%H", "%cI", "%an", "%s"].join(SEP);
  try {
    const { stdout } = await run(
      "git",
      [
        "--no-optional-locks",
        "-C",
        dir,
        "log",
        `-n`,
        String(limit),
        `--pretty=format:${format}`,
      ],
      { timeout: 5000, maxBuffer: 1024 * 1024 }
    );

    const commits = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, dateISO, author, subject] = line.split(SEP);
        return { hash, short: hash?.slice(0, 7), dateISO, author, subject };
      });

    return { isRepo: true, commits, error: null };
  } catch (err) {
    // git missing, empty repo (no commits), etc. — keep the panel resilient.
    return { isRepo: true, commits: [], error: err.code || err.message };
  }
}

/**
 * Find when a specific line was first added to a file. Uses pickaxe content
 * search (`-S`) with `--diff-filter=A --reverse -n1` to land on the earliest
 * commit that introduced the line. No schema change to the file required.
 *
 * Returns `source`:
 *   - "git"         → committed; `iso` is the committer date
 *   - "uncommitted" → no commit found but the line is in the working file
 *   - "no-repo"     → project isn't a git repo
 *   - "missing"     → line isn't in the file at all (rare race)
 *
 * @param {string} dir       absolute project dir
 * @param {string} relFile   path relative to dir, e.g. "STATUS.md"
 * @param {string} text      exact line text (no leading "- [ ] ")
 */
export async function getLineCreationDate(dir, relFile, text) {
  try {
    await fs.access(path.join(dir, ".git"));
  } catch {
    return { source: "no-repo", iso: null };
  }

  // The pickaxe search uses the raw text; including the surrounding "- [ ] "
  // would miss the line after a state flip (e.g. todo → done). Search by the
  // task text alone, which doesn't change.
  const search = String(text || "").trim();
  if (!search) return { source: "missing", iso: null };

  try {
    // `-S` already restricts to commits where the line was added/removed.
    // `--diff-filter=A` would over-filter to commits that added the *file*.
    const { stdout } = await run(
      "git",
      [
        "--no-optional-locks",
        "-C", dir,
        "log",
        "-S", search,
        "--reverse",
        "-n", "1",
        "--pretty=format:%cI",
        "--", relFile,
      ],
      { timeout: 8000, maxBuffer: 1024 * 1024 }
    );
    const iso = stdout.trim().split("\n").filter(Boolean)[0] || null;
    if (iso) return { source: "git", iso };
  } catch {
    // fall through to filesystem check
  }

  // No commit found — either the line was added but not committed, or it
  // never existed. Distinguish by reading the file.
  try {
    const raw = await fs.readFile(path.join(dir, relFile), "utf8");
    return { source: raw.includes(search) ? "uncommitted" : "missing", iso: null };
  } catch {
    return { source: "missing", iso: null };
  }
}
