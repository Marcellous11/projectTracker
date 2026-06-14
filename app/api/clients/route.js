import { listClients, createClient } from "@/lib/clients.js";
import { revalidateClientViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ clients: listClients() });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const client = createClient(body);
    revalidateClientViews();
    return Response.json({ client }, { status: 201 });
  } catch (err) {
    const msg = err?.message || "create failed";
    const status = msg.includes("UNIQUE") ? 409 : 400;
    return Response.json({ error: msg }, { status });
  }
}
