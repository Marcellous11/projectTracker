import { getTrackedProjects } from "@/lib/tracked-projects.js";
import ProjectCard from "@/components/mc/project-card.jsx";
import NeedsYou from "@/components/mc/needs-you.jsx";
import ItineraryPeek from "@/components/mc/itinerary-peek.jsx";

export const dynamic = "force-dynamic";

// Mission Control: land here, see what needs you, glance at every project's
// current state, and what's on the itinerary — then tap in. One scroll, no logs.
export default async function MissionControl() {
  const projects = await getTrackedProjects();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <NeedsYou projects={projects} />

      <section className="flex flex-col gap-3">
        <h2 className="hud-label">Projects</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.rel} p={p} />
          ))}
        </div>
      </section>

      <ItineraryPeek />
    </div>
  );
}
