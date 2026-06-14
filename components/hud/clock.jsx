"use client";

import { useEffect, useState } from "react";

function fmt(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

// Placeholder rendered on the server and during first client paint — keeps
// SSR markup deterministic so React doesn't flag a hydration mismatch when
// the server (UTC inside Docker) and the browser (user timezone) disagree.
const PLACEHOLDER = "----‑--‑-- --:--:--";

/** 1Hz wall clock for the topbar. Format: YYYY-MM-DD HH:MM:SS */
export default function Clock({ className = "" }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span suppressHydrationWarning className={`hud-mono tabular-nums ${className}`}>
      {now ? fmt(now) : PLACEHOLDER}
    </span>
  );
}

/** Live-elapsed ticker for "uptime" badges. Updates 1Hz. */
export function Uptime({ since, className = "" }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since || now == null) {
    return (
      <span suppressHydrationWarning className={`hud-mono tabular-nums ${className}`}>
        --
      </span>
    );
  }
  const ms = Math.max(0, now - +new Date(since));
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const text = h > 0
    ? `${h}h${String(m).padStart(2, "0")}m`
    : m > 0
      ? `${m}m${String(ss).padStart(2, "0")}s`
      : `${ss}s`;
  return (
    <span suppressHydrationWarning className={`hud-mono tabular-nums ${className}`}>
      {text}
    </span>
  );
}
