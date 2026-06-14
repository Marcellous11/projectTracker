import { cookies } from "next/headers";
import { stopTimer, getRunningEntry } from "@/lib/time-entries.js";
import { revalidateTimeViews } from "@/lib/revalidate.js";
import { TIMER_COOKIE } from "../start/route.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const jar = await cookies();
  let id = body?.id ? Number(body.id) : null;
  if (!id) {
    const raw = jar.get(TIMER_COOKIE)?.value;
    if (raw) {
      try { id = Number(JSON.parse(raw)?.entry_id) || null; } catch { id = null; }
    }
  }
  if (!id) {
    const running = getRunningEntry();
    if (running) id = running.id;
  }
  if (!id) return Response.json({ error: "no running timer" }, { status: 404 });
  const entry = stopTimer(id);
  jar.delete(TIMER_COOKIE);
  if (!entry) return Response.json({ error: "no running timer" }, { status: 404 });
  revalidateTimeViews(entry.project_rel?.split("/"));
  return Response.json({ entry });
}
