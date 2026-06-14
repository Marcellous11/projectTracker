import Module from "@/components/hud/module.jsx";
import Stat from "@/components/hud/stat.jsx";
import { summarize } from "@/lib/aggregate.js";

/**
 * Mission Control vitals strip. Tiles share the .hud-stat-tile data attribute
 * so CountUp can flash a 1px ring on the affected tile when a value changes.
 *
 * Sparklines are placeholders (synthetic from current counts) — real per-day
 * data will land when activity heatmap is in. We pass them only when ≥3 days
 * of meaningful signal exist (>=1 commit or session) so the tile isn't a flat
 * line shouting "I have nothing to say".
 */
export default function HealthSummary({ projects, dailyActivity = [] }) {
  const s = summarize(projects);

  // Build per-day signal sparklines from the daily activity feed if present.
  const last14 = dailyActivity.slice(-14);
  const spark = last14.length >= 7 && last14.some((d) => d.count > 0)
    ? last14.map((d) => d.count)
    : null;

  return (
    <Module title="HEALTH SUMMARY" voice="ops" caption="vitals · last 14d trend">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-6">
        <Tile label="NODES"    value={s.total}             tone="default" spark={spark} />
        <Tile label="ACTIVE"   value={s.byStatus.active}   tone="green"   spark={spark} />
        <Tile label="BLOCKED"  value={s.byStatus.blocked}  tone="hot"     />
        <Tile label="STALE 7+" value={s.byStaleness.cold + s.byStaleness.frozen} tone="warm" />
        <Tile label="OPEN TODOS" value={s.todos.open}      tone="default" spark={spark} />
        <Tile label="DONE TODOS" value={s.todos.done}      tone="muted"   />
      </div>
    </Module>
  );
}

function Tile({ label, value, tone, spark }) {
  return (
    <div data-stat-tile className="rounded transition-shadow">
      <Stat label={label} value={value} tone={tone} size="lg" spark={spark} />
    </div>
  );
}
