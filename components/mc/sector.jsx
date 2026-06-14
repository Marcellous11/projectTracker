/**
 * Labeled sector divider. Wraps a row of modules under a "// SECTOR X · TITLE"
 * caption — the visual rhythm that turns the home grid into an operations
 * console rather than a list of cards.
 */
export default function Sector({ label, title, accent = "default", children }) {
  const tones = {
    default: "text-hud-label",
    green: "text-green",
    warm: "text-warm",
    hot: "text-hot",
    blue: "text-[var(--color-blue)]",
  };
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 px-1">
        <span className={`hud-mono uppercase tracking-[0.22em] text-[10px] ${tones[accent]}`}>
          // SECTOR {label}
        </span>
        <span className="hud-mono uppercase tracking-[0.18em] text-[10px] text-hud-ink-dim">
          · {title}
        </span>
        <span className="flex-1 border-b border-hud-border/60" />
      </div>
      {children}
    </section>
  );
}
