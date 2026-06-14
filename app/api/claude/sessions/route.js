import { NextResponse } from "next/server";
import { toHostPath } from "@/lib/sessions.js";

/**
 * GET /api/claude/sessions[?cwd=X]
 *
 * Lists active long-lived sessions from the host bridge. If `cwd` is
 * provided (container path), we translate to host path and return only the
 * matching session (or empty). Used by the panel on mount to discover an
 * existing session for its project and reconnect to it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE_URL = `http://${process.env.BRIDGE_HOST || "host.docker.internal"}:${process.env.BRIDGE_PORT || "4318"}`;

export async function GET(req) {
  const url = new URL(req.url);
  const rawCwd = url.searchParams.get("cwd");
  const wantHostCwd = rawCwd ? toHostPath(rawCwd) : null;

  let upstream;
  try {
    upstream = await fetch(`${BRIDGE_URL}/sessions`);
  } catch (e) {
    return NextResponse.json(
      { error: "bridge unreachable", message: e?.message || String(e) },
      { status: 502 }
    );
  }
  const payload = await upstream.json().catch(() => ({ sessions: [] }));
  let sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  if (wantHostCwd) sessions = sessions.filter((s) => s.cwd === wantHostCwd && !s.exited);

  return NextResponse.json({ sessions });
}
