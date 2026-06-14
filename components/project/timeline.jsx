import Module from "@/components/hud/module.jsx";

const TYPE_META = {
  commit:  { tag: "CMT", cls: "text-green",            dot: "bg-green" },
  session: { tag: "SES", cls: "text-[var(--color-blue)]", dot: "bg-[var(--color-blue)]" },
  status:  { tag: "STS", cls: "text-warm",             dot: "bg-warm" },
};

function fmtTime(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function fmtDay(d) {
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function groupByDay(events) {
  const out = [];
  let curr = null;
  for (const e of events) {
    const day = fmtDay(e.ts);
    if (!curr || curr.day !== day) {
      curr = { day, events: [] };
      out.push(curr);
    }
    curr.events.push(e);
  }
  return out;
}

/**
 * Briefing voice. Vertical timeline merging commit + session + status events
 * for one project. Date rail on the left, accent line down the middle,
 * type-coded dots + uppercase mono tag + message.
 */
export default function Timeline({ events = [] }) {
  if (!events.length) {
    return (
      <Module title="ACTIVITY TIMELINE" voice="briefing" caption="60-day window">
        <p className="hud-mono text-[11px] text-hud-ink-dim">// no activity recorded</p>
      </Module>
    );
  }
  const days = groupByDay(events);

  return (
    <Module
      title="ACTIVITY TIMELINE"
      voice="briefing"
      caption={`60d · ${events.length} events`}
    >
      <ol className="flex flex-col gap-4">
        {days.map((g) => (
          <li key={g.day} className="flex gap-4 min-w-0">
            <div className="hud-mono text-[11px] text-hud-ink-dim shrink-0 w-[88px] pt-0.5 tabular-nums">
              {g.day}
            </div>
            <ol className="flex-1 min-w-0 border-l border-hud-border pl-4 flex flex-col gap-1.5">
              {g.events.map((e, i) => {
                const meta = TYPE_META[e.type] || { tag: "EVT", cls: "text-foreground", dot: "bg-muted-foreground" };
                return (
                  <li key={`${g.day}-${i}`} className="relative flex items-baseline gap-2.5 min-w-0">
                    <span
                      className={`absolute left-[-18px] top-2 size-1.5 rounded-full ${meta.dot}`}
                      aria-hidden
                    />
                    <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 w-9 tabular-nums">
                      {fmtTime(e.ts)}
                    </span>
                    <span className={`hud-mono font-bold text-[10px] shrink-0 w-7 ${meta.cls}`}>
                      {meta.tag}
                    </span>
                    <span className="flex-1 min-w-0 text-[12px] truncate">{e.message}</span>
                    {e.payload?.hash && (
                      <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0">
                        {e.payload.hash}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </Module>
  );
}
