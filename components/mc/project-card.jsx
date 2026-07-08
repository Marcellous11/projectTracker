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

const STATUS_LABEL = {
  active: "Active",
  blocked: "Blocked",
  paused: "Paused",
  done: "Done",
  untracked: "Untracked",
};
const STATUS_PILL = {
  active: "pill-active",
  blocked: "pill-blocked",
  paused: "pill-paused",
  done: "pill-done",
  untracked: "pill-untracked",
};

// One project at a glance: name + status + priority, the AI one-liner, a
// progress bar (% to the finish line, from the STATUS To-do list), and a few
// live signals. Tap → the project page.
export default function ProjectCard({ p, itineraryCount = 0 }) {
  const g = p.github || {};
  const prs = (g.openPRs || []).length;
  const last = ago(g.pushedAt || g.lastCommit?.date);
  const summary = g.aiSummary || p.nextAction || null;

  const c = p.todoCounts || {};
  const total = (c.todo || 0) + (c.doing || 0) + (c.done || 0);
  const isDone = p.status === "done";
  // Done projects read as complete even if optional items linger below.
  const pct = isDone ? 100 : total ? Math.round(((c.done || 0) / total) * 100) : null;

  return (
    <Link
      href={hrefFor(p.rel)}
      prefetch={false}
      className="soft-card soft-card-hover flex flex-col gap-3 p-5"
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{p.name}</span>
        {p.priority && (
          <span className={`prio prio-${p.priority} shrink-0`}>{p.priority}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`pill ${STATUS_PILL[p.status] || "pill-untracked"}`}>
          {STATUS_LABEL[p.status] || "Untracked"}
        </span>
        {g.ci?.state === "failure" && (
          <span className="shrink-0 text-[11px] font-medium text-hot">CI failing</span>
        )}
      </div>

      {/* Progress — the finish-line meter. */}
      {pct != null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-muted-foreground">
              {isDone ? "Complete" : "Progress"}
            </span>
            <span className="hud-num font-semibold text-foreground">
              {pct}%{!isDone && total ? <span className="text-muted-foreground"> · {c.done || 0}/{total}</span> : null}
            </span>
          </div>
          <div className="cc-bar">
            <span className="cc-bar-fill" data-done={isDone ? "true" : "false"} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {summary && (
        <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{summary}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[12px] text-hud-ink-dim">
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
