import Link from "next/link";
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
    <section className="rounded-xl border border-hud-border bg-card/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="hud-label">Itinerary</h2>
        <Link href="/itinerary" className="hud-mono text-[11px] text-hud-ink-dim hover:text-foreground">
          open →
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
