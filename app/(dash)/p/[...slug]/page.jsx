import path from "node:path";
import { notFound } from "next/navigation";
import { projectsRoot } from "@/lib/scan.js";
import { getProjectDetail } from "@/lib/detail.js";
import { getMeta } from "@/lib/project-meta.js";
import { getGithubByProject } from "@/lib/github-state.js";
import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { listItinerary } from "@/lib/itinerary.js";

import GithubBriefing, {
  Summary,
  RecentCommitsCard,
  AtAGlance,
  ItineraryCard,
} from "@/components/project/github-briefing.jsx";
import BriefingHeader from "@/components/project/header.jsx";
import Notes from "@/components/project/notes.jsx";

export const dynamic = "force-dynamic";

export default async function BriefingPage({ params }) {
  const { slug } = await params;
  const segments = (slug || []).map(decodeURIComponent);
  const rel = segments.join("/");

  // GitHub-only tracked repos use a `gh:owner/name` rel with no local checkout.
  // They get a GitHub-sourced briefing instead of the filesystem one (and skip
  // the path-traversal guard, which only applies to local paths).
  if (rel.startsWith("gh:")) {
    const projects = await getTrackedProjects();
    const project = projects.find((p) => p.rel === rel);
    if (!project) notFound();
    return <GithubBriefing project={project} rel={rel} meta={getMeta(rel)} />;
  }

  // Path-traversal guard.
  const root = path.resolve(projectsRoot());
  const resolved = path.resolve(path.join(root, ...segments));
  const within = resolved === root || resolved.startsWith(root + path.sep);
  if (!within) notFound();

  const detail = await getProjectDetail(resolved);
  const meta = getMeta(rel);

  // GitHub snapshot for this local project (keyed by rel): "View on GitHub"
  // link + the AI "where it stands" summary + open-PR count.
  const ghEntry = getGithubByProject()[rel] || null;
  const githubUrl = ghEntry?.url || null;
  const aiSummary = ghEntry?.aiSummary || null;
  const prCount = Array.isArray(ghEntry?.openPRs) ? ghEntry.openPRs.length : 0;
  const prsUrl = githubUrl ? `${githubUrl}/pulls` : null;

  // Last 5 commits from the local git history, normalized to the shared card shape.
  const commits = (detail.git?.commits || []).slice(0, 5).map((c) => ({
    sha: c.short,
    message: c.subject,
    date: c.dateISO,
    url: githubUrl ? `${githubUrl}/commit/${c.hash}` : undefined,
  }));

  // Summary fallback: STATUS.md next-action when there's no AI summary.
  const fallback =
    detail.nextAction?.trim() || "No summary yet — will generate on the next sync.";

  // This project's open itinerary items (the per-project work log).
  const itinerary = listItinerary({ status: "open", project: rel });

  return (
    <div className="flex flex-col gap-6">
      <BriefingHeader
        detail={detail}
        rel={rel}
        branch={detail?.git?.isRepo ? "HEAD" : null}
        meta={meta}
        githubUrl={githubUrl}
      />

      <Summary aiSummary={aiSummary} fallback={fallback} />

      <RecentCommitsCard commits={commits} />

      <AtAGlance
        itineraryCount={itinerary.length}
        prCount={prCount}
        prsUrl={prsUrl}
      />

      <ItineraryCard items={itinerary} />

      <Notes statusMarkdown={detail.statusMarkdown} readme={detail.readme} />
    </div>
  );
}
