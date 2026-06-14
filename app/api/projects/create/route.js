import { revalidatePath } from "next/cache";
import { scaffoldNewProject } from "@/lib/projects-write.js";

export const dynamic = "force-dynamic";

/**
 * Create a brand-new project (not bound to an existing session).
 * Body: { name: string, folder?: string, status?: string, priority?: string }
 *   - name        required, e.g. "My Cool App"
 *   - folder      optional, rel path under projectsRoot(); defaults to slug(name)
 *   - status      "active" | "blocked" | "paused" | "done" — default "active"
 *   - priority    "high" | "medium" | "low" — default "medium"
 *
 * Side effects:
 *   - Creates the folder if it doesn't exist (mkdir -p).
 *   - Writes STATUS.md scaffold inside.
 *   - Revalidates the dashboard so the new project appears immediately.
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  try {
    const out = await scaffoldNewProject({
      name: body?.name,
      folder: body?.folder ?? null,
      status: body?.status ?? "active",
      priority: body?.priority ?? "medium",
    });
    revalidatePath("/");
    revalidatePath("/todos");
    revalidatePath("/clients");
    revalidatePath("/time");
    revalidatePath(`/p/${out.rel.split("/").map(encodeURIComponent).join("/")}`);
    return Response.json({ rel: out.rel, created: out.created }, { status: 201 });
  } catch (err) {
    const code = err?.code;
    if (code === "EVALIDATION") return Response.json({ error: err.message }, { status: 400 });
    if (code === "EEXIST")      return Response.json({ error: err.message, rel: err.rel }, { status: 409 });
    return Response.json({ error: err?.message || "create failed" }, { status: 500 });
  }
}
