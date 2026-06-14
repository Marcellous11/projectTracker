import Module from "@/components/hud/module.jsx";

/**
 * Briefing voice. Eight-week bar chart of `done` items from STATUS.md
 * `## Recently done`. Honest caveat: we don't have per-day completion
 * timestamps; this is a best-effort distribution over the project's
 * commit history weeks if available, otherwise a single trailing tick.
 *
 * Input: `recentlyDone` (string[]) and (optional) `commits` to time-bucket
 * roughly. If no commits, we just show a single tick at "this week".
 */
export default function Velocity({ recentlyDone = [], commits = [] }) {
  const weeks = 8;
  const buckets = new Array(weeks).fill(0);

  if (commits.length && recentlyDone.length) {
    // Distribute recentlyDone items by week using commit weekly density as a
    // weighting. Crude — but better than putting everything at week 0.
    const now = Date.now();
    const weekIdx = (d) =>
      weeks - 1 - Math.floor((now - +new Date(d)) / (7 * 86400 * 1000));
    const weights = new Array(weeks).fill(0);
    for (const c of commits) {
      const w = weekIdx(c.dateISO);
      if (w >= 0 && w < weeks) weights[w]++;
    }
    const totalW = weights.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < weeks; i++) {
      buckets[i] = Math.round((weights[i] / totalW) * recentlyDone.length * 10) / 10;
    }
  } else if (recentlyDone.length) {
    buckets[weeks - 1] = recentlyDone.length;
  }

  const max = Math.max(1, ...buckets);
  const total = recentlyDone.length;

  return (
    <Module
      title="VELOCITY"
      voice="briefing"
      caption="done items · last 8 weeks"
      right={
        <span className="hud-num text-[11px] text-hud-ink-dim">{total} total</span>
      }
    >
      <div
        className="grid items-end gap-1.5 h-16"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {buckets.map((v, i) => {
          const h = Math.max(2, Math.round((v / max) * 56));
          const isCurr = i === weeks - 1;
          return (
            <div
              key={i}
              className={`rounded-sm ${isCurr ? "bg-green/80" : "bg-green/35"}`}
              style={{ height: `${h}px` }}
              title={`week -${weeks - 1 - i}: ${v}`}
            />
          );
        })}
      </div>
      <div className="mt-2 hud-mono text-[10px] text-hud-ink-dim flex justify-between">
        <span>-7w</span>
        <span>NOW</span>
      </div>
      <p className="mt-2 hud-mono text-[10px] text-hud-ink-dim">
        // distribution weighted by commit density · approximate
      </p>
    </Module>
  );
}
