import Link from "next/link";
import Module from "@/components/hud/module.jsx";
import { codename } from "@/lib/codename.js";

function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export default function StaleProjects({ projects }) {
  const items = projects
    .filter((p) => p?.valid && p.status === "active" && (p.staleDays ?? 0) >= 7)
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));

  return (
    <Module
      title="STALE"
      voice="ops"
      caption="active · 7d+ since last work"
      right={
        <span className="hud-num text-[11px] text-hud-ink-dim">{items.length}</span>
      }
    >
      {items.length === 0 ? (
        <p className="text-[13px] text-hud-ink-dim">Nothing going cold</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((p) => {
            const tone = (p.staleDays ?? 0) >= 14 ? "text-hot" : "text-warm";
            return (
              <li key={p.rel}>
                <Link
                  href={`/p/${p.rel.split("/").map(encodeURIComponent).join("/")}`}
                  className="mc-stack flex items-baseline gap-3 py-1.5 pl-2 pr-1 -mx-2 rounded transition-opacity hover:bg-foreground/5"
                >
                  <span className={`hud-num text-[14px] shrink-0 w-9 text-right ${tone}`}>
                    {p.staleDays}d
                  </span>
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 uppercase tracking-wider w-[80px] truncate">
                    {codename(p.rel)}
                  </span>
                  <span className="flex-1 min-w-0 text-[12px] truncate">{p.name}</span>
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0">
                    {fmtDate(p.lastWorked)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Module>
  );
}
