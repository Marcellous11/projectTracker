import { projectsRoot } from "@/lib/scan.js";
import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { summarize } from "@/lib/aggregate.js";
import Clock from "@/components/hud/clock.jsx";
import CountUp from "@/components/hud/count-up.jsx";

function shortPath(p) {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

/**
 * Persistent HUD topbar. Mounted in the root layout so it spans every route.
 * All data comes from the per-request cache()d scan, so layouts further down
 * the tree share the same memo — no double-fetch.
 */
export default async function Topbar() {
  let summary = null;
  let root = "";
  try {
    root = projectsRoot();
    const projects = await getTrackedProjects(root);
    summary = summarize(projects);
  } catch {
    /* render in degraded mode */
  }
  const stats = summary?.byStatus ?? { active: 0, blocked: 0, paused: 0, done: 0, untracked: 0 };
  const openTodos = summary?.todos?.open ?? 0;
  const total = summary?.total ?? 0;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-hud-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="flex h-9 w-full items-center gap-4 overflow-x-auto px-4 text-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block size-1.5 rounded-full bg-green hud-pulse" />
          <span className="hud-mono uppercase tracking-[0.22em] text-foreground">
            Mission Control
          </span>
        </div>

        {/* Live clock */}
        <span className="hud-mono text-hud-ink-dim shrink-0">
          <Clock />
        </span>

        <span className="text-hud-border-strong">│</span>

        {/* Telemetry totals */}
        <div className="flex items-center gap-4 shrink-0">
          <Stat label="NODES" value={total} pad={2} />
          <Stat label="ACTIVE" value={stats.active} pad={2} tone="green" />
          <Stat label="BLOCKED" value={stats.blocked} pad={2} tone="hot" />
          <Stat label="OPEN" value={openTodos} pad={3} />
        </div>

        <div className="ml-auto flex items-center gap-4 shrink-0 text-hud-ink-dim">
          <span className="hud-mono">ROOT {shortPath(root)}</span>
          <span className="text-hud-border-strong">│</span>
          <span className="hud-mono">BUILD {process.env.NEXT_PUBLIC_BUILD ?? "DEV"}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default", pad = 0 }) {
  const tones = {
    default: "text-foreground",
    green: "text-green",
    hot: "text-hot",
    warm: "text-warm",
  };
  return (
    <div data-stat-tile className="flex items-baseline gap-1.5 rounded px-1 -mx-1 transition-shadow">
      <span className="hud-label">{label}</span>
      <span className={`hud-num ${tones[tone]}`}>
        <CountUp value={value} pad={pad} />
      </span>
    </div>
  );
}
