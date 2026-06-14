import { NextResponse } from "next/server";
import { getActivityFeed } from "@/lib/activity.js";

// Always fresh — we want the ticker to reflect new commits/sessions.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get("max")) || 30, 100);
  const sinceDays = Math.min(Number(url.searchParams.get("days")) || 14, 60);

  try {
    const events = await getActivityFeed({ maxTotal: max, sinceDays });
    return NextResponse.json({ ok: true, count: events.length, events });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
