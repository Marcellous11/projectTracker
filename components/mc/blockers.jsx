import Link from "next/link";
import Module from "@/components/hud/module.jsx";
import { codename } from "@/lib/codename.js";

function isBlocked(p) {
  if (!p?.blockers) return false;
  const s = String(p.blockers).trim().toLowerCase();
  if (!s || s === "none" || s === "n/a") return false;
  return true;
}

export default function Blockers({ projects }) {
  const items = projects
    .filter(isBlocked)
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));

  return (
    <Module
      title="BLOCKERS"
      voice="ops"
      accent={items.length > 0 ? "hot" : null}
      caption={items.length > 0 ? "active incidents" : "no incidents"}
      right={
        <span className={`hud-num text-[11px] ${items.length > 0 ? "text-hot" : "text-hud-ink-dim"}`}>
          {items.length}
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// all clear</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((p) => (
            <li key={p.rel}>
              <Link
                href={`/p/${p.rel.split("/").map(encodeURIComponent).join("/")}`}
                className="mc-stack flex items-start gap-3 py-2 pl-3 pr-2 -mx-2 rounded transition-opacity hover:bg-hot/5"
              >
                <span className="mt-1.5 inline-block h-3 w-[2px] bg-hot shrink-0 hud-pulse" aria-hidden />
                <span className="hud-mono text-[10px] text-hot shrink-0 w-[88px] truncate uppercase tracking-wider">
                  {codename(p.rel)}
                </span>
                <span className="flex-1 min-w-0 text-[13px] leading-tight">
                  {firstLine(p.blockers)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}

function firstLine(s) {
  const line = String(s || "").split("\n").find((l) => l.trim());
  return (line || "").trim();
}
