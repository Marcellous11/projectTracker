import path from "node:path";
import { projectsRoot } from "./scan.js";

/**
 * Confine a client-supplied `rel` to `projectsRoot()`. Returns null on
 * traversal attempts (so callers can return 400) and `{ resolved, segments }`
 * on success.
 */
export function resolveRel(rel) {
  const root = path.resolve(projectsRoot());
  const segments = String(rel || "").split("/").filter(Boolean);
  const resolved = path.resolve(path.join(root, ...segments));
  const within = resolved === root || resolved.startsWith(root + path.sep);
  return within ? { resolved, segments } : null;
}
