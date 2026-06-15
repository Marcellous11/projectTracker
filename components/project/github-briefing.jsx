import { Pill, HexPill } from "@/components/hud/pill.jsx";
import Module from "@/components/hud/module.jsx";
import MetaEditor from "@/components/project/meta-editor.jsx";
import { codename } from "@/lib/codename.js";
import { relativeAge } from "@/lib/time.js";
import { listItinerary } from "@/lib/itinerary.js";

function statusTone(status) {
  if (status === "active") return "active";
  if (status === "blocked") return "blocked";
  if (status === "paused") return "paused";
  if (status === "done") return "done";
  return "untracked";
}

/**
 * Minimal, summary-first briefing for a GitHub-only tracked repo (no local
 * checkout). Five blocks: header, AI "where it stands" summary, recent commits,
 * an at-a-glance strip, and the notes editor. No dense log dumps.
 */
export default function GithubBriefing({ project, rel, meta }) {
  const gh = project?.github || null;
  const tone = statusTone(project?.status);
  const displayCodename = meta?.codename || codename(rel);
  const url = gh?.url || null;
  const prs = Array.isArray(gh?.openPRs) ? gh.openPRs : [];
  const commits = (Array.isArray(gh?.recentCommits) ? gh.recentCommits : []).slice(0, 5);
  const aiSummary = gh?.aiSummary || null;
  const prsUrl = url ? `${url}/pulls` : null;
  const itinerary = listItinerary({ status: "open", project: rel });

  return (
    <div className="flex flex-col gap-6">
      {/* 1 — HEADER */}
      <section className="flex flex-col gap-3 pb-4 border-b border-hud-border">
        <div className="flex flex-wrap items-center gap-3">
          <HexPill tone={tone} className="shrink-0">{displayCodename}</HexPill>
          <h1 className="hud-mono tracking-tight text-2xl truncate min-w-0">
            {project?.name || "Untitled"}
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <Pill tone={tone}>{project?.status || "untracked"}</Pill>
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
      </section>

      {gh?.error && (
        <Module title="SYNC" voice="briefing" caption="github-state snapshot">
          <p className="hud-mono text-[11px] text-hot">// github sync error: {gh.error}</p>
        </Module>
      )}

      {/* 2 — WHERE IT STANDS */}
      <Summary aiSummary={aiSummary} fallback="No summary yet — will generate on the next sync." />

      {/* 3 — RECENT COMMITS */}
      <RecentCommitsCard commits={commits} />

      {/* 4 — AT A GLANCE */}
      <AtAGlance itineraryCount={itinerary.length} prCount={prs.length} prsUrl={prsUrl} />

      {/* 5 — ITINERARY */}
      <ItineraryCard items={itinerary} />

      {/* 6 — NOTES */}
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

/** WHERE IT STANDS — the most prominent, readable block. */
export function Summary({ aiSummary, fallback }) {
  const text = aiSummary || fallback;
  return (
    <Module title="WHERE IT STANDS" voice="briefing" caption={aiSummary ? "AI summary · regenerated on sync" : "no summary on record"}>
      <p className="text-[15px] leading-relaxed text-foreground/90">{text}</p>
    </Module>
  );
}

/** RECENT COMMITS — last 5, message + relative date, each links to the commit. */
export function RecentCommitsCard({ commits }) {
  return (
    <Module title="RECENT COMMITS" voice="briefing" caption={`last ${commits.length} commits`}>
      {commits.length ? (
        <ol className="flex flex-col divide-y divide-hud-border/40">
          {commits.map((c, i) => (
            <li key={`${c.sha || c.short}-${i}`}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-baseline gap-3 py-2 min-w-0 hover:text-foreground"
              >
                <span className="flex-1 min-w-0 text-[13px] truncate">{c.message || c.subject}</span>
                <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 tabular-nums">
                  {relativeAge(c.date || c.dateISO) || "—"}
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// no recent commits</p>
      )}
    </Module>
  );
}

/** AT A GLANCE — one compact strip: itinerary count, open PRs. */
export function AtAGlance({ itineraryCount, prCount, prsUrl }) {
  return (
    <Module title="AT A GLANCE" voice="briefing" caption="quick references">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 hud-mono text-[12px]">
        {itineraryCount != null && (
          <a
            href="/itinerary"
            className="inline-flex items-baseline gap-1.5 text-hud-ink-dim hover:text-foreground"
          >
            <span className="text-[15px] text-foreground tabular-nums">{itineraryCount}</span>
            <span className="uppercase tracking-[0.14em] text-[10px]">itinerary</span>
          </a>
        )}
        <a
          href={prsUrl || "/repos"}
          {...(prsUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex items-baseline gap-1.5 text-hud-ink-dim hover:text-foreground"
        >
          <span className="text-[15px] text-foreground tabular-nums">{prCount}</span>
          <span className="uppercase tracking-[0.14em] text-[10px]">open PRs</span>
        </a>
      </div>
    </Module>
  );
}

/** ITINERARY — this project's open itinerary items (the per-project work log). */
export function ItineraryCard({ items }) {
  return (
    <Module title="ITINERARY" voice="briefing" caption="open items for this project">
      {items.length ? (
        <ol className="flex flex-col divide-y divide-hud-border/40">
          {items.map((it) => (
            <li key={it.id} className="flex items-baseline gap-3 py-2 min-w-0">
              <span className="flex-1 min-w-0 text-[13px] leading-snug">{it.body}</span>
            </li>
          ))}
          <li className="pt-2">
            <a href="/itinerary" className="hud-mono text-[10px] uppercase tracking-[0.14em] text-hud-ink-dim hover:text-foreground">
              Open itinerary ↗
            </a>
          </li>
        </ol>
      ) : (
        <a href="/itinerary" className="hud-mono text-[11px] text-hud-ink-dim hover:text-foreground">
          // no itinerary items — capture one ↗
        </a>
      )}
    </Module>
  );
}
