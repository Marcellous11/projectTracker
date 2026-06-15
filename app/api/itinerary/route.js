import { listItinerary, addItem, markAllSent, counts } from "@/lib/itinerary.js";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  return Response.json({ items: listItinerary({ status }), counts: counts() });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  // action: "send" marks all open items as sent; otherwise add a new item.
  if (body?.action === "send") {
    const changed = markAllSent();
    revalidatePath("/itinerary");
    return Response.json({ ok: true, sent: changed });
  }
  try {
    const item = addItem({ body: body?.body, project: body?.project });
    revalidatePath("/itinerary");
    return Response.json({ ok: true, item });
  } catch (err) {
    return Response.json({ error: err.message || "add failed" }, { status: 400 });
  }
}
