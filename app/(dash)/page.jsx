import { unstable_cache } from "next/cache";
import { getScannedProjects } from "@/lib/scan.js";
import { getActivityFeed, getDailyActivity, getStreak } from "@/lib/activity.js";
import { totalsByProject, totalsByClient } from "@/lib/time-entries.js";
import { syncAutoTime } from "@/lib/auto-time-sync.js";
import Sector from "@/components/mc/sector.jsx";
import HealthSummary from "@/components/mc/health-summary.jsx";
import NextActions from "@/components/mc/next-actions.jsx";
import Blockers from "@/components/mc/blockers.jsx";
import StaleProjects from "@/components/mc/stale-projects.jsx";
import ActivityHeatmap from "@/components/mc/activity-heatmap.jsx";
import StreakCard from "@/components/mc/streak-card.jsx";
import SessionsPanel from "@/components/mc/sessions-panel.jsx";
import Ticker from "@/components/mc/ticker.jsx";
import TodosCompact from "@/components/mc/todos-compact.jsx";
import CommitsFeed from "@/components/mc/commits-feed.jsx";
import TimeSummary from "@/components/mc/time-summary.jsx";

// Cached auto-sync (also called from /time). 30s revalidation.
const cachedAutoSync = unstable_cache(
  async () => {
    try { return await syncAutoTime(); }
    catch { return null; }
  },
  ["auto-time-sync"],
  { revalidate: 30, tags: ["time-auto-sync"] }
);

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}
function startOfWeek() {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime();
}
function startOfMonth() {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime();
}

export const dynamic = "force-dynamic";

export default async function MissionControl() {
  const syncResult = await cachedAutoSync();
  const [projects, daily, streak, initialFeed] = await Promise.all([
    getScannedProjects(),
    getDailyActivity(84),
    getStreak(84),
    getActivityFeed({ maxTotal: 30 }),
  ]);

  const todayMs = startOfToday();
  const weekMs = startOfWeek();
  const monthMs = startOfMonth();
  const totalsToday = totalsByProject({ from: todayMs });
  const totalsWeek = totalsByProject({ from: weekMs });
  const totalsMonth = totalsByProject({ from: monthMs });
  const clientTotals = totalsByClient({ from: monthMs });

  return (
    <div className="relative hud-grid-bg -mx-6 px-6 -my-8 py-8 md:-mx-10 md:px-10">
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
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-7">
              <SessionsPanel projects={projects} />
            </div>
            <div className="md:col-span-5">
              <Ticker initialEvents={initialFeed} />
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

        {/* ─────────────── SECTOR D · LEDGER ─────────────── */}
        <Sector label="D" title="Ledger" accent="warm">
          <TimeSummary
            totalsToday={totalsToday}
            totalsWeek={totalsWeek}
            totalsMonth={totalsMonth}
            totalsByClient={clientTotals}
            lastAutoSyncAt={syncResult?.ranAt || null}
          />
        </Sector>
      </div>
    </div>
  );
}
