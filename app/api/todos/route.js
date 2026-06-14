import { appendTodo } from "@/lib/todos-write.js";
import { updateTodoState } from "@/lib/todos-update.js";
import { resolveRel, revalidateAllTodoViews } from "@/lib/api-paths.js";

export const dynamic = "force-dynamic";

const VALID_STATES = new Set(["todo", "doing", "done"]);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const rel = String(body?.rel || "").trim();
  const text = String(body?.text || "").trim();
  if (!rel) return Response.json({ error: "missing rel" }, { status: 400 });
  if (!text) return Response.json({ error: "empty to-do" }, { status: 400 });
  if (text.length > 500) return Response.json({ error: "to-do too long" }, { status: 400 });

  const ok = resolveRel(rel);
  if (!ok) return Response.json({ error: "invalid path" }, { status: 400 });

  try {
    await appendTodo(ok.resolved, text);
  } catch (err) {
    return Response.json({ error: err.message || "write failed" }, { status: 500 });
  }

  revalidateAllTodoViews(ok.segments);
  return Response.json({ ok: true });
}

export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const rel = String(body?.rel || "").trim();
  const text = String(body?.text || "").trim();
  const fromState = String(body?.fromState || "").trim();
  const toState = String(body?.toState || "").trim();

  if (!rel) return Response.json({ error: "missing rel" }, { status: 400 });
  if (!text) return Response.json({ error: "missing text" }, { status: 400 });
  if (!VALID_STATES.has(fromState) || !VALID_STATES.has(toState)) {
    return Response.json({ error: "invalid state" }, { status: 400 });
  }
  if (fromState === toState) return Response.json({ ok: true });

  const ok = resolveRel(rel);
  if (!ok) return Response.json({ error: "invalid path" }, { status: 400 });

  try {
    await updateTodoState(ok.resolved, text, fromState, toState);
  } catch (err) {
    return Response.json({ error: err.message || "update failed" }, { status: 500 });
  }

  revalidateAllTodoViews(ok.segments);
  return Response.json({ ok: true });
}
