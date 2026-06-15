function hrefFor(rel) {
  return "/p/" + rel.split("/").map(encodeURIComponent).join("/");
}

// The "act on this" strip: things that want your attention right now. Renders
// nothing when there's nothing — so a quiet day shows a clean page.
export default function NeedsYou({ projects }) {
  const items = [];
  for (const p of projects) {
    const g = p.github || {};
    if (g.ci?.state === "failure") {
      items.push({ tone: "hot", label: p.name, text: "CI failing", href: hrefFor(p.rel) });
    }
    const prs = (g.openPRs || []).filter((pr) => !pr.draft);
    if (prs.length) {
      items.push({
        tone: "blue",
        label: p.name,
        text: `${prs.length} PR${prs.length > 1 ? "s" : ""} awaiting merge`,
        href: g.url ? `${g.url}/pulls` : hrefFor(p.rel),
      });
    }
    if (p.status === "blocked") {
      items.push({ tone: "hot", label: p.name, text: "blocked", href: hrefFor(p.rel) });
    } else if (p.status === "active" && (p.staleDays ?? 0) >= 7) {
      items.push({ tone: "warm", label: p.name, text: `going stale · ${p.staleDays}d`, href: hrefFor(p.rel) });
    }
  }
  if (!items.length) return null;

  const dot = { hot: "bg-hot", warm: "bg-warm", blue: "bg-[var(--color-blue)]" };

  return (
    <section className="soft-card p-5">
      <h2 className="hud-label mb-1">Needs you</h2>
      <ul className="flex flex-col divide-y divide-hud-border/40">
        {items.map((it, i) => (
          <li key={i}>
            <a
              href={it.href}
              target={it.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="mc-stack flex items-center gap-2 py-2 text-[13px] transition-colors hover:text-foreground"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${dot[it.tone]}`} />
              <span className="font-medium text-foreground">{it.label}</span>
              <span className="min-w-0 text-muted-foreground">— {it.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
