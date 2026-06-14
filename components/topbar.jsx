import path from "node:path";
import { cookies } from "next/headers";
import { getScannedProjects, projectsRoot } from "@/lib/scan.js";
import { getPulseForProjects } from "@/lib/sessions.js";
import { summarize } from "@/lib/aggregate.js";
import Clock from "@/components/hud/clock.jsx";
import CountUp from "@/components/hud/count-up.jsx";
import SyncIndicator from "@/components/hud/sync-indicator.jsx";
import HeadlineChip from "@/components/news/headline-chip.jsx";
import TimerChip from "@/components/timer-chip.jsx";
import { getHeadlines } from "@/lib/external/news.js";
import { getOwed } from "@/lib/external/github-notifications.js";
import { config as extConfig } from "@/lib/external/config.js";
import { getDaemonState } from "@/lib/session-daemon-state.js";

const TIMER_COOKIE = "tracker_timer";

async function readTimerCookie() {
  try {
    const jar = await cookies();
    const raw = jar.get(TIMER_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.entry_id || !parsed?.started_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shortPath(p) {
  const home = process.env.HOME || "";
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}


/**
 * Persistent HUD topbar. Mounted in the root layout so it spans every route.
 * All data comes from the per-request cache()d scan, so layouts further down
 * the tree share the same memo — no double-fetch.
 */
export default async function Topbar() {
  let summary = null;
  let liveNow = 0;
  let idleNow = 0;
  let toolNow = 0;
  let root = "";
  try {
    root = projectsRoot();
    const projects = await getScannedProjects(root);
    summary = summarize(projects);
    const pulse = await getPulseForProjects(projects);
    const vals = Object.values(pulse);
    toolNow = vals.filter((v) => v?.processOpen && v?.streamState === "tool").length;
    liveNow = vals.filter(
      (v) => v?.liveNow || (v?.processOpen && v?.streamState === "responding")
    ).length;
    idleNow = vals.filter((v) => v?.idle && v?.streamState !== "tool").length;
  } catch {
    /* render in degraded mode */
  }
  const daemon = await getDaemonState().catch(() => ({ online: false }));
  const timer = await readTimerCookie();
  const stats = summary?.byStatus ?? { active: 0, blocked: 0, paused: 0, done: 0, untracked: 0 };
  const openTodos = summary?.todos?.open ?? 0;
  const total = summary?.total ?? 0;

  // External signals — parallel, all-settled, never throw. News headlines feed
  // the rotating chip; OWED is a static unread-notif counter when GH_TOKEN set.
  const [headlines, owedResult] = await Promise.all([
    getHeadlines({ mix: true, limit: 8 }).catch(() => []),
    extConfig.signals.owed
      ? getOwed().catch(() => null)
      : Promise.resolve(null),
  ]);
  const owed = owedResult && Number.isFinite(owedResult.unread) ? owedResult.unread : null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-hud-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="flex h-9 w-full items-center gap-4 px-4 text-[11px]">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block size-1.5 rounded-full bg-green hud-pulse" />
          <span className="hud-mono uppercase tracking-[0.22em] text-foreground">
            Mission Control
          </span>
        </div>

        {/* Live clock */}
        <span className="hud-mono text-hud-ink-dim shrink-0">
          <Clock />
        </span>

        <span className="text-hud-border-strong">│</span>

        {/* Telemetry totals */}
        <div className="flex items-center gap-4 shrink-0">
          <Stat label="NODES" value={total} pad={2} />
          <Stat label="ACTIVE" value={stats.active} pad={2} tone="green" />
          <Stat label="BLOCKED" value={stats.blocked} pad={2} tone="hot" />
          <Stat label="OPEN" value={openTodos} pad={3} />
          {owed != null && (
            <div data-stat-tile className="flex items-baseline gap-1.5 rounded px-1 -mx-1 transition-shadow" title="Unread GitHub notifications">
              <span className="hud-label">OWED</span>
              <span className={`hud-num ${owed > 0 ? "text-warm" : "text-foreground"}`}>
                <CountUp value={owed} pad={2} />
              </span>
            </div>
          )}
        </div>

        {headlines.length > 0 && <span className="text-hud-border-strong">│</span>}
        {headlines.length > 0 && (
          <HeadlineChip items={headlines} intervalMs={10000} />
        )}

        <span className="text-hud-border-strong">│</span>

        {/* Live + idle session indicators (Phase 10). LIVE = actively typing,
            WAIT = process open but no recent JSONL activity. */}
        <a
          href="/#sessions"
          className="flex items-center gap-1.5 shrink-0 hover:text-foreground transition-opacity"
          title="Claude sessions writing JSONL right now"
        >
          <span
            className={`inline-block size-1.5 rounded-full ${
              liveNow > 0 ? "bg-green hud-pulse-live" : "bg-muted-foreground/40"
            }`}
          />
          <span className="hud-label">LIVE</span>
          <span className={`hud-num ${liveNow > 0 ? "text-green" : "text-muted-foreground"}`}>
            <CountUp value={liveNow} pad={2} />
          </span>
        </a>
        {daemon.online && toolNow > 0 && (
          <a
            href="/#sessions"
            className="flex items-center gap-1.5 shrink-0 hover:text-foreground transition-opacity"
            title="Claude sessions mid-tool-call (Bash, Read, etc.)"
          >
            <span className="inline-block size-1.5 rounded-full bg-warm hud-pulse-tool" />
            <span className="hud-label">TOOL</span>
            <span className="hud-num text-warm">
              <CountUp value={toolNow} pad={2} />
            </span>
          </a>
        )}
        {daemon.online && idleNow > 0 && (
          <a
            href="/#sessions"
            className="flex items-center gap-1.5 shrink-0 hover:text-foreground transition-opacity"
            title="Claude sessions open but idle (waiting for input)"
          >
            <span className="inline-block size-1.5 rounded-full bg-green/80" />
            <span className="hud-label">WAIT</span>
            <span className="hud-num text-green/80">
              <CountUp value={idleNow} pad={2} />
            </span>
          </a>
        )}
        {!daemon.online && (
          <span
            className="hud-mono text-[10px] text-hud-ink-dim shrink-0"
            title="Session watcher daemon offline — `npm run daemon` or load launchd plist"
          >
            ⊘ daemon
          </span>
        )}

        <div className="ml-auto flex items-center gap-4 shrink-0 text-hud-ink-dim">
          <SyncIndicator />
          {timer && <TimerChip timer={timer} />}
          <span className="hud-mono">ROOT {shortPath(root)}</span>
          <span className="text-hud-border-strong">│</span>
          <span className="hud-mono">BUILD {process.env.NEXT_PUBLIC_BUILD ?? "DEV"}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default", pad = 0 }) {
  const tones = {
    default: "text-foreground",
    green: "text-green",
    hot: "text-hot",
    warm: "text-warm",
  };
  return (
    <div data-stat-tile className="flex items-baseline gap-1.5 rounded px-1 -mx-1 transition-shadow">
      <span className="hud-label">{label}</span>
      <span className={`hud-num ${tones[tone]}`}>
        <CountUp value={value} pad={pad} />
      </span>
    </div>
  );
}
