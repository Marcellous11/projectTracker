/**
 * Section divider. Renders a plain, readable section title with a soft rule —
 * a calm visual rhythm for grouping modules on the home grid.
 */
export default function Sector({ label, title, accent = "default", children }) {
  const tones = {
    default: "text-foreground",
    green: "text-green",
    warm: "text-warm",
    hot: "text-hot",
    blue: "text-[var(--color-blue)]",
  };
  const heading = title || label;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 px-1">
        <span className={`soft-title ${tones[accent]}`}>{heading}</span>
        <span className="flex-1 border-b border-hud-border/60" />
      </div>
      {children}
    </section>
  );
}
