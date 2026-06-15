import Module from "@/components/hud/module.jsx";
import Stat from "@/components/hud/stat.jsx";

/**
 * Briefing voice. Stat tiles with optional 14-day sparklines.
 *
 * Sources:
 *   - todoCounts        from detail
 *   - commits7d         from `commits7d` count
 *   - dailyActivity     for sparklines (this project, 14d)
 */
export default function Vitals({ detail, commits7d = 0, dailyActivity = [], deps = null }) {
  const c = detail?.todoCounts || {};
  const open = c.open ?? 0;
  const doing = c.doing ?? 0;
  const done = c.done ?? 0;

  const stale = detail?.staleDays ?? null;

  const spark = dailyActivity.length >= 7 ? dailyActivity.slice(-14).map((d) => d.count) : null;

  const showDeps = deps && Number.isFinite(deps.deps);
  const depsValue = showDeps ? `${deps.deps}·${deps.outdated ?? 0}` : null;
  const depsTone = showDeps && deps.outdated > 0 ? (deps.outdated >= 10 ? "warm" : "default") : "muted";

  return (
    <Module title="VITALS" voice="briefing" caption="7-day window">
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${showDeps ? "md:grid-cols-5" : "md:grid-cols-4"} gap-x-6 gap-y-3`}>
        <Tile label="OPEN" value={open} tone="default" spark={spark} />
        <Tile label="DOING" value={doing} tone="warm" />
        <Tile label="DONE TOTAL" value={done} tone="muted" />
        <Tile label="COMMITS 7D" value={commits7d} tone="green" />
        {showDeps && (
          <Tile
            label="DEPS · OUT"
            value={depsValue}
            tone={depsTone}
          />
        )}
      </div>
      {stale != null && (
        <div className="mt-3 hud-mono text-[10px] text-hud-ink-dim">
          STALENESS <span className={stale >= 14 ? "text-hot" : stale >= 7 ? "text-warm" : "text-green"}>{stale}d</span>
        </div>
      )}
    </Module>
  );
}

function Tile({ label, value, tone, spark }) {
  return (
    <div data-stat-tile className="rounded transition-shadow">
      <Stat label={label} value={value} tone={tone} size="md" spark={spark} />
    </div>
  );
}
