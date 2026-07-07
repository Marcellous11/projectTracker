import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { listItinerary } from "@/lib/itinerary.js";
import { FolderGit2 } from "lucide-react";
import ProjectCard from "@/components/mc/project-card.jsx";
import NeedsYou from "@/components/mc/needs-you.jsx";
import ItineraryPeek from "@/components/mc/itinerary-peek.jsx";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["active", "blocked", "paused", "done", "untracked"];
const STATUS_META = {
  active: { label: "Active", seg: "cc-seg-active", dot: "var(--green)" },
  blocked: { label: "Blocked", seg: "cc-seg-blocked", dot: "var(--hot)" },
  paused: { label: "Paused", seg: "cc-seg-paused", dot: "var(--warm)" },
  done: { label: "Done", seg: "cc-seg-done", dot: "var(--color-blue)" },
  untracked: { label: "Untracked", seg: "cc-seg-untracked", dot: "var(--muted-foreground)" },
};

function progressPct(p) {
  if (p.status === "done") return 100;
  const c = p.todoCounts || {};
  const total = (c.todo || 0) + (c.doing || 0) + (c.done || 0);
  return total ? Math.round(((c.done || 0) / total) * 100) : null;
}

// Mission Control: land here, see the portfolio at a glance, what needs you,
// every project's current state, and the itinerary — then tap in.
export default async function MissionControl() {
  const projects = await getTrackedProjects();

  // One query for all open itinerary items, grouped by project rel, so each
  // card gets its open-itinerary count without an N+1 fan-out.
  const openItems = listItinerary({ status: "open" });
  const openItinByProject = {};
  for (const item of openItems) {
    if (!item.project) continue;
    openItinByProject[item.project] = (openItinByProject[item.project] || 0) + 1;
  }

  // Portfolio rollups.
  const byStatus = {};
  for (const p of projects) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  const pcts = projects.map(progressPct).filter((v) => v != null);
  const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const activeCount = byStatus.active || 0;
  const blockedCount = byStatus.blocked || 0;
  const statusSegs = STATUS_ORDER.filter((s) => byStatus[s]);

  // "What we're working on" — in-flight projects ranked by completion.
  const workingOn = projects
    .filter((p) => p.status !== "done" && p.status !== "untracked")
    .map((p) => ({ name: p.name, pct: progressPct(p) }))
    .filter((p) => p.pct != null)
    .sort((a, b) => b.pct - a.pct);

  // Completion donut geometry.
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dash = CIRC * (1 - avgPct / 100);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* ── Portfolio overview ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="cc-eyebrow">Command Central</span>
          <h1 className="cc-page-title">Mission Control</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="kpi kpi-accent-green">
            <span className="kpi-value">{activeCount}</span>
            <span className="kpi-label">Active projects</span>
          </div>
          <div className="kpi">
            <span className="kpi-value">{avgPct}%</span>
            <span className="kpi-label">Avg progress</span>
          </div>
          <div className="kpi kpi-accent-hot">
            <span className="kpi-value">{blockedCount}</span>
            <span className="kpi-label">Blocked</span>
          </div>
          <div className="kpi kpi-accent-blue">
            <span className="kpi-value">{openItems.length}</span>
            <span className="kpi-label">Open tasks</span>
          </div>
        </div>

        {/* Status distribution — the portfolio mix at a glance. */}
        {statusSegs.length > 0 && (
          <div className="soft-card flex flex-col gap-3 p-4">
            <div className="cc-stack">
              {statusSegs.map((s) => (
                <span
                  key={s}
                  className={STATUS_META[s].seg}
                  style={{ width: `${(byStatus[s] / projects.length) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
              {statusSegs.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="cc-dot" style={{ background: STATUS_META[s].dot }} />
                  {STATUS_META[s].label}
                  <span className="hud-num font-semibold text-foreground">{byStatus[s]}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Completion donut + what we're working on. */}
        <div className="soft-card grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="relative grid place-items-center">
              <svg width="120" height="120" viewBox="0 0 120 120" className="cc-donut">
                <circle className="cc-donut-track" cx="60" cy="60" r={R} fill="none" strokeWidth="10" />
                <circle
                  className="cc-donut-fill"
                  cx="60" cy="60" r={R} fill="none" strokeWidth="10"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dash}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="hud-num text-[28px] font-bold leading-none text-foreground">{avgPct}%</span>
                <span className="text-[11px] text-muted-foreground">complete</span>
              </div>
            </div>
            <span className="cc-eyebrow">Portfolio</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-semibold text-foreground">What we're working on</span>
            {workingOn.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nothing in flight.</p>
            ) : (
              workingOn.map((p) => (
                <div key={p.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="min-w-0 truncate text-foreground/90">{p.name}</span>
                    <span className="hud-num shrink-0 font-semibold text-foreground">{p.pct}%</span>
                  </div>
                  <div className="cc-rowbar">
                    <span style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Needs you + Itinerary sit side-by-side on desktop, stacked on mobile. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <NeedsYou projects={projects} />
        <ItineraryPeek />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="soft-title flex items-center gap-2">
          <FolderGit2 size={19} strokeWidth={1.75} className="text-green" aria-hidden />
          Projects
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.rel} p={p} itineraryCount={openItinByProject[p.rel] || 0} />
          ))}
        </div>
      </section>
    </div>
  );
}
