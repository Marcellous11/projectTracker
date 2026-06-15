import { cn } from "@/lib/utils";

/**
 * Soft status pill. Rounded, normal-case chip; `tone` maps to the signal
 * palette (dashed for untracked).
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
