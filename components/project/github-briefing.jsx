import { Pill } from "@/components/hud/pill.jsx";
import Module from "@/components/hud/module.jsx";
import MetaEditor from "@/components/project/meta-editor.jsx";
import { relativeAge } from "@/lib/time.js";
import { listItinerary } from "@/lib/itinerary.js";
import { ListTree, GitCommitHorizontal, Gauge, ListChecks, StickyNote, ExternalLink } from "lucide-react";

/**
 * Render the AI "where it stands" summary. If it has line breaks, show clean
 * bullet points (stripping leading "- "/"•"); otherwise fall back to a paragraph.
 */
function SummaryBody({ text }) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s+/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return (
      <ul className="soft-bullets">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-[15px] leading-relaxed text-foreground/90">{text}</p>;
}

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
          <h1 className="text-2xl font-semibold tracking-tight truncate min-w-0">
            {project?.name || "Untitled"}
          </h1>
          <div className="flex items-center gap-2 ml-auto">
            <Pill tone={tone}>{project?.status || "untracked"}</Pill>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-soft btn-soft-ghost h-8 px-3 text-[13px]"
              >
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
                GitHub
              </a>
            )}
            <MetaEditor rel={rel} meta={meta} />
          </div>
        </div>
      </section>

      {gh?.error && (
        <Module title="Sync" voice="briefing" caption="GitHub state snapshot">
          <p className="text-[13px] text-hot">GitHub sync error: {gh.error}</p>
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
      <Module title="Notes" voice="briefing" caption="Internal · saved to this project" icon={StickyNote}>
        {meta?.notes ? (
          <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{meta.notes}</p>
        ) : (
          <p className="text-[13px] text-hud-ink-dim">
            No notes yet — use “edit meta” above to add some.
          </p>
        )}
      </Module>
    </div>
  );
}

/** Where it stands — the most prominent, readable block. Bulleted summary. */
export function Summary({ aiSummary, fallback }) {
  const text = aiSummary || fallback;
  return (
    <Module
      title="Where it stands"
      voice="briefing"
      icon={ListTree}
      caption={aiSummary ? "AI summary · regenerated on sync" : "No summary on record"}
    >
      <SummaryBody text={text} />
    </Module>
  );
}

/** Recent commits — last 5, message + relative date, each links to the commit. */
export function RecentCommitsCard({ commits }) {
  return (
    <Module title="Recent commits" voice="briefing" icon={GitCommitHorizontal} caption={`Last ${commits.length} commits`}>
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
        <p className="text-[13px] text-hud-ink-dim">No recent commits.</p>
      )}
    </Module>
  );
}

/** At a glance — one compact strip: itinerary count, open PRs. */
export function AtAGlance({ itineraryCount, prCount, prsUrl }) {
  return (
    <Module title="At a glance" voice="briefing" icon={Gauge} caption="Quick references">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
        {itineraryCount != null && (
          <a
            href="/itinerary"
            className="inline-flex items-baseline gap-1.5 text-hud-ink-dim hover:text-foreground"
          >
            <span className="text-[15px] text-foreground tabular-nums">{itineraryCount}</span>
            <span>itinerary</span>
          </a>
        )}
        <a
          href={prsUrl || "#"}
          {...(prsUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex items-baseline gap-1.5 text-hud-ink-dim hover:text-foreground"
        >
          <span className="text-[15px] text-foreground tabular-nums">{prCount}</span>
          <span>open PRs</span>
        </a>
      </div>
    </Module>
  );
}

/** Itinerary — this project's open itinerary items (the per-project work log). */
export function ItineraryCard({ items }) {
  return (
    <Module title="Itinerary" voice="briefing" icon={ListChecks} caption="Open items for this project">
      {items.length ? (
        <ol className="flex flex-col divide-y divide-hud-border/40">
          {items.map((it) => (
            <li key={it.id} className="flex items-baseline gap-3 py-2 min-w-0">
              <span className="flex-1 min-w-0 text-[13px] leading-snug">{it.body}</span>
            </li>
          ))}
          <li className="pt-2">
            <a href="/itinerary" className="text-[12px] text-hud-ink-dim hover:text-foreground">
              Open itinerary →
            </a>
          </li>
        </ol>
      ) : (
        <a href="/itinerary" className="text-[13px] text-hud-ink-dim hover:text-foreground">
          No itinerary items — capture one →
        </a>
      )}
    </Module>
  );
}
