import { listItinerary, counts } from "@/lib/itinerary.js";
import { getScannedProjects } from "@/lib/scan.js";
import ItineraryClient from "@/components/itinerary/itinerary-client.jsx";

export const dynamic = "force-dynamic";

export default async function ItineraryPage() {
  const items = listItinerary();
  const c = counts();
  let projects = [];
  try {
    projects = (await getScannedProjects()).map((p) => ({ rel: p.rel, name: p.name }));
  } catch {
    projects = [];
  }
  return <ItineraryClient initialItems={items} initialCounts={c} projects={projects} />;
}
