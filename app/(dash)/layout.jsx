import { getScannedProjects, projectsRoot } from "@/lib/scan.js";
import { getPulseForProjects } from "@/lib/sessions.js";
import { metaByRel } from "@/lib/project-meta.js";
import Sidebar from "@/components/sidebar.jsx";

export const dynamic = "force-dynamic";

/**
 * Pulse rank for sidebar ordering. Lower sorts first.
 *
 *   0  tool        — Claude is mid-tool-call (most urgent)
 *   1  live        — actively typing or just responded
 *   2  idle        — process open, waiting for user
 *   3  recent      — closed within last 24h
 *   4  cold        — everything else
 *
 * Within each rank, the original blocked-first / active-by-staleness order
 * from lib/scan.js#sortKey is preserved (Array.sort is stable in modern JS).
 */
function pulseRank(p) {
  const pulse = p.pulse;
  if (pulse?.processOpen && pulse.streamState === "tool") return 0;
  if (pulse?.liveNow || (pulse?.processOpen && pulse.streamState === "responding")) return 1;
  if (pulse?.idle) return 2;
  if (pulse?.recent) return 3;
  return 4;
}

export default async function DashLayout({ children }) {
  const root = projectsRoot();
  let projects = [];
  let pulseMap = {};
  let scanError = null;
  let meta = {};
  try {
    const raw = await getScannedProjects(root);
    pulseMap = await getPulseForProjects(raw);
    meta = metaByRel();
    projects = raw.map((p) => {
      const m = meta[p.rel] || null;
      return {
        name: p.name,
        rel: p.rel,
        status: p.status,
        open: p.todoCounts?.open ?? 0,
        staleDays: p.staleDays ?? null,
        pulse: pulseMap[p.rel] || { liveNow: false, lastActiveAt: null, recent: false },
        codenameOverride: m?.codename || null,
        clientName: m?.client_name || null,
        clientColor: m?.client_color || null,
      };
    });
    // Re-sort: Claude-session state first, then fall back to the order
    // already established by getScannedProjects (blocked > active by
    // staleness > untracked > paused > done, alphabetical within).
    projects.sort((a, b) => pulseRank(a) - pulseRank(b));
  } catch (err) {
    scanError = err.message;
  }
  const total = projects.reduce((n, p) => n + p.open, 0);

  return (
    <div className="flex min-h-[calc(100dvh-2.25rem)]">
      <Sidebar projects={projects} total={total} root={root} />
      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        {scanError ? <p className="text-sm text-hot">Scan failed: {scanError}</p> : children}
      </main>
    </div>
  );
}
