import { revalidatePath } from "next/cache";
import { hostCwdToRel, scaffoldStatusMd } from "@/lib/projects-write.js";

export const dynamic = "force-dynamic";

/**
 * Start tracking a directory as a project by scaffolding a STATUS.md.
 * Body: { cwd: string (host abs path), name?: string }
 *   - `cwd` is the host path from a session's JSONL or the daemon snapshot.
 *   - `name` overrides the auto-derived basename.
 * Returns: { rel } on success.
 *
 * Behavior:
 *   - cwd outside HOST_PROJECTS_ROOT → 400.
 *   - dir doesn't exist (mount mismatch) → 404.
 *   - STATUS.md already exists → 409 (idempotent: client treats as success).
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  const cwd = body?.cwd ? String(body.cwd) : "";
  const name = body?.name ? String(body.name).trim() : null;
  if (!cwd) return Response.json({ error: "cwd required" }, { status: 400 });

  const rel = hostCwdToRel(cwd);
  if (rel === null) {
    return Response.json(
      { error: "cwd is outside the projects root — can't track from here" },
      { status: 400 }
    );
  }
  if (rel === "") {
    return Response.json({ error: "refuse to scaffold STATUS.md at the projects root" }, { status: 400 });
  }

  try {
    const out = await scaffoldStatusMd({ rel, name });
    // Refresh every surface that lists projects so the new entry appears.
    revalidatePath("/");
    revalidatePath("/todos");
    revalidatePath("/clients");
    revalidatePath("/time");
    revalidatePath(`/p/${out.rel.split("/").map(encodeURIComponent).join("/")}`);
    return Response.json({ rel: out.rel }, { status: 201 });
  } catch (err) {
    if (err.code === "ENOENT") {
      return Response.json({ error: "directory not found inside container — check PROJECTS_ROOT mount" }, { status: 404 });
    }
    if (err.code === "EEXIST") {
      return Response.json({ error: "already tracked", rel }, { status: 409 });
    }
    return Response.json({ error: err.message || "scaffold failed" }, { status: 500 });
  }
}
