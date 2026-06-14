import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE_URL = `http://${process.env.BRIDGE_HOST || "host.docker.internal"}:${process.env.BRIDGE_PORT || "4318"}`;

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { sessionId } = body || {};
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  try {
    const upstream = await fetch(`${BRIDGE_URL}/session/stop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { error: "bridge unreachable", message: e?.message || String(e) },
      { status: 502 }
    );
  }
}
