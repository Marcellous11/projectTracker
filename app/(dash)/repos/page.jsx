import { getGithubState } from "@/lib/github-state.js";
import { GitBranch } from "lucide-react";

export const dynamic = "force-dynamic";

function ago(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const CI_TONE = {
  success: "text-green border-green/40",
  failure: "text-hot border-hot/40",
  pending: "text-warm border-warm/40",
  none: "text-hud-ink-dim border-border",
};

export default function ReposPage() {
  const state = getGithubState();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="soft-title flex items-center gap-2 text-[20px]">
          <GitBranch size={20} strokeWidth={1.75} className="text-green" aria-hidden />
          Live repo state
        </h1>
        <span className="text-[12px] text-hud-ink-dim">
          {state.ok ? `Synced ${ago(state.generatedAt)}` : "No sync yet"}
          {state.stale && state.ok ? " · stale" : ""}
        </span>
      </header>

      {!state.ok && (
        <p className="rounded-xl border border-dashed border-hud-border px-4 py-8 text-center text-sm text-muted-foreground">
          No GitHub snapshot yet. The sync runs on a timer — give it a minute, or run
          <code className="mx-1 rounded bg-card px-1">node scripts/github-sync.js</code>.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {state.repos.map((r) => {
          const ci = CI_TONE[r.ci?.state || "none"] || CI_TONE.none;
          return (
            <li key={r.repo} className="soft-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-foreground hover:text-green">
                  {r.label}
                </a>
                <span className="rounded-full border border-hud-border px-2.5 py-0.5 text-[11px] text-hud-ink-dim">
                  {r.private ? "private" : "public"}
                </span>
                {r.project && (
                  <span className="rounded-full border border-[var(--color-blue)]/40 px-2.5 py-0.5 text-[11px] text-[var(--color-blue)]">
                    local
                  </span>
                )}
                <span className="ml-auto text-[12px] text-hud-ink-dim">
                  pushed {ago(r.pushedAt)}
                </span>
              </div>

              {r.error ? (
                <p className="mt-2 text-[12px] text-hot">sync error: {r.error}</p>
              ) : (
                <>
                  {r.lastCommit && (
                    <a
                      href={r.lastCommit.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-words text-[13px] text-foreground/85 hover:text-foreground"
                    >
                      <span className="hud-mono text-[11px] text-hud-ink-dim">{r.lastCommit.sha}</span>{" "}
                      {r.lastCommit.message}
                    </a>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className={`rounded-full border px-2.5 py-0.5 ${ci}`}>
                      CI {r.ci?.state || "none"}
                    </span>
                    <span className="text-hud-ink-dim">
                      {r.openPRs?.length || 0} open PR{(r.openPRs?.length || 0) === 1 ? "" : "s"}
                    </span>
                    {r.defaultBranch && (
                      <span className="hud-mono text-hud-ink-dim">{r.defaultBranch}</span>
                    )}
                  </div>
                  {r.openPRs?.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1 border-t border-hud-border/50 pt-2">
                      {r.openPRs.map((pr) => (
                        <li key={pr.number}>
                          <a href={pr.url} target="_blank" rel="noreferrer" className="flex items-baseline gap-2 text-[12px] text-foreground/80 hover:text-foreground">
                            <span className="hud-mono text-hud-ink-dim">#{pr.number}</span>
                            <span className="min-w-0 break-words">{pr.title}</span>
                            {pr.draft && <span className="hud-mono text-[9px] uppercase text-hud-ink-dim">draft</span>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
