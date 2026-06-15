"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar.jsx";

// Mobile-only top bar + slide-in drawer. The desktop sidebar is hidden under
// `md:`, so on a phone this is the way into the roster + nav. Reuses the same
// Sidebar component in variant="drawer" so there's one source of truth.
export default function MobileNav({ projects, total, root }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="md:hidden sticky top-9 z-40 flex items-center justify-between gap-3 border-b border-hud-border bg-background/90 px-4 py-2 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="flex items-center gap-2 rounded-md border border-hud-border px-3 py-1.5 text-sidebar-foreground/85 active:bg-sidebar-accent/60"
        >
          <span className="text-base leading-none">☰</span>
          <span className="text-[13px] font-medium">Projects</span>
        </button>
        <span className="text-[12px] text-hud-ink-dim">
          {projects.length} projects
        </span>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col border-r border-hud-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-hud-border bg-sidebar px-3 py-2">
              <span className="text-[13px] font-medium text-hud-ink-dim">
                Navigation
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="px-2 text-xl leading-none text-hud-ink-dim active:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Sidebar
                projects={projects}
                total={total}
                root={root}
                variant="drawer"
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
