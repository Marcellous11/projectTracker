import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { getDailyActivity } from "@/lib/activity.js";
import Sector from "@/components/mc/sector.jsx";
import HealthSummary from "@/components/mc/health-summary.jsx";
import NextActions from "@/components/mc/next-actions.jsx";
import Blockers from "@/components/mc/blockers.jsx";
import StaleProjects from "@/components/mc/stale-projects.jsx";
import TodosCompact from "@/components/mc/todos-compact.jsx";
import CommitsFeed from "@/components/mc/commits-feed.jsx";

export const dynamic = "force-dynamic";

export default async function MissionControl() {
  const [projects, daily] = await Promise.all([
    getTrackedProjects(),
    getDailyActivity(84),
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

        {/* ─────────────── SECTOR B · BACKLOG ─────────────── */}
        <Sector label="B" title="Backlog">
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
