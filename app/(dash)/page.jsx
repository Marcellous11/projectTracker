import { getScannedProjects } from "@/lib/scan.js";
import { getDailyActivity, getStreak } from "@/lib/activity.js";
import Sector from "@/components/mc/sector.jsx";
import HealthSummary from "@/components/mc/health-summary.jsx";
import NextActions from "@/components/mc/next-actions.jsx";
import Blockers from "@/components/mc/blockers.jsx";
import StaleProjects from "@/components/mc/stale-projects.jsx";
import ActivityHeatmap from "@/components/mc/activity-heatmap.jsx";
import StreakCard from "@/components/mc/streak-card.jsx";
import TodosCompact from "@/components/mc/todos-compact.jsx";
import CommitsFeed from "@/components/mc/commits-feed.jsx";

export const dynamic = "force-dynamic";

export default async function MissionControl() {
  const [projects, daily, streak] = await Promise.all([
    getScannedProjects(),
    getDailyActivity(84),
    getStreak(84),
  ]);

  return (
    <div className="relative hud-grid-bg -mx-4 px-4 -my-5 py-5 md:-mx-10 md:px-10 md:-my-8 md:py-8">
      <div className="relative flex flex-col gap-8">
        {/* ─────────────── SECTOR A · ACTIVE OPERATIONS ─────────────── */}
        <Sector label="A" title="Active Operations">
          <HealthSummary projects={projects} dailyActivity={daily} />
          <div className="grid gap-4 md:grid-cols-2">
            <NextActions projects={projects} />
            <Blockers projects={projects} />
          </div>
        </Sector>

        {/* ─────────────── SECTOR B · SIGNALS ─────────────── */}
        <Sector label="B" title="Signals" accent="blue">
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-8">
              <ActivityHeatmap daily={daily} />
            </div>
            <div className="md:col-span-4">
              <StreakCard daily={daily} streak={streak} />
            </div>
          </div>
        </Sector>

        {/* ─────────────── SECTOR C · BACKLOG ─────────────── */}
        <Sector label="C" title="Backlog">
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-8">
              <TodosCompact projects={projects} />
            </div>
            <div className="md:col-span-4">
              <StaleProjects projects={projects} />
            </div>
          </div>
          <CommitsFeed projects={projects} />
        </Sector>
      </div>
    </div>
  );
}
