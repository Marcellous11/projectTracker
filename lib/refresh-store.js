"use client";

/**
 * Tiny browser-only pub/sub for the auto-refresh timestamp. Lets the
 * <SyncIndicator /> in the topbar read the latest refresh time without
 * being a child of <AutoRefresh />. No React context, no extra renders
 * — subscribers re-render only when they call setState themselves.
 */

let lastRefreshAt = typeof window === "undefined" ? 0 : Date.now();
const listeners = new Set();

export function noteRefresh() {
  lastRefreshAt = Date.now();
  for (const fn of listeners) {
    try { fn(lastRefreshAt); } catch { /* ignore listener errors */ }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLastRefreshAt() {
  return lastRefreshAt;
}
