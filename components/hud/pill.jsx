import { cn } from "@/lib/utils";

/**
 * Status pill in the HUD palette. Renders as a thin-bordered uppercase
 * mono chip. `tone` maps to the signal palette + dashed for untracked.
 */
export function Pill({ tone = "active", className = "", children }) {
  const tones = {
    active: "pill-active",
    blocked: "pill-blocked",
    paused: "pill-paused",
    done: "pill-done",
    untracked: "pill-untracked",
    blue: "pill-blue",
  };
  return <span className={cn("pill", tones[tone] ?? "pill-done", className)}>{children}</span>;
}

/**
 * Codename hex pill. Use sparingly — primary surfaces (briefing header,
 * sidebar hover), not in dense lists.
 */
export function HexPill({ tone = "active", className = "", children }) {
  const tones = {
    active: "bg-green/15 text-green",
    blocked: "bg-hot/15 text-hot",
    paused: "bg-warm/15 text-warm",
    done: "bg-muted-foreground/10 text-muted-foreground",
    untracked: "bg-muted-foreground/10 text-muted-foreground",
    blue: "bg-[color:var(--color-blue)]/15 text-[var(--color-blue)]",
  };
  return (
    <span className={cn("hex-pill inline-block", tones[tone] ?? tones.active, className)}>
      {children}
    </span>
  );
}
