import { listEntries, createManualEntry } from "@/lib/time-entries.js";
import { resolveRel } from "@/lib/api-paths.js";
import { revalidateTimeViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const f = {};
  const project = searchParams.get("project");
  if (project) f.project = project;
  const client = searchParams.get("client_id");
  if (client) f.client_id = Number(client);
  const source = searchParams.get("source");
  if (source) f.source = source;
  const from = searchParams.get("from");
  if (from) f.from = Number(from);
  const to = searchParams.get("to");
  if (to) f.to = Number(to);
  const limit = searchParams.get("limit");
  if (limit) f.limit = Number(limit);
  try {
    return Response.json({ entries: listEntries(f) });
  } catch (err) {
    return Response.json({ error: err?.message || "list failed" }, { status: 400 });
  }
}

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
    const entry = createManualEntry({ ...body, project_rel: rel });
    revalidateTimeViews(ok.segments);
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err?.message || "create failed" }, { status: 400 });
  }
}
