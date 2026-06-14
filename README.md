# Project Tracker

A local dashboard that reads a `STATUS.md` file from every project under your
active-projects folder and shows, at a glance, what's in flight, what's
blocked, and what's going cold. The `STATUS.md` files are the single source
of truth — there is no database and nothing to sync.

## How it fits together

- **Global rule** (`~/.claude/CLAUDE.md`) tells every Claude Code session to
  keep a `STATUS.md` at each project root current as it works.
- **`/wrap`** (`~/.claude/commands/wrap.md`) is a one-line way to refresh the
  current project's `STATUS.md` before you end a session.
- **This dashboard** reads all those files off disk and renders them. It never
  reads project code or history — only the small `STATUS.md` summaries — so it
  stays fast no matter how many projects you accumulate.

## Setup

```bash
cd project-tracker
npm install
# Point at the folder to scan (defaults to this folder's parent):
echo 'PROJECTS_ROOT=/Users/m.curtis/Documents/Projects/Active' > .env.local
npm run dev
```

Open the URL it prints (http://localhost:3000, or the next free port).

## Running it in Docker

Two modes, same port (4317). Run one at a time.

**Production (runs forever, code baked in):**
```bash
docker compose up -d            # start; add --build after code changes
docker compose down             # stop
```

**Development (live source, hot-reload — for improving the dashboard):**
```bash
docker compose -f docker-compose.dev.yml up -d     # start dev container
docker compose -f docker-compose.dev.yml logs -f   # watch HMR / errors
docker compose -f docker-compose.dev.yml down       # stop
```

In dev mode the source folder is bind-mounted into the container, so editing
files on the host (e.g. with Claude Code) hot-reloads the running dashboard
with no rebuild. When you're happy with a change, switch back to prod and
rebuild to bake it in:
```bash
docker compose -f docker-compose.dev.yml down
docker compose up -d --build
```

Claude Code itself runs on the host and edits these files directly — it does
not run inside either container.

## Daemon

The dashboard's `LIVE` / `WAIT` chips and the green sidebar dots are powered
by a small host-side daemon (`scripts/session-watcher.js`) that scans for
running `claude` CLI processes every 3 seconds and writes
`data/live-sessions.json`. Dashboard reads that file on SSR.

- **Pulsing green dot / LIVE** — a Claude process is open AND has written to
  its session JSONL within the last 3 minutes (actively typing or running a
  tool call).
- **Solid green dot / WAIT** — a Claude process is open but idle (waiting
  for your next message).
- **Blue dot** — process closed, JSONL written within the last 24h.
- **Dim dot** — cold.
- **⊘ daemon** in the topbar — daemon isn't running; pulse falls back to
  mtime-only.

The daemon must run on the host (the Docker container can't see host
processes). Two ways to run it:

**Manual (one-shot):**
```bash
npm run daemon
```

**Auto-start at login (recommended):**
```bash
# from the repo root
cp launchd/com.mcurtis.project-tracker-watcher.plist \
   ~/Library/LaunchAgents/com.mcurtis.project-tracker-watcher.plist
sed -i '' "s|__REPO__|$(pwd)|g; s|/usr/local/bin/node|$(which node)|g" \
   ~/Library/LaunchAgents/com.mcurtis.project-tracker-watcher.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mcurtis.project-tracker-watcher.plist
launchctl enable gui/$(id -u)/com.mcurtis.project-tracker-watcher
```

Logs land at `data/watcher.log` (stdout) and `data/watcher.err` (stderr).
Uninstall:
```bash
launchctl bootout gui/$(id -u)/com.mcurtis.project-tracker-watcher
rm ~/Library/LaunchAgents/com.mcurtis.project-tracker-watcher.plist
```

macOS only for now — relies on `ps` + `lsof` syntax that differs on Linux.

## Browser prompts (Phase 14)

The briefing page (`/p/<project>`) has a **PROMPT** panel that lets you ask
Claude something from the browser and watch the response stream back. It
runs the real `claude` CLI on the host in that project's cwd — the new
session shows up in `~/.claude/projects/...` and in the sidebar pulse just
like any session you'd start from a terminal.

This needs a second host daemon, `scripts/prompt-bridge.js`, that binds
`127.0.0.1:4318` and accepts `POST /spawn` from the Next.js container over
`host.docker.internal`. The bridge only ever spawns `claude` — no arbitrary
shell — and validates `cwd` against `BRIDGE_PROJECTS_ROOTS` (default:
`~/Documents/Projects`).

**Manual:**
```bash
npm run bridge
```

**Auto-start at login:**
```bash
# from the repo root
cp launchd/com.mcurtis.project-tracker-bridge.plist \
   ~/Library/LaunchAgents/com.mcurtis.project-tracker-bridge.plist
sed -i '' "s|__REPO__|$(pwd)|g; s|__HOME__|$HOME|g; s|/usr/local/bin/node|$(which node)|g" \
   ~/Library/LaunchAgents/com.mcurtis.project-tracker-bridge.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mcurtis.project-tracker-bridge.plist
launchctl enable gui/$(id -u)/com.mcurtis.project-tracker-bridge
```

Logs at `data/bridge.log` / `data/bridge.err`. Uninstall mirrors the watcher.
Health check: `curl http://127.0.0.1:4318/health`.

## How discovery works

The scan handles mixed folder nesting:

- A folder with its own `STATUS.md` → a **tracked** project.
- A folder with a project marker (`.git`, `README.md`, `package.json`, …) but
  no `STATUS.md` → a single **untracked** project (not descended into).
- An empty folder → kept visible as untracked, so it can't silently vanish.
- Any other folder → treated as a grouping folder; its immediate children are
  scanned with the same rules.

Discovery goes two levels deep. A project deeper than that won't be found
unless you add a `STATUS.md` higher up.

## Reading the board

- **Left border**: grey (fresh) → amber (7+ days untouched) → red (14+ days or
  blocked). Untracked folders have a dashed border.
- **Sort order**: blocked first, then active (coldest first), then untracked,
  then paused, then done. Done/paused cards dim out.
- **Stat bar**: counts of tracked, no-status, going-cold, and blocked projects.
- Cards with bad frontmatter (e.g. a malformed `last_worked` date) show a
  warning rather than disappearing.

## STATUS.md format

```markdown
---
project: <name>
status: active        # active | blocked | paused | done
last_worked: YYYY-MM-DD
priority: high        # high | medium | low
---

## Next action
<the single most important next thing to do>

## Blockers
<what's stopping progress, or "none">

## Recently done
- <item> (YYYY-MM-DD)
```

`last_worked` must be `YYYY-MM-DD` — that's the field the "going cold"
staleness logic depends on.
