"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ListChecks, CalendarRange } from "lucide-react";
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
      : "hidden md:flex sticky top-9 h-[calc(100dvh-2.25rem)] w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar";

  return (
    <aside className={asideClass}>
      <div className="flex flex-col gap-2.5 border-b border-hud-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="soft-title text-[15px]">Projects</span>
          <NewProjectButton />
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name"
          className="hud-input text-[13px]"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip value="all"     active={filter === "all"}     onClick={() => setFilter("all")}>All</FilterChip>
          <FilterChip value="active"  active={filter === "active"}  onClick={() => setFilter("active")}>Active</FilterChip>
          <FilterChip value="blocked" active={filter === "blocked"} onClick={() => setFilter("blocked")}>Blocked</FilterChip>
          <FilterChip value="stale"   active={filter === "stale"}   onClick={() => setFilter("stale")}>Stale</FilterChip>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" onClick={() => onNavigate?.()}>
        <NavLink href="/" icon={LayoutDashboard} label="Mission Control" active={pathname === "/"}>
          <span className="tabular-nums text-[12px] text-foreground/80">{total}</span>
        </NavLink>
        <NavLink
          href="/itinerary"
          icon={ListChecks}
          label="Itinerary"
          active={pathname === "/itinerary" || pathname?.startsWith("/itinerary/")}
        />
        <NavLink
          href="/review"
          icon={CalendarRange}
          label="Review"
          active={pathname === "/review" || pathname?.startsWith("/review/")}
        />

        <div className="mx-3 my-2 border-b border-hud-border/60" />

        <ul className="flex flex-col">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-hud-ink-dim">No matches</li>
          ) : filtered.map((p) => {
            // Locally-checked-out repos open their briefing; GitHub-only repos
            // (no local checkout) have no briefing, so link to the repo on
            // GitHub (new tab) — or /repos if we have no url.
            // Every tracked project (local OR GitHub-only) has its own internal
            // briefing page at /p/<rel>. The "View on GitHub" link lives on that
            // page now, not here.
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
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      p.status === "active" ? "bg-green"
                        : p.status === "blocked" ? "bg-hot"
                        : p.status === "paused" ? "bg-warm"
                        : "bg-muted-foreground/50"
                    )}
                  />
                  <span className="flex-1 min-w-0 truncate text-[13px] leading-tight">{p.name}</span>
                  <span className={cn("text-[11px] shrink-0 tabular-nums", staleTone(p.staleDays))}>
                    {p.open > 0 ? p.open : "·"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-hud-border px-3 py-3 pb-4 text-[12px] text-hud-ink-dim flex items-center justify-between">
        <span>Showing {filtered.length} of {projects.length}</span>
      </div>
    </aside>
  );
}

function NavLink({ href, icon: Icon, label, active, children }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "mx-2 mb-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
      )}
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span className="flex-1 text-[14px] font-medium">{label}</span>
      {children}
    </Link>
  );
}
