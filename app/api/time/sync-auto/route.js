import { syncAutoTime } from "@/lib/auto-time-sync.js";
import { revalidateTimeViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncAutoTime();
    revalidateTimeViews();
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err?.message || "sync failed" }, { status: 500 });
  }
}

// Allow GET as a convenience for browser-tab triggering.
export const GET = POST;
