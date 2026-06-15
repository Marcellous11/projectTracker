import { projectsRoot } from "@/lib/scan.js";
import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { summarize } from "@/lib/aggregate.js";
import { Compass } from "lucide-react";

/**
 * Persistent topbar. Mounted in the root layout so it spans every route.
 * Calm, minimal: app title + a couple of soft summary pills. All data comes
 * from the per-request cache()d scan, so layouts share the same memo.
 */
export default async function Topbar() {
  let summary = null;
  try {
    const root = projectsRoot();
    const projects = await getTrackedProjects(root);
    summary = summarize(projects);
  } catch {
    /* render in degraded mode */
  }
  const stats = summary?.byStatus ?? { active: 0, blocked: 0, paused: 0, done: 0, untracked: 0 };
  const total = summary?.total ?? 0;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-hud-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="flex h-12 w-full items-center gap-4 px-4 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <Compass size={18} strokeWidth={1.75} className="text-green" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Mission Control
          </span>
        </div>

        {/* Soft summary pills */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <SoftPill label="projects" value={total} />
          {stats.active > 0 && <SoftPill label="active" value={stats.active} tone="green" />}
          {stats.blocked > 0 && <SoftPill label="blocked" value={stats.blocked} tone="hot" />}
        </div>
      </div>
    </div>
  );
}

function SoftPill({ label, value, tone = "default" }) {
  const tones = {
    default: "text-foreground",
    green: "text-green",
    hot: "text-hot",
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hud-border bg-secondary/60 px-3 py-1 text-[12px]">
      <span className={`tabular-nums font-semibold ${tones[tone]}`}>{value}</span>
      <span className="text-hud-ink-dim">{label}</span>
    </span>
  );
}
