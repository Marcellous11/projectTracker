import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveRel } from "@/lib/api-paths.js";
import { getLineCreationDate } from "@/lib/git.js";
import { relativeAge } from "@/lib/time.js";

export const dynamic = "force-dynamic";

/**
 * Resolves "when was this to-do created" in priority order:
 *   1. git log pickaxe (`-S "<text>"`) on the project's STATUS.md
 *   2. fs.stat mtime on STATUS.md — coarse, but real, when git can't help
 *   3. null when even the file is missing
 *
 * The dashboard's STATUS.md files are typically kept as live working files
 * rather than committed, so mtime is the common path in practice.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("rel") || "";
  const text = url.searchParams.get("text") || "";

  if (!rel) return Response.json({ error: "missing rel" }, { status: 400 });
  if (!text) return Response.json({ error: "missing text" }, { status: 400 });

  const ok = resolveRel(rel);
  if (!ok) return Response.json({ error: "invalid path" }, { status: 400 });

  const git = await getLineCreationDate(ok.resolved, "STATUS.md", text);
  if (git.iso) {
    return Response.json({ source: "git", createdAt: git.iso, ageLabel: relativeAge(git.iso) });
  }

  // Fallback: STATUS.md mtime — at least a real timestamp.
  if (git.source === "uncommitted" || git.source === "no-repo") {
    try {
      const st = await fs.stat(path.join(ok.resolved, "STATUS.md"));
      const iso = st.mtime.toISOString();
      return Response.json({ source: "mtime", createdAt: iso, ageLabel: relativeAge(iso) });
    } catch {
      // fall through
    }
  }

  return Response.json({ source: git.source, createdAt: null, ageLabel: null });
}
