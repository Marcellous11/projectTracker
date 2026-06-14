import { getEntry, updateEntry, deleteEntry } from "@/lib/time-entries.js";
import { revalidateTimeViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

function parseId(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function segmentsFor(entry) {
  return entry?.project_rel ? entry.project_rel.split("/") : [];
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) return Response.json({ error: "invalid id" }, { status: 400 });
  const entry = getEntry(n);
  if (!entry) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ entry });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) return Response.json({ error: "invalid id" }, { status: 400 });
  const before = getEntry(n);
  if (!before) return Response.json({ error: "not found" }, { status: 404 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const entry = updateEntry(n, body);
    revalidateTimeViews(segmentsFor(entry));
    return Response.json({ entry });
  } catch (err) {
    return Response.json({ error: err?.message || "update failed" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) return Response.json({ error: "invalid id" }, { status: 400 });
  const before = getEntry(n);
  if (!before) return Response.json({ error: "not found" }, { status: 404 });
  const ok = deleteEntry(n);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  revalidateTimeViews(segmentsFor(before));
  return Response.json({ ok: true });
}
