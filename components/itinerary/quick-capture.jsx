"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X, LayoutDashboard, ListChecks, CalendarRange, PenLine } from "lucide-react";

// Floating action button → speed-dial. Three nav actions (Mission Control,
// Itinerary, Review) plus a quick "Add to itinerary" capture so you can jot a
// note without leaving the page. Mounted on every dashboard page.
const NAV = [
  { href: "/", label: "Mission Control", icon: LayoutDashboard },
  { href: "/itinerary", label: "Itinerary", icon: ListChecks },
  { href: "/review", label: "Review", icon: CalendarRange },
];

export default function QuickCapture({ projects = [] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [capture, setCapture] = useState(false);
  const [body, setBody] = useState("");
  const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    if (capture) {
      const t = setTimeout(() => taRef.current?.focus(), 60);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [capture]);

  async function add() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, project: project || null }),
      });
      if (res.ok) {
        setBody("");
        setFlash(true);
        setTimeout(() => setFlash(false), 1300);
        taRef.current?.focus();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const pill =
    "inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[14px] font-medium shadow-lg shadow-black/30 transition active:scale-95";

  return (
    <>
      {menu && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(false)} aria-hidden />
      )}

      <div className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
        {menu && (
          <>
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  className={`${pill} ${active ? "border-green/50 bg-green/15 text-foreground" : "border-hud-border bg-card text-foreground"}`}
                >
                  <Icon size={18} strokeWidth={1.75} className="text-green" aria-hidden />
                  {label}
                </Link>
              );
            })}
            {/* Quick capture — add a note without leaving the page */}
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setCapture(true);
              }}
              className={`${pill} border-green/50 bg-green/15 text-foreground`}
            >
              <PenLine size={18} strokeWidth={1.75} className="text-green" aria-hidden />
              Add to itinerary
            </button>
          </>
        )}
        <button
          onClick={() => setMenu((o) => !o)}
          aria-label={menu ? "Close menu" : "Open menu"}
          className="grid size-14 place-items-center rounded-full bg-green text-background shadow-lg shadow-black/40 transition active:scale-95"
        >
          {menu ? <X size={26} strokeWidth={2} aria-hidden /> : <Plus size={28} strokeWidth={2} aria-hidden />}
        </button>
      </div>

      {/* Itinerary capture sheet */}
      {capture && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCapture(false)} />
          <div
            className="relative z-10 w-full rounded-t-2xl border border-hud-border bg-card p-4 shadow-2xl sm:max-w-md sm:rounded-2xl"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-foreground">Add to itinerary</span>
              <button
                onClick={() => setCapture(false)}
                aria-label="Close"
                className="px-2 text-xl leading-none text-hud-ink-dim active:text-foreground"
              >
                ×
              </button>
            </div>
            <textarea
              ref={taRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  add();
                }
              }}
              rows={3}
              placeholder="What do you want to work on? (Enter to save, mic to dictate)"
              className="hud-input w-full resize-none text-base"
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="hud-input min-h-11 flex-1 text-sm"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.rel} value={p.rel}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={add}
                disabled={busy || !body.trim()}
                className="btn-soft btn-soft-primary min-h-11 px-5"
              >
                {flash ? "Added ✓" : "Add"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-hud-ink-dim">
              Stays open so you can add several.{" "}
              <a href="/itinerary" className="text-green underline">
                Open itinerary →
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
