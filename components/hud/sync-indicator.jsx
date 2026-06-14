"use client";

import { useEffect, useState } from "react";
import { subscribe, getLastRefreshAt } from "@/lib/refresh-store.js";

/**
 * Tiny topbar badge showing seconds since the last router.refresh() tick
 * from <AutoRefresh />. Ticks every 1s so the user has visible proof the
 * dashboard is actively re-fetching. Renders as `// sync Ns`.
 */
export default function SyncIndicator() {
  const [now, setNow] = useState(() => Date.now());
  const [lastAt, setLastAt] = useState(() => getLastRefreshAt());

  useEffect(() => {
    const unsub = subscribe((ts) => {
      setLastAt(ts);
      setNow(Date.now());
    });
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsub(); clearInterval(id); };
  }, []);

  const seconds = lastAt ? Math.max(0, Math.floor((now - lastAt) / 1000)) : 0;
  return (
    <span
      className="hud-mono text-[10px] text-hud-ink-dim shrink-0"
      title="Seconds since last dashboard auto-refresh"
      suppressHydrationWarning
    >
      // sync {seconds}s
    </span>
  );
}
