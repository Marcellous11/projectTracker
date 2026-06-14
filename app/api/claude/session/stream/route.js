/**
 * GET /api/claude/session/stream?sessionId=X
 *
 * Open an SSE connection that proxies the host bridge's `/session/stream`
 * (NDJSON, one stream-json record per line). On connect the bridge replays
 * the session's transcript, then continues with live events. Same NDJSON →
 * SSE TransformStream we use in /api/claude/prompt — each whole line becomes
 * one `data: <json>\n\n` frame.
 *
 * The session itself outlives the connection: when the client disconnects
 * (tab close), only this subscriber is dropped. The claude process keeps
 * running until an explicit POST /session/stop or bridge shutdown.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRIDGE_URL = `http://${process.env.BRIDGE_HOST || "host.docker.internal"}:${process.env.BRIDGE_PORT || "4318"}`;

export async function GET(req) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  let upstream;
  try {
    upstream = await fetch(
      `${BRIDGE_URL}/session/stream?sessionId=${encodeURIComponent(sessionId)}`,
      { signal: req.signal }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "bridge unreachable", message: e?.message || String(e) }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(JSON.stringify({ error: "bridge rejected", status: upstream.status, body: text.slice(0, 1024) }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }

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
