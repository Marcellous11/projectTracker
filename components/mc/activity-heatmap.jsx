import Module from "@/components/hud/module.jsx";

const CELL = 11;
const GAP = 3;

function intensity(count, max) {
  if (max <= 0) return 0;
  if (count === 0) return 0;
  const t = count / max;
  if (t < 0.25) return 1;
  if (t < 0.5) return 2;
  if (t < 0.75) return 3;
  return 4;
}

/**
 * GitHub-style 12-week activity grid. Counts come from getDailyActivity
 * (commit + session events; STATUS.md updates intentionally excluded).
 * SVG renders server-side, no chart library.
 */
export default function ActivityHeatmap({ daily = [] }) {
  if (!daily.length) {
    return (
      <Module title="ACTIVITY HEATMAP" voice="ops" caption="84-day signal">
        <p className="text-[13px] text-hud-ink-dim">No activity in window</p>
      </Module>
    );
  }

  // Reshape into columns of 7 (weeks). We start the grid on the first day's
  // weekday so today's column is correct on the right edge.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Align the trailing column to today's weekday — drop leading days so the
  // total length is a multiple of 7. (Daily is already exactly `days` long.)
  const weeks = Math.ceil(daily.length / 7);
  const max = daily.reduce((m, d) => Math.max(m, d.count), 0);
  const padCount = weeks * 7 - daily.length;
  const grid = [...Array(padCount).fill(null), ...daily];

  const cols = [];
  for (let c = 0; c < weeks; c++) {
    cols.push(grid.slice(c * 7, c * 7 + 7));
  }

  const totalCommits = daily.reduce((n, d) => n + (d.commits || 0), 0);
  const totalSessions = daily.reduce((n, d) => n + (d.sessions || 0), 0);

  const w = cols.length * (CELL + GAP);
  const h = 7 * (CELL + GAP);

  return (
    <Module
      title="ACTIVITY HEATMAP"
      voice="ops"
      caption={`84d · ${totalCommits} commits · ${totalSessions} sessions`}
      right={
        <span className="hud-mono text-[10px] text-hud-ink-dim">
          MAX {max}/day
        </span>
      }
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="84-day activity heatmap"
        className="text-green"
      >
        {cols.map((col, ci) =>
          col.map((day, ri) => {
            if (!day) return null;
            const lvl = intensity(day.count, max);
            const x = ci * (CELL + GAP);
            const y = ri * (CELL + GAP);
            const isToday = day.date === todayKey();
            // Use color-mix for green intensity blend with background.
            const fill =
              lvl === 0
                ? "color-mix(in oklch, currentColor 6%, var(--background))"
                : `color-mix(in oklch, currentColor ${15 + lvl * 18}%, var(--background))`;
            return (
              <rect
                key={`${ci}-${ri}`}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill={fill}
                stroke={isToday ? "currentColor" : "transparent"}
                strokeWidth={isToday ? 1 : 0}
              >
                <title>{`${day.date} · ${day.count} events`}</title>
              </rect>
            );
          })
        )}
      </svg>
      <div className="mt-3 flex items-center gap-2 text-[10px] hud-mono text-hud-ink-dim">
        <span>LOW</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className="inline-block size-[10px] rounded-sm text-green"
            style={{
              backgroundColor:
                lvl === 0
                  ? "color-mix(in oklch, currentColor 6%, var(--background))"
                  : `color-mix(in oklch, currentColor ${15 + lvl * 18}%, var(--background))`,
            }}
          />
        ))}
        <span>HIGH</span>
      </div>
    </Module>
  );
}

function todayKey() {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
