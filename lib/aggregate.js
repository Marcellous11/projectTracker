/**
 * Aggregate helpers — summarize a scanned project list into counts the
 * Mission Control header tiles need. Pure functions, no I/O.
 */

const STALE_BUCKETS = [
  { key: "fresh", max: 2 },    // 0-2d
  { key: "warm",  max: 6 },    // 3-6d
  { key: "cold",  max: 13 },   // 7-13d
  { key: "frozen", max: Infinity }, // 14+
];

function bucketFor(days) {
  if (days == null) return null;
  for (const b of STALE_BUCKETS) if (days <= b.max) return b.key;
  return "frozen";
}

export function summarize(projects = []) {
  const byStatus   = { active: 0, blocked: 0, paused: 0, done: 0, untracked: 0 };
  const byPriority = { high: 0, medium: 0, low: 0 };
  const byStaleness = { fresh: 0, warm: 0, cold: 0, frozen: 0 };
  let openTodos = 0, doingTodos = 0, doneTodos = 0, warnings = 0;
  let blockedNames = [];

  for (const p of projects) {
    if (!p) continue;
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    if (p.priority && p.status !== "untracked") byPriority[p.priority] = (byPriority[p.priority] ?? 0) + 1;

    const c = p.todoCounts || {};
    openTodos  += c.open  ?? 0;
    doingTodos += c.doing ?? 0;
    doneTodos  += c.done  ?? 0;

    if (p.status === "active") {
      const b = bucketFor(p.staleDays);
      if (b) byStaleness[b]++;
    }
    if (Array.isArray(p.warnings)) warnings += p.warnings.length;
    if (p.status === "blocked") blockedNames.push(p.name);
  }

  const total = projects.length;
  const tracked = total - byStatus.untracked;

  return {
    total,
    tracked,
    byStatus,
    byPriority,
    byStaleness,
    todos: { open: openTodos, doing: doingTodos, done: doneTodos },
    warnings,
    blockedNames,
  };
}

/** A simple integer that changes whenever the summary changes — used by
 *  topbar CountUp to decide whether to tween. */
export function summarySignature(s) {
  if (!s) return 0;
  return [
    s.total,
    s.byStatus.active,
    s.byStatus.blocked,
    s.byStatus.paused,
    s.byStatus.done,
    s.byStatus.untracked,
    s.todos.open,
  ].join("·");
}
