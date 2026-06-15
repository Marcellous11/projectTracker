import { Pill, HexPill } from "@/components/hud/pill.jsx";
import Module from "@/components/hud/module.jsx";
import MetaEditor from "@/components/project/meta-editor.jsx";
import { codename } from "@/lib/codename.js";
import { relativeAge, formatDate } from "@/lib/time.js";

function statusTone(status) {
  if (status === "active") return "active";
  if (status === "blocked") return "blocked";
  if (status === "paused") return "paused";
  if (status === "done") return "done";
  return "untracked";
}

/**
 * Briefing for a GitHub-only tracked repo (no local checkout). Everything is
 * sourced from the github-sync snapshot on the project: last commit, open PRs,
 * CI, recent-commits timeline, plus the same SQLite-backed notes editor that
 * local projects use. Mirrors the HUD module styling of the local briefing.
 */
export default function GithubBriefing({ project, rel, meta }) {
  const gh = project?.github || null;
  const tone = statusTone(project?.status);
  const displayCodename = meta?.codename || codename(rel);
  const url = gh?.url || null;
  const last = gh?.lastCommit || null;
  const prs = Array.isArray(gh?.openPRs) ? gh.openPRs : [];
  const commits = Array.isArray(gh?.recentCommits) ? gh.recentCommits : [];
  const ciState = gh?.ci?.state || "none";

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <section className="flex flex-col gap-3 pb-4 border-b border-hud-border">
        <div className="flex flex-wrap items-center gap-3">
          <HexPill tone={tone} className="shrink-0">{displayCodename}</HexPill>
          <h1 className="hud-mono tracking-tight text-2xl truncate min-w-0">
            {project?.name || "Untitled"}
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <Pill tone={tone}>{project?.status || "untracked"}</Pill>
            {project?.staleDays != null && (
              <Pill tone={project.staleDays >= 14 ? "blocked" : project.staleDays >= 7 ? "paused" : "active"}>
                {project.staleDays}d stale
              </Pill>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 inline-flex items-center rounded-lg border border-hud-border px-2.5 text-[10px] hud-mono uppercase tracking-[0.18em] text-hud-ink-dim hover:text-foreground hover:border-hud-border-strong transition-colors"
              >
                View on GitHub ↗
              </a>
            )}
            <MetaEditor rel={rel} meta={meta} />
          </div>
        </div>

        <div className="hud-mono text-[11px] text-hud-ink-dim flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>REPO <span className="text-foreground/80">{project?.repo || "—"}</span></span>
          <span>BRANCH <span className="text-foreground/80">{gh?.defaultBranch || "—"}</span></span>
          <span>VISIBILITY <span className="text-foreground/80">{gh ? (gh.private ? "private" : "public") : "—"}</span></span>
          <span>PUSHED <span className="text-foreground/80">{relativeAge(gh?.pushedAt) || "—"}</span></span>
        </div>
      </section>

      {gh?.error && (
        <Module title="SYNC" voice="briefing" caption="github-state snapshot">
          <p className="hud-mono text-[11px] text-hot">// github sync error: {gh.error}</p>
        </Module>
      )}

      {/* VITALS */}
      <div className="grid gap-4 md:grid-cols-2">
        <Module title="LAST COMMIT" voice="briefing" caption={last ? relativeAge(last.date) || "" : ""}>
          {last ? (
            <a
              href={last.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mc-stack flex items-baseline gap-2.5 min-w-0 hover:text-foreground"
            >
              <span className="hud-mono text-green text-[11px] shrink-0">{last.sha}</span>
              <span className="flex-1 min-w-0 text-[12px] truncate">{last.message}</span>
              <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0">{last.author}</span>
            </a>
          ) : (
            <p className="hud-mono text-[11px] text-hud-ink-dim">// no commit data</p>
          )}
        </Module>

        <Module
          title="VITALS"
          voice="briefing"
          caption={`CI ${ciState} · ${gh?.openIssues ?? 0} issues · ${prs.length} PRs`}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 hud-mono text-[11px]">
            <Stat label="CI" value={ciState} />
            <Stat label="OPEN PRs" value={String(prs.length)} />
            <Stat label="OPEN ISSUES" value={String(gh?.openIssues ?? 0)} />
            <Stat label="PUSHED" value={formatDate(gh?.pushedAt) || "—"} />
            <Stat label="DEFAULT BRANCH" value={gh?.defaultBranch || "—"} />
            <Stat label="VISIBILITY" value={gh ? (gh.private ? "private" : "public") : "—"} />
          </dl>
        </Module>
      </div>

      {/* OPEN PRs */}
      <Module title="OPEN PULL REQUESTS" voice="briefing" caption={`${prs.length} open`}>
        {prs.length ? (
          <ol className="flex flex-col gap-1.5">
            {prs.map((pr) => (
              <li key={pr.number} className="flex items-baseline gap-2.5 min-w-0">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-baseline gap-2.5 min-w-0 flex-1 hover:text-foreground"
                >
                  <span className="hud-mono text-[var(--color-blue)] text-[11px] shrink-0">#{pr.number}</span>
                  <span className="flex-1 min-w-0 text-[12px] truncate">{pr.title}</span>
                  {pr.draft && (
                    <span className="hud-mono text-[9px] uppercase text-hud-ink-dim shrink-0">draft</span>
                  )}
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0">
                    {relativeAge(pr.updatedAt)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hud-mono text-[11px] text-hud-ink-dim">// no open pull requests</p>
        )}
      </Module>

      {/* TIMELINE */}
      <Module
        title="ACTIVITY TIMELINE"
        voice="briefing"
        caption={`${commits.length} recent commits · ${gh?.defaultBranch || "default"}`}
      >
        {commits.length ? (
          <ol className="border-l border-hud-border pl-4 flex flex-col gap-1.5">
            {commits.map((c, i) => (
              <li key={`${c.sha}-${i}`} className="relative flex items-baseline gap-2.5 min-w-0">
                <span className="absolute left-[-18px] top-2 size-1.5 rounded-full bg-green" aria-hidden />
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-baseline gap-2.5 min-w-0 flex-1 hover:text-foreground"
                >
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 w-[88px] tabular-nums">
                    {formatDate(c.date) || "—"}
                  </span>
                  <span className="hud-mono text-green text-[10px] shrink-0">{c.sha}</span>
                  <span className="flex-1 min-w-0 text-[12px] truncate">{c.message}</span>
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 hidden sm:inline">
                    {c.author}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hud-mono text-[11px] text-hud-ink-dim">// no recent commits</p>
        )}
      </Module>

      {/* NOTES */}
      <Module title="NOTES" voice="briefing" caption="internal · saved to this project">
        {meta?.notes ? (
          <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{meta.notes}</p>
        ) : (
          <p className="hud-mono text-[11px] text-hud-ink-dim">
            // no notes yet — use “edit meta” above to add some
          </p>
        )}
      </Module>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[9px] uppercase tracking-[0.18em] text-hud-ink-dim">{label}</dt>
      <dd className="text-foreground/90 truncate">{value}</dd>
    </div>
  );
}
