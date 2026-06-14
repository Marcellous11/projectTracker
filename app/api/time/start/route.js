import { cookies } from "next/headers";
import { startTimer } from "@/lib/time-entries.js";
import { resolveRel } from "@/lib/api-paths.js";
import { revalidateTimeViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

export const TIMER_COOKIE = "tracker_timer";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const rel = String(body?.project_rel || "").trim();
  if (!rel) return Response.json({ error: "project_rel required" }, { status: 400 });
  const ok = resolveRel(rel);
  if (!ok) return Response.json({ error: "invalid project_rel" }, { status: 400 });
  try {
    const entry = startTimer({ project_rel: rel, note: body?.note ?? null });
    const jar = await cookies();
    jar.set(TIMER_COOKIE, JSON.stringify({
      entry_id: entry.id,
      project_rel: entry.project_rel,
      started_at: entry.started_at,
    }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30d
    });
    revalidateTimeViews(ok.segments);
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    if (err?.code === "TIMER_ALREADY_RUNNING") {
      return Response.json({ error: err.message, existingId: err.existingId }, { status: 409 });
    }
    return Response.json({ error: err?.message || "start failed" }, { status: 400 });
  }
}
