/**
 * Compact relative-age label for an ISO timestamp.
 *
 *   < 45s   → "just now"
 *   < 90m   → "Nm ago"
 *   < 36h   → "Nh ago"
 *   < 14d   → "Nd ago"
 *   < 60d   → "Nw ago"
 *   older   → absolute YYYY-MM-DD
 *
 * Returns null for falsy / unparseable input so the caller can render an
 * em-dash without branching on the error message.
 */
export function relativeAge(iso, now = Date.now()) {
  if (!iso) return null;
  const t = +new Date(iso);
  if (!Number.isFinite(t)) return null;

  const diffSec = Math.max(0, Math.round((now - t) / 1000));
  if (diffSec < 45) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 90) return `${diffMin}m ago`;

  const diffHr = Math.round(diffSec / 3600);
  if (diffHr < 36) return `${diffHr}h ago`;

  const diffDay = Math.round(diffSec / 86400);
  if (diffDay < 14) return `${diffDay}d ago`;

  if (diffDay < 60) return `${Math.round(diffDay / 7)}w ago`;

  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Format an ISO timestamp as a short local-date label, e.g. "May 28, 2026". */
export function formatDate(iso) {
  if (!iso) return null;
  const t = +new Date(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
