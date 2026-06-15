import path from "node:path";
import { promises as fs } from "node:fs";
import { notFound } from "next/navigation";
import { projectsRoot } from "@/lib/scan.js";
import { getProjectDetail } from "@/lib/detail.js";
import { getProjectActivity, getDailyActivity } from "@/lib/activity.js";
import { getMeta } from "@/lib/project-meta.js";
import { getGithubByProject } from "@/lib/github-state.js";
import { getTrackedProjects } from "@/lib/tracked-projects.js";
import { countOutdated } from "@/lib/external/npm-versions.js";
import { getXkcd } from "@/lib/external/xkcd.js";

import GithubBriefing from "@/components/project/github-briefing.jsx";
import BriefingHeader from "@/components/project/header.jsx";
import Vitals from "@/components/project/vitals.jsx";
import Timeline from "@/components/project/timeline.jsx";
import Velocity from "@/components/project/velocity.jsx";
import Focus from "@/components/project/focus.jsx";
import RecentlyDone from "@/components/project/recently-done.jsx";
import RecentCommits from "@/components/project/recent-commits.jsx";
import Notes from "@/components/project/notes.jsx";
import Module from "@/components/hud/module.jsx";
import TodoKanban from "@/components/todo-kanban.jsx";
import AddTodo from "@/components/add-todo.jsx";

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

  // Run heavy fetches in parallel.
  const [detail, activity, daily] = await Promise.all([
    getProjectDetail(resolved),
    getProjectActivity(resolved, { sinceDays: 60, maxTotal: 80 }),
    getDailyActivity(60),
  ]);

  const meta = getMeta(rel);

  // "View on GitHub" link for local projects that map to a tracked repo.
  const githubUrl = getGithubByProject()[rel]?.url || null;

  // Filter daily activity to just this project's events (commit + session counts only).
  // Cheap: rebuild from the activity feed we already have.
  const since60 = Date.now() - 60 * 86400 * 1000;
  const projDailyMap = new Map();
  for (const e of activity) {
    if (e.type === "status") continue;
    const t = +new Date(e.ts);
    if (t < since60) continue;
    const k = new Date(t).toISOString().slice(0, 10);
    projDailyMap.set(k, (projDailyMap.get(k) || 0) + 1);
  }
  const projDaily = daily.map((d) => ({ ...d, count: projDailyMap.get(d.date) || 0 }));

  // Commits in last 7 days for vitals tile.
  const since7 = Date.now() - 7 * 86400 * 1000;
  const commits7d = activity.filter((e) => e.type === "commit" && +new Date(e.ts) >= since7).length;

  // DEPS / OUTDATED — only if this project has a package.json. Read silently.
  let deps = null;
  try {
    const raw = await fs.readFile(path.join(resolved, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    deps = await countOutdated(pkg);
  } catch { /* no package.json or unreadable — skip */ }

  // Briefing easter eggs (parallel, non-blocking).
  const [xkcdRes] = await Promise.allSettled([getXkcd()]);
  const xkcd = xkcdRes.status === "fulfilled" ? xkcdRes.value : null;

  return (
    <div className="flex flex-col gap-6">
      <BriefingHeader
        detail={detail}
        rel={rel}
        branch={detail?.git?.isRepo ? "HEAD" : null}
        meta={meta}
        githubUrl={githubUrl}
      />

      <Vitals
        detail={detail}
        commits7d={commits7d}
        dailyActivity={projDaily.slice(-14)}
        deps={deps}
      />

      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <Timeline events={activity} />
        </div>
        <div className="md:col-span-4 flex flex-col gap-4">
          <Velocity recentlyDone={detail.recentlyDone || []} commits={detail.git?.commits || []} />
        </div>
      </div>

      <Module title="TO DO" voice="briefing" caption={`${detail?.todoCounts?.open ?? 0} open · ${detail?.todoCounts?.done ?? 0} done`}>
        <div className="mb-4">
          <AddTodo rel={rel} />
        </div>
        <TodoKanban
          items={(detail.todos || []).map((t) => ({
            ...t,
            projectName: detail.name,
            projectRel: rel,
            projectPriority: detail.priority,
          }))}
          showProject={false}
        />
      </Module>

      <Focus detail={detail} />

      <div className="grid gap-4 md:grid-cols-2">
        <RecentlyDone items={detail.recentlyDone || []} />
        <RecentCommits git={detail.git} />
      </div>

      <Notes statusMarkdown={detail.statusMarkdown} readme={detail.readme} xkcd={xkcd} />
    </div>
  );
}
