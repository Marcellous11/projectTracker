"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { noteRefresh } from "@/lib/refresh-store.js";

/**
 * Background ticker that calls Next's router.refresh() on an interval so
 * the dashboard reflects daemon updates (session pulse), news feed,
 * todo counts, etc. without the user touching anything.
 *
 *   - Default interval: 5s (overridable via NEXT_PUBLIC_DASHBOARD_REFRESH_MS).
 *   - Pauses while the tab is hidden.
 *   - Forces an immediate refresh when the tab regains focus.
 *   - Renders nothing.
 */

const ENV_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS);
const DEFAULT_MS = Number.isFinite(ENV_MS) && ENV_MS >= 1000 ? ENV_MS : 3000;
const MAX_BACKOFF_MS = 30_000;

export default function AutoRefresh({ intervalMs = DEFAULT_MS }) {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    let timer = null;
    let backoff = intervalMs;

    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    function tick() {
      if (!alive) return;
      if (!isVisible()) {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try {
        router.refresh();
        noteRefresh();
        backoff = intervalMs; // reset on success
      } catch {
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
      timer = setTimeout(tick, backoff);
    }

    function onVisibilityChange() {
      if (!alive) return;
      if (isVisible()) {
        // Snap to fresh state immediately.
        if (timer) clearTimeout(timer);
        try { router.refresh(); noteRefresh(); } catch { /* ignore */ }
        timer = setTimeout(tick, intervalMs);
      }
    }

    // First tick after one interval (page just SSR'd, no rush).
    timer = setTimeout(tick, intervalMs);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
