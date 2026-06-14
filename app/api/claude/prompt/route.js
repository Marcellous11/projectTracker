import { NextResponse } from "next/server";
import { toHostPath } from "@/lib/sessions.js";

/**
 * Browser → Next.js → host bridge daemon → real `claude` CLI on host.
 *
 * Request:  POST { cwd, prompt, sessionId? }
 *   - `cwd` arrives as a container-side path (e.g. /projects/Active/foo);
 *     we translate it to the host equivalent using the same toHostPath()
 *     the dashboard already uses for session-folder lookup, so the path
 *     passed to `claude` matches what the user would type in a terminal.
 *
 * Response: text/event-stream (SSE). Each line of the host bridge's NDJSON
 *   becomes one `data: <json>\n\n` frame. The client's `req.signal` is
 *   forwarded to the upstream fetch — when the browser aborts, the bridge's
 *   `req.on('close')` fires and SIGINTs the claude process.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE_HOST = process.env.BRIDGE_HOST || "host.docker.internal";
const BRIDGE_PORT = process.env.BRIDGE_PORT || "4318";
const BRIDGE_URL  = `http://${BRIDGE_HOST}:${BRIDGE_PORT}`;

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { cwd: rawCwd, prompt, sessionId } = body || {};
  if (!rawCwd || typeof rawCwd !== "string") {
    return NextResponse.json({ error: "cwd required" }, { status: 400 });
  }
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const hostCwd = toHostPath(rawCwd);

  let upstream;
  try {
    upstream = await fetch(`${BRIDGE_URL}/spawn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: hostCwd, prompt, sessionId }),
      signal: req.signal,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "bridge unreachable", url: BRIDGE_URL, message: e?.message || String(e) },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "bridge rejected", status: upstream.status, body: text.slice(0, 1024) },
      { status: 502 }
    );
  }

  // Pipe NDJSON → SSE. Each whole line from the bridge becomes one
  // `data: <line>\n\n` event. The encoder works on Uint8Array so we never
  // materialize the full stream in memory.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  const sseStream = upstream.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line) controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
    },
    flush(controller) {
      const tail = buf.trim();
      if (tail) controller.enqueue(encoder.encode(`data: ${tail}\n\n`));
    },
  }));

  return new Response(sseStream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
