import { getMeta, upsertMeta } from "@/lib/project-meta.js";
import { resolveRel } from "@/lib/api-paths.js";
import { revalidateProjectMetaViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { rel: relSegments } = await params;
  const rel = (relSegments || []).map(decodeURIComponent).join("/");
  const ok = resolveRel(rel);
  if (!ok) return Response.json({ error: "invalid path" }, { status: 400 });
  return Response.json({ meta: getMeta(rel) });
}

export async function PATCH(request, { params }) {
  const { rel: relSegments } = await params;
  const decoded = (relSegments || []).map(decodeURIComponent);
  const rel = decoded.join("/");
  const ok = resolveRel(rel);
  if (!ok) return Response.json({ error: "invalid path" }, { status: 400 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const meta = upsertMeta(rel, body);
    revalidateProjectMetaViews(decoded);
    return Response.json({ meta });
  } catch (err) {
    return Response.json({ error: err?.message || "update failed" }, { status: 400 });
  }
}
