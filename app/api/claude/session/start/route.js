import { NextResponse } from "next/server";
import { toHostPath } from "@/lib/sessions.js";

/**
 * POST { cwd } — proxy to host bridge `/session/start`. Translates container
 * /projects/... to the host equivalent so the spawned claude runs in the
 * directory the user would see if they typed `claude` in a terminal.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE_URL = `http://${process.env.BRIDGE_HOST || "host.docker.internal"}:${process.env.BRIDGE_PORT || "4318"}`;

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { cwd: rawCwd, resumeId } = body || {};
  if (!rawCwd || typeof rawCwd !== "string") {
    return NextResponse.json({ error: "cwd required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BRIDGE_URL}/session/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: toHostPath(rawCwd), resumeId: resumeId || undefined }),
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { error: "bridge unreachable", url: BRIDGE_URL, message: e?.message || String(e) },
      { status: 502 }
    );
  }
}
