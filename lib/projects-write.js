import { promises as fs } from "node:fs";
import path from "node:path";
import { projectsRoot } from "./scan.js";

const STATUS_FILE = "STATUS.md";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Translate a HOST cwd (the path that appears on the user's Mac and inside
 * Claude Code session JSONLs) into the CONTAINER-relative path under
 * projectsRoot(). Returns the matching rel (e.g. "timelinenews") or null
 * if the cwd is outside the host projects root.
 *
 * The dashboard runs in Docker; PROJECTS_ROOT inside the container is mounted
 * from HOST_PROJECTS_ROOT on disk. Without HOST_PROJECTS_ROOT (running on the
 * host directly), the cwd is already a container/host-coincident path so we
 * derive rel by relative path from projectsRoot().
 */
export function hostCwdToRel(hostCwd) {
  if (typeof hostCwd !== "string" || !hostCwd) return null;
  const containerRoot = process.env.PROJECTS_ROOT;
  const hostRoot = process.env.HOST_PROJECTS_ROOT;
  let containerCwd = hostCwd;
  if (hostRoot && containerRoot) {
    if (hostCwd === hostRoot) return "";
    if (!hostCwd.startsWith(hostRoot + path.sep)) return null;
    containerCwd = containerRoot + hostCwd.slice(hostRoot.length);
  }
  const root = path.resolve(projectsRoot());
  const resolved = path.resolve(containerCwd);
  if (resolved === root) return "";
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved.slice(root.length + 1);
}

/**
 * Create a minimal STATUS.md at the given rel (under projectsRoot()).
 * Errors if a STATUS.md already exists or if the dir doesn't exist —
 * caller maps these to 409 / 404.
 */
export async function scaffoldStatusMd({ rel, name = null, status = "active", priority = "medium" }) {
  const root = path.resolve(projectsRoot());
  const segments = String(rel || "").split("/").filter(Boolean);
  const resolved = path.resolve(path.join(root, ...segments));
  const within = resolved === root || resolved.startsWith(root + path.sep);
  if (!within) throw new Error("rel escapes projects root");

  // Dir must exist (we don't create arbitrary directories — only scaffold
  // a STATUS.md inside an already-checked-out project folder).
  let dirStat;
  try { dirStat = await fs.stat(resolved); }
  catch { throw Object.assign(new Error("directory not found"), { code: "ENOENT" }); }
  if (!dirStat.isDirectory()) throw new Error("path is not a directory");

  const file = path.join(resolved, STATUS_FILE);
  try {
    await fs.access(file);
    throw Object.assign(new Error("STATUS.md already exists"), { code: "EEXIST" });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const projectName = (name && String(name).trim()) || path.basename(resolved);
  const today = todayIso();
  const content =
`---
project: ${projectName}
status: ${status}
last_worked: ${today}
priority: ${priority}
---

## To do
<!-- states: [ ] = to do · [/] = in progress · [x] = done -->

## Next action

## Blockers
none

## Recently done
`;

  await fs.writeFile(file, content, "utf8");
  return { rel: segments.join("/"), file };
}

/**
 * Slugify a name for use as a folder. Kebab-case, ASCII-only, ≤ 60 chars.
 * "My Cool App!" → "my-cool-app". Returns null if nothing usable remains.
 */
export function slugifyName(name) {
  if (typeof name !== "string") return null;
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || null;
}

/**
 * Create a new project from scratch:
 *   - if `folder` is empty, derive a kebab-case slug from `name`
 *   - create the directory if it doesn't already exist
 *   - scaffold a STATUS.md inside it (errors 409 if STATUS.md already there)
 *
 * Returns { rel, file, created } where `created` indicates whether the dir
 * itself was created vs already existed.
 */
export async function scaffoldNewProject({ name, folder = null, status = "active", priority = "medium" }) {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) throw Object.assign(new Error("name required"), { code: "EVALIDATION" });

  let rel = typeof folder === "string" ? folder.trim().replace(/^\/+|\/+$/g, "") : "";
  if (!rel) {
    const slug = slugifyName(trimmedName);
    if (!slug) throw Object.assign(new Error("could not derive folder from name"), { code: "EVALIDATION" });
    rel = slug;
  }

  const root = path.resolve(projectsRoot());
  const segments = rel.split("/").filter(Boolean);
  const resolved = path.resolve(path.join(root, ...segments));
  const within = resolved === root || resolved.startsWith(root + path.sep);
  if (!within) throw Object.assign(new Error("folder escapes projects root"), { code: "EVALIDATION" });
  if (resolved === root) throw Object.assign(new Error("folder cannot be the projects root"), { code: "EVALIDATION" });

  let dirExisted;
  try {
    const st = await fs.stat(resolved);
    if (!st.isDirectory()) throw Object.assign(new Error("path exists and is not a directory"), { code: "EEXIST" });
    dirExisted = true;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    await fs.mkdir(resolved, { recursive: true });
    dirExisted = false;
  }

  const out = await scaffoldStatusMd({ rel: segments.join("/"), name: trimmedName, status, priority });
  return { ...out, created: !dirExisted };
}

