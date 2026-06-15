"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, ListChecks, FolderGit2 } from "lucide-react";

// Floating action button → a small speed-dial. Tap it to reveal quick actions
// (Projects, Itinerary). Itinerary opens an inline capture sheet so you can drop
// a task without leaving the page. Mounted on every dashboard page.
export default function QuickCapture({ projects = [] }) {
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

  const actionPill =
    "inline-flex items-center gap-2.5 rounded-full border border-hud-border bg-card px-4 py-2.5 text-[14px] font-medium text-foreground shadow-lg shadow-black/30 transition active:scale-95";

  return (
    <>
      {/* Tap-away backdrop for the speed-dial */}
      {menu && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setMenu(false)}
          aria-hidden
        />
      )}

      {/* Speed-dial: actions stack above the FAB */}
      <div className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
        {menu && (
          <>
            <Link href="/" onClick={() => setMenu(false)} className={actionPill}>
              <FolderGit2 size={18} strokeWidth={1.75} className="text-green" aria-hidden />
              Projects
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setCapture(true);
              }}
              className={actionPill}
            >
              <ListChecks size={18} strokeWidth={1.75} className="text-green" aria-hidden />
              Itinerary
            </button>
          </>
        )}
        <button
          onClick={() => setMenu((o) => !o)}
          aria-label={menu ? "Close actions" : "Open actions"}
          className="grid size-14 place-items-center rounded-full bg-green text-background shadow-lg shadow-black/40 transition active:scale-95"
        >
          {menu ? (
            <X size={26} strokeWidth={2} aria-hidden />
          ) : (
            <Plus size={28} strokeWidth={2} aria-hidden />
          )}
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
