"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X, LayoutDashboard, ListChecks, CalendarRange } from "lucide-react";

// Floating action button → speed-dial navigation. Tap to reveal the three main
// pages and jump to any of them. Mounted on every dashboard page.
const ACTIONS = [
  { href: "/", label: "Mission Control", icon: LayoutDashboard },
  { href: "/itinerary", label: "Itinerary", icon: ListChecks },
  { href: "/review", label: "Review", icon: CalendarRange },
];

export default function QuickCapture() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  return (
    <>
      {menu && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setMenu(false)}
          aria-hidden
        />
      )}

      <div className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
        {menu &&
          ACTIONS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenu(false)}
                className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[14px] font-medium shadow-lg shadow-black/30 transition active:scale-95 ${
                  active
                    ? "border-green/50 bg-green/15 text-foreground"
                    : "border-hud-border bg-card text-foreground"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} className="text-green" aria-hidden />
                {label}
              </Link>
            );
          })}
        <button
          onClick={() => setMenu((o) => !o)}
          aria-label={menu ? "Close menu" : "Open menu"}
          className="grid size-14 place-items-center rounded-full bg-green text-background shadow-lg shadow-black/40 transition active:scale-95"
        >
          {menu ? (
            <X size={26} strokeWidth={2} aria-hidden />
          ) : (
            <Plus size={28} strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
    </>
  );
}
