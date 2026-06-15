import { projectsRoot } from "@/lib/scan.js";
import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { metaByRel } from "@/lib/project-meta.js";
import Sidebar from "@/components/sidebar.jsx";
import MobileNav from "@/components/mobile-nav.jsx";
import QuickCapture from "@/components/itinerary/quick-capture.jsx";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }) {
  const root = projectsRoot();
  let projects = [];
  let scanError = null;
  let meta = {};
  try {
    const raw = await getTrackedProjects(root);
    meta = metaByRel();
    // Order comes from config/repos.json (the tracked-repos roster).
    projects = raw.map((p) => {
      const m = meta[p.rel] || null;
      return {
        name: p.name,
        rel: p.rel,
        status: p.status,
        open: p.todoCounts?.open ?? 0,
        staleDays: p.staleDays ?? null,
        hasLocal: p.hasLocal,
        github: p.github || null,
        codenameOverride: m?.codename || null,
        clientName: m?.client_name || null,
        clientColor: m?.client_color || null,
      };
    });
  } catch (err) {
    scanError = err.message;
  }
  const total = projects.reduce((n, p) => n + p.open, 0);

  return (
    <>
      <MobileNav projects={projects} total={total} root={root} />
      <div className="flex min-h-[calc(100dvh-2.25rem)]">
        <Sidebar projects={projects} total={total} root={root} />
        <main className="min-w-0 flex-1 px-4 py-5 md:px-10 md:py-8">
          {scanError ? <p className="text-sm text-hot">Scan failed: {scanError}</p> : children}
        </main>
      </div>
      <QuickCapture projects={projects.map((p) => ({ rel: p.rel, name: p.name }))} />
    </>
  );
}
