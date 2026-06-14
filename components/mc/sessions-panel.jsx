import Link from "next/link";
import path from "node:path";
import Module from "@/components/hud/module.jsx";
import { Uptime } from "@/components/hud/clock.jsx";
import { getAllSessions, projectFolder } from "@/lib/sessions.js";
import { getDaemonState } from "@/lib/session-daemon-state.js";
import { hostCwdToRel } from "@/lib/projects-write.js";
import { codename } from "@/lib/codename.js";
import TrackButton from "@/components/mc/track-button.jsx";

function fmtTokens(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function relTime(d) {
  if (!d) return "—";
  const s = Math.round((Date.now() - +new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function projectOf(session, projectsByFolder) {
  const folder = path.basename(path.dirname(session.filePath));
  return projectsByFolder.get(folder) || null;
}

export default async function SessionsPanel({ projects }) {
  const [all, daemon] = await Promise.all([getAllSessions(), getDaemonState()]);
  const byFolder = new Map();
  for (const p of projects || []) {
    if (p?.dir) byFolder.set(projectFolder(p.dir), p);
  }

  // "ACTIVE NOW" is the daemon's view: every folder with an open `claude`
  // process gets its most-recent session row, regardless of mtime — Claude's
  // JSONL flushes are irregular (sometimes 20+ min gaps) so mtime alone
  // misses currently-open conversations. Without the daemon, fall back to
  // the mtime-only `isLive` flag.
  function folderOf(s) { return path.basename(path.dirname(s.filePath)); }

  let live = [];
  let activeFolders = new Set();
  if (daemon.online) {
    // For each open folder, pick the newest session in that folder.
    const byOpenFolder = new Map();
    for (const s of all) {
      const f = folderOf(s);
      if (!daemon.byFolder[f]) continue;
      const existing = byOpenFolder.get(f);
      if (!existing || +new Date(s.lastActivityAt) > +new Date(existing.lastActivityAt)) {
        byOpenFolder.set(f, s);
      }
    }
    live = Array.from(byOpenFolder.values())
      .sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt));
    activeFolders = new Set(byOpenFolder.keys());
  } else {
    live = all.filter((s) => s.isLive);
    activeFolders = new Set(live.map(folderOf));
  }
  const recent = all
    .filter((s) => s.isRecent && !activeFolders.has(folderOf(s)))
    .slice(0, 8);

  return (
    <Module
      title="CLAUDE SESSIONS"
      voice="signals"
      accent={live.length > 0 ? "green" : null}
      caption={live.length > 0 ? "active now" : "no live sessions"}
      right={
        <span className="hud-num text-[11px] text-hud-ink-dim">
          {live.length} live · {recent.length} recent
        </span>
      }
    >
      <div id="sessions" className="flex flex-col gap-4">
        {/* ACTIVE NOW */}
        {live.length > 0 && (
          <div>
            <div className="hud-mono uppercase tracking-[0.18em] text-[10px] text-green mb-2">
              // ACTIVE NOW
            </div>
            <ul className="flex flex-col gap-2">
              {live.map((s) => {
                const p = projectOf(s, byFolder);
                const f = folderOf(s);
                const daemonCwd = daemon.byFolder[f]?.cwd ?? null;
                // Trackable iff there's no scanned project AND we can map
                // the host cwd into our PROJECTS_ROOT (rel is a non-empty string).
                const trackableCwd = !p && (s.cwd || daemonCwd) && hostCwdToRel(s.cwd || daemonCwd)
                  ? (s.cwd || daemonCwd) : null;
                return (
                  <li key={s.sessionId} className="hud-glow-green rounded-sm">
                    <SessionRow s={s} project={p} live daemonCwd={daemonCwd} trackableCwd={trackableCwd} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* RECENT 24H */}
        {recent.length > 0 ? (
          <div>
            <div className="hud-mono uppercase tracking-[0.18em] text-[10px] text-hud-ink-dim mb-2">
              // RECENT 24H
            </div>
            <ul className="flex flex-col">
              {recent.map((s) => {
                const p = projectOf(s, byFolder);
                const f = folderOf(s);
                const daemonCwd = daemon.byFolder[f]?.cwd ?? null;
                // Trackable iff there's no scanned project AND we can map
                // the host cwd into our PROJECTS_ROOT (rel is a non-empty string).
                const trackableCwd = !p && (s.cwd || daemonCwd) && hostCwdToRel(s.cwd || daemonCwd)
                  ? (s.cwd || daemonCwd) : null;
                return (
                  <li key={s.sessionId}>
                    <SessionRow s={s} project={p} daemonCwd={daemonCwd} trackableCwd={trackableCwd} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          live.length === 0 && (
            <p className="hud-mono text-[11px] text-hud-ink-dim">// no recent sessions</p>
          )
        )}
      </div>
    </Module>
  );
}

function fallbackCodename(s, daemonCwd) {
  // Use the cwd's last path segment when no scanned project matches. Prefer
  // the session's own cwd, then the daemon's cwd for this folder, then slug,
  // then the literal "UNMATCHED" only if nothing else is available.
  const cwd = s.cwd || daemonCwd || null;
  if (cwd) {
    const seg = cwd.split("/").filter(Boolean).pop();
    if (seg) return seg.slice(0, 14).toUpperCase();
  }
  if (s.slug) return s.slug.slice(0, 14).toUpperCase();
  return "UNMATCHED";
}

function SessionRow({ s, project, live = false, daemonCwd = null, trackableCwd = null }) {
  const tokensTotal =
    (s.tokensTail?.input ?? 0) +
    (s.tokensTail?.output ?? 0) +
    (s.tokensTail?.cacheRead ?? 0) +
    (s.tokensTail?.cacheCreation ?? 0);
  const codeName = project ? codename(project.rel) : fallbackCodename(s, daemonCwd);

  const Wrap = project
    ? ({ children }) => (
        <Link
          href={`/p/${project.rel.split("/").map(encodeURIComponent).join("/")}`}
          className="flex items-center gap-3 py-2 px-3"
        >
          {children}
        </Link>
      )
    : ({ children }) => <div className="flex items-center gap-3 py-2 px-3">{children}</div>;

  return (
    <Wrap>
      <span
        className={`inline-block size-1.5 rounded-full shrink-0 ${
          live ? "bg-green hud-pulse-live" : "bg-[var(--color-blue)]/60"
        }`}
        aria-hidden
      />
      <span className="hud-mono text-[10px] text-[var(--color-blue)] shrink-0 w-[90px] truncate uppercase tracking-wider">
        {codeName}
      </span>
      <span className="flex-1 min-w-0 text-[12px] truncate">
        {s.lastUserPrompt
          ? <span className="italic text-hud-ink-dim">"{s.lastUserPrompt}"</span>
          : (s.slug ? s.slug : "session in progress")}
      </span>
      <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 tabular-nums">
        {fmtTokens(tokensTotal)}t
      </span>
      <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 tabular-nums w-[64px] text-right">
        {live ? <Uptime since={s.startedAt} /> : relTime(s.lastActivityAt)}
      </span>
      {!project && trackableCwd && <TrackButton cwd={trackableCwd} />}
    </Wrap>
  );
}
