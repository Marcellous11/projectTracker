"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { codename } from "@/lib/codename.js";
import NewProjectButton from "@/components/new-project-button.jsx";

function hrefFor(rel) {
  return "/p/" + rel.split("/").map(encodeURIComponent).join("/");
}

function statusBorderClass(status) {
  switch (status) {
    case "active":    return "border-l-green/60";
    case "blocked":   return "border-l-hot/60";
    case "paused":    return "border-l-warm/60";
    case "done":      return "border-l-border";
    case "untracked": return "border-l-border border-dashed";
    default:          return "border-l-transparent";
  }
}

function staleTone(days) {
  if (days == null) return "text-muted-foreground";
  if (days >= 14) return "text-hot";
  if (days >= 7) return "text-warm";
  return "text-foreground";
}

function FilterChip({ value, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pill transition-colors cursor-pointer",
        active
          ? value === "blocked" ? "pill-blocked"
            : value === "active" ? "pill-active"
            : value === "stale" ? "pill-paused"
            : "pill-active"
          : "pill-done opacity-60 hover:opacity-100"
      )}
    >
      {children}
    </button>
  );
}

export default function Sidebar({ projects, total, root, variant = "desktop", onNavigate }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "active" | "blocked" | "stale"

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (needle && !(`${p.name} ${p.rel}`).toLowerCase().includes(needle)) return false;
      if (filter === "active" && p.status !== "active") return false;
      if (filter === "blocked" && p.status !== "blocked") return false;
      if (filter === "stale" && !(p.status === "active" && (p.staleDays ?? 0) >= 7)) return false;
      return true;
    });
  }, [projects, q, filter]);

  // Desktop: a sticky left rail, hidden on small screens (the mobile drawer
  // renders this same component with variant="drawer"). Drawer: fill its host.
  const asideClass =
    variant === "drawer"
      ? "flex h-full w-full flex-col bg-sidebar"
      : "hidden md:flex sticky top-9 h-[calc(100dvh-2.25rem)] w-64 shrink-0 flex-col border-r border-hud-border bg-sidebar/70 backdrop-blur";

  return (
    <aside className={asideClass}>
      <div className="flex flex-col gap-2 border-b border-hud-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="hud-label">// ROSTER</span>
          <div className="flex items-center gap-2 shrink-0">
            <NewProjectButton />
            <span className="hud-mono text-[10px] text-hud-ink-dim" title={root}>
              {projects.length} NODES
            </span>
          </div>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter codename / name"
          className="hud-mono text-[11px] bg-background/60 border border-hud-border rounded px-2 py-1 outline-none focus:border-hud-border-strong"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip value="all"     active={filter === "all"}     onClick={() => setFilter("all")}>ALL</FilterChip>
          <FilterChip value="active"  active={filter === "active"}  onClick={() => setFilter("active")}>ACTIVE</FilterChip>
          <FilterChip value="blocked" active={filter === "blocked"} onClick={() => setFilter("blocked")}>BLOCKED</FilterChip>
          <FilterChip value="stale"   active={filter === "stale"}   onClick={() => setFilter("stale")}>STALE</FilterChip>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" onClick={() => onNavigate?.()}>
        <Link
          href="/"
          prefetch={false}
          className={cn(
            "mx-2 mb-1 flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors",
            pathname === "/"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60"
          )}
        >
          <span className="hud-mono uppercase tracking-[0.16em] text-[11px] font-semibold">
            MISSION CONTROL
          </span>
          <span className="hud-num text-[10px] text-foreground/80">{total}</span>
        </Link>
        <Link
          href="/todos"
          prefetch={false}
          className={cn(
            "mx-2 mb-1 flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors",
            pathname === "/todos"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60"
          )}
        >
          <span className="hud-mono uppercase tracking-[0.16em] text-[10px]">
            ALL TO-DOS
          </span>
          <span className="hud-num text-[10px] text-hud-ink-dim">{total}</span>
        </Link>
        <Link
          href="/itinerary"
          prefetch={false}
          className={cn(
            "mx-2 mb-1 flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors",
            pathname === "/itinerary" || pathname?.startsWith("/itinerary/")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60"
          )}
        >
          <span className="hud-mono uppercase tracking-[0.16em] text-[10px]">
            ITINERARY
          </span>
        </Link>
        <Link
          href="/repos"
          prefetch={false}
          className={cn(
            "mx-2 mb-2 flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors",
            pathname === "/repos" || pathname?.startsWith("/repos/")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60"
          )}
        >
          <span className="hud-mono uppercase tracking-[0.16em] text-[10px]">
            REPOS
          </span>
        </Link>

        <div className="mx-3 my-1 border-b border-hud-border/60" />

        <ul className="flex flex-col">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 hud-mono text-[10px] text-hud-ink-dim">// no matches</li>
          ) : filtered.map((p) => {
            const href = hrefFor(p.rel);
            const active = pathname === href;
            const dim = p.status === "paused" || p.status === "done";
            return (
              <li key={p.rel} className="group">
                <Link
                  href={href}
                  prefetch={false}
                  className={cn(
                    "relative flex items-center gap-2 border-l-2 px-2.5 py-1.5 mx-1.5 transition-colors",
                    statusBorderClass(p.status),
                    active
                      ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/40",
                    dim && !active && "opacity-55"
                  )}
                >
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5 leading-tight">
                    <span className="truncate text-[12px]">{p.name}</span>
                    <span
                      className={cn(
                        "hud-mono text-[9px] uppercase tracking-[0.14em] truncate",
                        !p.clientColor && "text-hud-ink-dim"
                      )}
                      style={p.clientColor ? { color: p.clientColor } : undefined}
                      title={p.clientName || ""}
                    >
                      {p.codenameOverride || codename(p.rel)}
                    </span>
                  </span>
                  <span className={cn("hud-num text-[10px] shrink-0 tabular-nums", staleTone(p.staleDays))}>
                    {p.open > 0 ? p.open : "·"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-hud-border px-3 py-3 pb-4 hud-mono text-[10px] text-hud-ink-dim flex items-center justify-between">
        <span>// SHOWING {filtered.length}/{projects.length}</span>
      </div>
    </aside>
  );
}
