import Link from "next/link";
import Module from "@/components/hud/module.jsx";
import { getAllRecentCommits } from "@/lib/git-aggregate.js";

function relTime(d) {
  if (!d) return "—";
  const s = Math.round((Date.now() - +new Date(d)) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default async function CommitsFeed({ projects, limit = 20 }) {
  const all = await getAllRecentCommits(projects, 6);
  const sorted = all
    .sort((a, b) => +new Date(b.commit.dateISO) - +new Date(a.commit.dateISO))
    .slice(0, limit);

  return (
    <Module
      title="RECENT COMMITS"
      voice="signals"
      caption={`across ${new Set(sorted.map((r) => r.rel)).size} repos`}
      right={<span className="hud-num text-[11px] text-hud-ink-dim">{sorted.length}</span>}
    >
      {sorted.length === 0 ? (
        <p className="text-[13px] text-hud-ink-dim">No commits in window</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
          {sorted.map((r, i) => (
            <li key={i}>
              <Link
                href={`/p/${r.rel.split("/").map(encodeURIComponent).join("/")}`}
                className="mc-stack flex items-baseline gap-3 py-1 px-2 -mx-2 rounded transition-colors hover:bg-foreground/5"
              >
                <span className="hud-mono text-[11px] text-green shrink-0 tabular-nums">
                  {r.commit.short}
                </span>
                <span className="flex-1 min-w-0 text-[12px] truncate">{r.commit.subject}</span>
                <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 truncate max-w-[120px]">
                  {r.name}
                </span>
                <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 tabular-nums w-7 text-right">
                  {relTime(r.commit.dateISO)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}
