import Link from "next/link";
import { ListChecks } from "lucide-react";
import { listItinerary } from "@/lib/itinerary.js";

// A glance at what's captured in the itinerary, with a link to the full list.
export default function ItineraryPeek() {
  let items = [];
  try {
    items = listItinerary({ status: "open" }).slice(0, 5);
  } catch {
    items = [];
  }

  return (
    <section className="soft-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="soft-title flex items-center gap-2">
          <ListChecks size={18} strokeWidth={1.75} className="text-green" aria-hidden />
          Itinerary
        </h2>
        <Link href="/itinerary" className="text-[13px] text-hud-ink-dim hover:text-foreground">
          Open →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Nothing captured.{" "}
          <Link href="/itinerary" className="text-foreground underline">
            Add something
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => (
            <li key={it.id} className="break-words text-[13px] text-foreground/90">
              · {it.body}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
