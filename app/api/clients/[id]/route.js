import { getClient, updateClient, deleteClient } from "@/lib/clients.js";
import { revalidateClientViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

function parseId(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) return Response.json({ error: "invalid id" }, { status: 400 });
  const client = getClient(n);
  if (!client) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ client });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) return Response.json({ error: "invalid id" }, { status: 400 });
  if (!getClient(n)) return Response.json({ error: "not found" }, { status: 404 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const client = updateClient(n, body);
    revalidateClientViews();
    return Response.json({ client });
  } catch (err) {
    const msg = err?.message || "update failed";
    const status = msg.includes("UNIQUE") ? 409 : 400;
    return Response.json({ error: msg }, { status });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) return Response.json({ error: "invalid id" }, { status: 400 });
  const ok = deleteClient(n);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  revalidateClientViews();
  return Response.json({ ok: true });
}
