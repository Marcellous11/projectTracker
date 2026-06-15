import Link from "next/link";
import Module from "@/components/hud/module.jsx";
import { codename } from "@/lib/codename.js";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function stalenessTone(days) {
  if (days == null) return "muted";
  if (days >= 14) return "hot";
  if (days >= 7) return "warm";
  return "green";
}

const TONE_BAR = {
  green: "bg-green",
  warm: "bg-warm",
  hot: "bg-hot",
  muted: "bg-muted-foreground/30",
};

function relTime(d) {
  if (!d) return "—";
  const s = Math.round((Date.now() - +new Date(d)) / 1000);
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function NextActions({ projects, limit = 8 }) {
  const items = projects
    .filter((p) => p?.valid && p.status === "active" && p.nextAction)
    .sort((a, b) => {
      const sa = a.staleDays ?? -1;
      const sb = b.staleDays ?? -1;
      if (sb !== sa) return sb - sa;
      return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    })
    .slice(0, limit);

  return (
    <Module
      title="NEXT ACTIONS"
      voice="ops"
      caption="ranked by staleness · priority"
      right={<span className="hud-num text-[11px] text-hud-ink-dim">{items.length} queued</span>}
    >
      {items.length === 0 ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// no next actions on record</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((p) => {
            const tone = stalenessTone(p.staleDays);
            return (
              <li key={p.rel} className="group relative">
                <Link
                  href={`/p/${p.rel.split("/").map(encodeURIComponent).join("/")}`}
                  className="mc-stack flex items-start gap-3 py-2 pl-3 pr-2 -mx-2 rounded transition-opacity hover:bg-foreground/5"
                >
                  <span
                    className={`mt-1.5 inline-block h-3 w-[2px] shrink-0 ${TONE_BAR[tone]}`}
                    aria-hidden
                  />
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 w-[88px] truncate uppercase tracking-wider">
                    {codename(p.rel)}
                  </span>
                  <span className="flex-1 min-w-0 text-[13px] leading-tight truncate">
                    {firstLine(p.nextAction)}
                  </span>
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 tabular-nums">
                    {p.staleDays != null ? `${p.staleDays}d` : "—"}
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

function firstLine(s) {
  const line = String(s || "").split("\n").find((l) => l.trim());
  return (line || "").trim();
}
