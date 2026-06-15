import { setStatus, removeItem } from "@/lib/itinerary.js";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const item = setStatus(Number(id), String(body?.status));
    revalidatePath("/itinerary");
    return Response.json({ ok: true, item });
  } catch (err) {
    return Response.json({ error: err.message || "update failed" }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  removeItem(Number(id));
  revalidatePath("/itinerary");
  return Response.json({ ok: true });
}
