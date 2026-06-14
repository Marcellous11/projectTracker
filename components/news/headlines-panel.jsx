import Module from "@/components/hud/module.jsx";
import { relativeAge } from "@/lib/time.js";

const SCOPE_TONE = {
  federal: "text-foreground",
  world:   "text-[var(--color-blue)]",
  local:   "text-green",
  context: "text-hud-ink-dim",
};

const SOURCE_BLURB = {
  USA:  "Google News · US Nation",
  AP:   "Associated Press",
  NPR:  "National Public Radio",
  BBC:  "BBC World",
  AJZ:  "Al Jazeera English",
  RTRS: "Reuters",
  GDLT: "GDELT Project · world wire",
  RDDT: "Reddit · local",
  WCE:  "Wikipedia · on this day",
};

/**
 * Renders a vertical list of headlines grouped by source. Used inside each
 * /news tab. Items are pre-fetched server-side by the page.
 */
export default function HeadlinesPanel({ items = [], scope, emptyHint = null, title = "// HEADLINES", caption = "" }) {
  // Group by source, preserving the input ordering within each group.
  const groups = new Map();
  for (const it of items) {
    if (scope && it.scope !== scope) continue;
    if (!groups.has(it.source)) groups.set(it.source, []);
    groups.get(it.source).push(it);
  }

  if (!groups.size) {
    return (
      <Module title={title} voice="signals" caption={caption}>
        <p className="hud-mono text-[11px] text-hud-ink-dim px-3 py-4">
          {emptyHint || "// no headlines available right now"}
        </p>
      </Module>
    );
  }

  return (
    <Module title={title} voice="signals" caption={caption}>
      <div className="flex flex-col gap-5">
        {Array.from(groups.entries()).map(([source, group]) => (
          <section key={source}>
            <header className="mb-2 flex items-baseline gap-2">
              <span className={`hud-label ${SCOPE_TONE[group[0]?.scope] || ""}`}>// {source}</span>
              <span className="hud-mono text-[10px] text-hud-ink-dim">{SOURCE_BLURB[source] || ""}</span>
              <span className="ml-auto hud-mono text-[10px] text-hud-ink-dim">{group.length}</span>
            </header>
            <ul className="flex flex-col">
              {group.map((it) => (
                <li key={it.id} className="border-b border-hud-border/40 last:border-b-0 py-1.5">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-baseline gap-3 hover:bg-foreground/5 px-1 -mx-1 py-0.5 rounded transition-colors"
                  >
                    <span className="hud-mono text-[10px] text-hud-ink-dim tabular-nums shrink-0 w-[68px]">
                      {relativeAge(it.ts) || "—"}
                    </span>
                    <span className="text-[13px] text-foreground/90 leading-snug">
                      {it.title}
                      {it.summary && (
                        <span className="block text-[11px] text-hud-ink-dim mt-0.5 line-clamp-2">
                          {it.summary}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Module>
  );
}
