"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Floating action button mounted on every dashboard page. Tap it to drop an
// item into the itinerary without navigating away — capture while you read.
export default function QuickCapture({ projects = [] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => taRef.current?.focus(), 60);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // The itinerary page already has a full capture box.
  if (pathname === "/itinerary") return null;

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick add to itinerary"
        className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-green text-background shadow-lg shadow-black/40 transition active:scale-95 md:right-8 md:bottom-8"
      >
        <span className="text-3xl leading-none">＋</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="relative z-10 w-full rounded-t-2xl border border-hud-border bg-card p-4 shadow-2xl sm:max-w-md sm:rounded-2xl"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="hud-mono text-[11px] uppercase tracking-[0.2em] text-hud-label">
                // Quick capture
              </span>
              <button
                onClick={() => setOpen(false)}
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
              placeholder="Add to itinerary… (Enter to save, Shift+Enter for newline, mic to dictate)"
              className="w-full resize-none rounded-lg border border-hud-border bg-background/70 px-3 py-2.5 text-base text-foreground outline-none focus:border-hud-border-strong"
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="min-h-11 flex-1 rounded-lg border border-hud-border bg-background/70 px-3 text-sm text-foreground outline-none"
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
                className="min-h-11 rounded-lg bg-green/20 px-5 text-sm font-semibold text-green transition disabled:opacity-40"
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
