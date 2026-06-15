import Link from "next/link";
import { GitPullRequest, ListChecks, Clock3 } from "lucide-react";

function hrefFor(rel) {
  return "/p/" + rel.split("/").map(encodeURIComponent).join("/");
}
function ago(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
const STATUS_DOT = {
  active: "bg-green",
  blocked: "bg-hot",
  paused: "bg-warm",
  done: "bg-muted-foreground",
  untracked: "bg-muted-foreground/40",
};

// One project at a glance: name + status, the AI one-liner, a few live signals.
// Tap → the project page.
export default function ProjectCard({ p, itineraryCount = 0 }) {
  const g = p.github || {};
  const prs = (g.openPRs || []).length;
  const last = ago(g.pushedAt || g.lastCommit?.date);
  const summary = g.aiSummary || p.nextAction || null;

  return (
    <Link
      href={hrefFor(p.rel)}
      prefetch={false}
      className="soft-card soft-card-hover block p-5"
    >
      <div className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[p.status] || "bg-muted-foreground/40"}`} />
        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{p.name}</span>
        {g.ci?.state === "failure" && (
          <span className="shrink-0 text-[11px] font-medium text-hot">CI failing</span>
        )}
      </div>
      {summary && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{summary}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-hud-ink-dim">
        {prs > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <GitPullRequest size={14} strokeWidth={1.75} aria-hidden />
            <span className="tabular-nums">{prs}</span> PR{prs > 1 ? "s" : ""}
          </span>
        )}
        {itineraryCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={14} strokeWidth={1.75} aria-hidden />
            <span className="tabular-nums">{itineraryCount}</span> itinerary
          </span>
        )}
        {last && (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={14} strokeWidth={1.75} aria-hidden />
            {last} ago
          </span>
        )}
      </div>
    </Link>
  );
}
