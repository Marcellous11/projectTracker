import { cn } from "@/lib/utils";

/**
 * Shared module shell. Three voices share grammar, differ in header treatment:
 *   ops      — plain uppercase mono label (Mission Control modules)
 *   briefing — same + a quiet coordinate-style caption under the title
 *   signals  — label is prefixed with "//" via ::before (sessions, ticker, timeline)
 *
 * Accent: thin top inset shadow in a signal color.
 */
export default function Module({
  title,
  caption,
  voice = "ops",
  accent = null,
  right = null,
  className = "",
  bodyClassName = "",
  glow = null,
  icon: Icon = null,
  children,
}) {
  return (
    <section
      className={cn(
        "hud-module",
        voice === "signals" && "hud-voice-signals",
        accent === "green" && "hud-accent-green",
        accent === "warm" && "hud-accent-warm",
        accent === "hot" && "hud-accent-hot",
        accent === "blue" && "hud-accent-blue",
        glow === "green" && "hud-glow-green",
        glow === "hot" && "hud-glow-hot",
        glow === "blue" && "hud-glow-blue",
        className
      )}
    >
      {(title || right) && (
        <header className="hud-module-header">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon size={17} strokeWidth={1.75} className="shrink-0 text-green" aria-hidden />}
            <div className="flex min-w-0 flex-col gap-0.5">
              {title && <span className="soft-title truncate">{title}</span>}
              {caption && (
                <span className="text-[12px] text-hud-ink-dim truncate">{caption}</span>
              )}
            </div>
          </div>
          {right && <div className="shrink-0 flex items-center gap-3">{right}</div>}
        </header>
      )}
      <div className={cn("hud-module-body", bodyClassName)}>{children}</div>
    </section>
  );
}
