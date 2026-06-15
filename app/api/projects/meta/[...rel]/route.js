import { getMeta, upsertMeta } from "@/lib/project-meta.js";
import { resolveRel } from "@/lib/api-paths.js";
import { revalidateProjectMetaViews } from "@/lib/revalidate.js";

export const dynamic = "force-dynamic";

// GitHub-only tracked repos are addressed by a `gh:owner/name` rel. They have
// no local filesystem path, so the path-traversal guard doesn't apply — their
// meta lives entirely in SQLite, keyed by rel. We still gate normal rels.
function isGithubRel(rel) {
  return typeof rel === "string" && rel.startsWith("gh:");
}

export async function GET(_request, { params }) {
  const { rel: relSegments } = await params;
  const rel = (relSegments || []).map(decodeURIComponent).join("/");
  if (!isGithubRel(rel) && !resolveRel(rel)) {
    return Response.json({ error: "invalid path" }, { status: 400 });
  }
  return Response.json({ meta: getMeta(rel) });
}

export async function PATCH(request, { params }) {
  const { rel: relSegments } = await params;
  const decoded = (relSegments || []).map(decodeURIComponent);
  const rel = decoded.join("/");
  if (!isGithubRel(rel) && !resolveRel(rel)) {
    return Response.json({ error: "invalid path" }, { status: 400 });
  }
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
