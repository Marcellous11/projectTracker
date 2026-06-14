import Module from "@/components/hud/module.jsx";
import Stat from "@/components/hud/stat.jsx";
import Spark from "@/components/hud/spark.jsx";

function sumWindow(daily, start, end) {
  return daily.slice(start, end).reduce((n, d) => n + d.count, 0);
}

export default function StreakCard({ daily = [], streak = { streak: 0, longest: 0 } }) {
  const n = daily.length;
  // Last 7 days vs prior 7 days for week-over-week comparison.
  const lastWk = n >= 7 ? sumWindow(daily, n - 7, n) : 0;
  const prevWk = n >= 14 ? sumWindow(daily, n - 14, n - 7) : 0;
  const delta = lastWk - prevWk;
  const pct = prevWk > 0 ? Math.round((delta / prevWk) * 100) : (lastWk > 0 ? 100 : 0);

  const spark = daily.slice(-21).map((d) => d.count);
  const tone = delta > 0 ? "green" : delta < 0 ? "hot" : "muted";

  return (
    <Module title="STREAK" voice="ops" caption={`output · last 7d vs prior`}>
      <div className="flex flex-col gap-3">
        <Stat label="CURRENT STREAK" value={`${streak.streak}d`} tone="green" size="lg" />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="LONGEST 84D" value={`${streak.longest}d`} tone="default" size="sm" />
          <Stat label="THIS WEEK" value={lastWk} tone="default" size="sm" />
        </div>
        <div className="flex items-center gap-2 text-[11px] hud-mono">
          <span className={tone === "green" ? "text-green" : tone === "hot" ? "text-hot" : "text-hud-ink-dim"}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "·"} {Math.abs(delta)}{prevWk > 0 ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}
          </span>
          <span className="text-hud-ink-dim">vs prior 7d</span>
        </div>
        {spark.length > 1 && (
          <div className={tone === "hot" ? "text-hot" : "text-green"}>
            <Spark values={spark} width={220} height={28} />
          </div>
        )}
      </div>
    </Module>
  );
}
