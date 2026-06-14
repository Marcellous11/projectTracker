"use client";

import { useEffect, useRef, useState } from "react";

const TYPE_META = {
  commit:  { tag: "CMT", cls: "text-green" },
  session: { tag: "SES", cls: "text-[var(--color-blue)]" },
  status:  { tag: "STS", cls: "text-warm" },
  quake:   { tag: "QKE", cls: "text-hot" },
  hn:      { tag: "HN",  cls: "text-warm" },
  infra:   { tag: "INF", cls: "text-hot" },
  space:   { tag: "SPC", cls: "text-[var(--color-blue)]" },
};

// UTC format — keeps server (Docker, UTC) and client renders identical so
// React doesn't trip a hydration mismatch. The trailing "Z" reads as Zulu
// time in HUD vocabulary, which is on-brand for the dialect.
function fmtTime(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}Z`;
}

/**
 * Live Activity Ticker — Signals dialect. Polls /api/activity every 30s when
 * the tab is visible, pauses while hidden, fades new rows in from the top.
 */
export default function Ticker({ initialEvents = [], pollMs = 30_000 }) {
  const [events, setEvents] = useState(initialEvents);
  const [tickedAt, setTickedAt] = useState(null);
  const seenIds = useRef(new Set(initialEvents.map(eventKey)));

  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/activity?max=30", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || !data?.events) return;
        setEvents(data.events);
        setTickedAt(new Date());
        seenIds.current = new Set(data.events.map(eventKey));
      } catch { /* network blip — try next tick */ }
    };

    const id = setInterval(fetchOnce, pollMs);
    const onVis = () => { if (document.visibilityState === "visible") fetchOnce(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [pollMs]);

  // Build the marquee summary from current event mix.
  const counts = events.reduce(
    (m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; },
    { commit: 0, session: 0, status: 0, quake: 0, hn: 0, infra: 0, space: 0 }
  );
  const ext = counts.quake + counts.hn + counts.infra + counts.space;
  const marquee = `LAST 30 EVENTS · CMT ${counts.commit} · SES ${counts.session} · STS ${counts.status} · EXT ${ext} · `;

  return (
    <section className="hud-module hud-voice-signals">
      <header className="hud-module-header">
        <span className="hud-label">// LIVE ACTIVITY</span>
        <span suppressHydrationWarning className="hud-mono text-[10px] text-hud-ink-dim shrink-0">
          {tickedAt
            ? `synced ${tickedAt.toISOString().slice(11, 19)}Z`
            : `init`}
        </span>
      </header>

      <div className="border-b border-hud-border/60 px-3 py-1.5 hud-marquee text-[10px] text-hud-ink-dim">
        <span className="hud-marquee-inner">
          <span>{marquee}</span>
          <span>{marquee}</span>
        </span>
      </div>

      <ol className="flex flex-col px-1 pt-1 pb-2 max-h-[420px] overflow-y-auto">
        {events.length === 0 ? (
          <li className="hud-mono text-[11px] text-hud-ink-dim px-3 py-2">// no recent events</li>
        ) : (
          events.map((e) => {
            const meta = TYPE_META[e.type] || { tag: "EVT", cls: "text-foreground" };
            return (
              <li
                key={eventKey(e)}
                className="hud-fade-in flex items-baseline gap-2 px-3 py-1 text-[11px] leading-tight hover:bg-foreground/5 transition-colors"
              >
                <span className="hud-mono tabular-nums text-hud-ink-dim shrink-0 w-[64px]">
                  {fmtTime(e.ts)}
                </span>
                <span className={`hud-mono font-bold shrink-0 w-[28px] ${meta.cls}`}>
                  {meta.tag}
                </span>
                <span className="hud-mono text-hud-ink-dim shrink-0 truncate w-[140px]">
                  {e.projectRel}
                </span>
                <span className="flex-1 min-w-0 truncate">{e.message}</span>
              </li>
            );
          })
        )}
      </ol>
    </section>
  );
}

function eventKey(e) {
  return `${e.type}:${e.ts}:${e.projectRel}:${e.payload?.hash ?? e.payload?.sessionId ?? e.message.slice(0, 20)}`;
}
