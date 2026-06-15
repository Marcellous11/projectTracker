import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { listItinerary } from "@/lib/itinerary.js";
import { FolderGit2 } from "lucide-react";
import ProjectCard from "@/components/mc/project-card.jsx";
import NeedsYou from "@/components/mc/needs-you.jsx";
import ItineraryPeek from "@/components/mc/itinerary-peek.jsx";

export const dynamic = "force-dynamic";

// Mission Control: land here, see what needs you, glance at every project's
// current state, and what's on the itinerary — then tap in.
export default async function MissionControl() {
  const projects = await getTrackedProjects();

  // One query for all open itinerary items, grouped by project rel, so each
  // card gets its open-itinerary count without an N+1 fan-out.
  const openItinByProject = {};
  for (const item of listItinerary({ status: "open" })) {
    if (!item.project) continue;
    openItinByProject[item.project] = (openItinByProject[item.project] || 0) + 1;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
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
