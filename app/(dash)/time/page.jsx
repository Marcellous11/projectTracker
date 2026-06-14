import { unstable_cache } from "next/cache";
import { getScannedProjects } from "@/lib/scan.js";
import { listClients } from "@/lib/clients.js";
import { listEntries, totalsByProject, totalsByClient } from "@/lib/time-entries.js";
import { syncAutoTime } from "@/lib/auto-time-sync.js";
import EntriesTable from "@/components/time/entries-table.jsx";
import ManualEntryForm from "@/components/time/manual-entry-form.jsx";
import StartTimerButton from "@/components/time/start-timer-button.jsx";
import { cookies } from "next/headers";
import { fmtDuration } from "@/lib/duration.js";

// Cached auto-sync: at most once every 30s per process. Page load triggers it
// so visiting /time refreshes Claude session time without hammering the disk.
const cachedAutoSync = unstable_cache(
  async () => {
    try { return await syncAutoTime(); }
    catch (err) { return { error: err?.message || "sync failed" }; }
  },
  ["auto-time-sync"],
  { revalidate: 30, tags: ["time-auto-sync"] }
);

export const dynamic = "force-dynamic";

const TIMER_COOKIE = "tracker_timer";

async function timerActive() {
  try {
    const jar = await cookies();
    const raw = jar.get(TIMER_COOKIE)?.value;
    return !!(raw && JSON.parse(raw)?.entry_id);
  } catch {
    return false;
  }
}

function dayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.getTime();
}

function monthStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

export default async function TimePage({ searchParams }) {
  const sp = (await searchParams) || {};
  const filterProject = sp.project ? String(sp.project) : null;
  const filterSource = sp.source ? String(sp.source) : null;

  // Fire-and-await the cached auto-sync before reading entries so this load
  // includes the latest auto-rolled session time.
  const syncResult = await cachedAutoSync();

  const [projects, clients] = await Promise.all([getScannedProjects(), Promise.resolve(listClients())]);
  const pickable = projects
    .filter((p) => p.tracked !== false && p.status !== "untracked")
    .map((p) => ({ rel: p.rel, name: p.name, status: p.status }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filter = {};
  if (filterProject) filter.project = filterProject;
  if (filterSource) filter.source = filterSource;
  const entries = listEntries({ ...filter, limit: 500 });

  const today = dayStart(new Date());
  const totalsToday = totalsByProject({ from: today });
  const totalsWeek = totalsByProject({ from: weekStart() });
  const totalsMonth = totalsByProject({ from: monthStart() });
  const clientTotals = totalsByClient({ from: monthStart() });

  const sumOf = (arr) => arr.reduce((n, r) => n + (Number(r.total_ms) || 0), 0);
  const hasRunning = await timerActive();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
          <p className="text-sm text-muted-foreground">
            Manual timers + entries. Claude session activity is auto-rolled as non-billable.
          </p>
        </div>
        {syncResult && !syncResult.error && (
          <p className="hud-mono text-[10px] text-hud-ink-dim">
            // auto-sync · {syncResult.inserted} new · {syncResult.updated} updated · {syncResult.skipped} skipped
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Stat label="TODAY" value={fmtDuration(sumOf(totalsToday))} />
        <Stat label="THIS WEEK" value={fmtDuration(sumOf(totalsWeek))} />
        <Stat label="THIS MONTH" value={fmtDuration(sumOf(totalsMonth))} />
        <Stat label="ENTRIES SHOWN" value={String(entries.length)} />
      </div>

      <ManualEntryForm projects={pickable} />

      {pickable.length > 0 && (
        <section className="rounded-lg border border-hud-border bg-card/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="hud-label">// QUICK START</span>
            <span className="hud-mono text-[10px] text-hud-ink-dim">
              {hasRunning ? "stop the current timer to start another" : "click a project to start a timer"}
            </span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {pickable.slice(0, 24).map((p) => (
              <li key={p.rel} className="flex items-center gap-2 rounded-lg border border-hud-border px-2.5 py-1.5 text-[12px]">
                <span className="truncate max-w-[12rem]">{p.name}</span>
                <StartTimerButton projectRel={p.rel} projectName={p.name} disabled={hasRunning} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium tracking-tight">Log</h2>
          <FilterBar projects={pickable} active={{ project: filterProject, source: filterSource }} />
        </header>
        <EntriesTable entries={entries} />
      </section>

      {clientTotals.length > 0 && (
        <section>
          <h2 className="text-base font-medium tracking-tight mb-3">By client · this month</h2>
          <ul className="flex flex-col divide-y divide-hud-border rounded-lg border border-hud-border bg-card/40">
            {clientTotals.map((c) => (
              <li key={c.client_id ?? "none"} className="flex items-center gap-3 px-4 py-2">
                {c.client_color && (
                  <span className="size-2 rounded-full border border-hud-border shrink-0" style={{ backgroundColor: c.client_color }} />
                )}
                <span className="flex-1">{c.client_name || "(unassigned)"}</span>
                <span className="hud-num text-[12px] tabular-nums">{fmtDuration(c.total_ms)}</span>
                <span className="hud-mono text-[10px] text-hud-ink-dim w-16 text-right">{c.entry_count} ent.</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-hud-border bg-card/40 p-3 flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <span className="hud-num text-xl tabular-nums">{value}</span>
    </div>
  );
}

function FilterBar({ projects, active }) {
  const params = new URLSearchParams();
  if (active.source) params.set("source", active.source);
  return (
    <form className="flex items-center gap-2" action="/time">
      <select
        name="project"
        defaultValue={active.project || ""}
        className="hud-input w-48"
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.rel} value={p.rel}>{p.name}</option>
        ))}
      </select>
      <select
        name="source"
        defaultValue={active.source || ""}
        className="hud-input w-32"
      >
        <option value="">All sources</option>
        <option value="manual">Manual</option>
        <option value="auto">Auto</option>
      </select>
      <button
        type="submit"
        className="h-8 rounded-lg border border-hud-border px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-hud-ink-dim hover:text-foreground transition-colors"
      >
        apply
      </button>
    </form>
  );
}
