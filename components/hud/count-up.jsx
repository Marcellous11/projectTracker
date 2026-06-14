"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tweens an integer up/down over 220ms when `value` changes, then briefly
 * flashes a 1px accent ring on the parent tile (via .hud-ring-flash) for
 * 600ms. Replaces glitch/character-swap behavior with quieter motion in line
 * with the Vine FX direction.
 *
 * Renders an inert <span> so it can drop into existing typography.
 */
export default function CountUp({
  value = 0,
  duration = 220,
  pad = 0,
  className = "",
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const ringRef = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = to;
    if (from === to) return;

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = Math.round(from + (to - from) * eased);
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Flash the parent tile (closest .hud-stat-tile or self).
    const host = ringRef.current?.closest("[data-stat-tile]");
    if (host) {
      host.classList.remove("hud-ring-flash");
      void host.offsetWidth;
      host.classList.add("hud-ring-flash");
      const t = setTimeout(() => host.classList.remove("hud-ring-flash"), 700);
      return () => { clearTimeout(t); cancelAnimationFrame(raf); };
    }
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = pad > 0 ? String(display).padStart(pad, "0") : String(display);
  return <span ref={ringRef} className={cn("hud-num tabular-nums", className)}>{text}</span>;
}
