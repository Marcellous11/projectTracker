"use client";

import { useEffect, useState } from "react";

/**
 * Rotating telemetry chip for the Topbar. Receives N items pre-rendered on
 * the server (label + value + tone) and cycles them every `intervalMs`
 * with a 200ms cross-fade.
 *
 * Items shape: { key: string, label: string, value: string, tone?: "default"|"green"|"warm"|"hot", title?: string, href?: string }
 *
 * Renders nothing if items is empty — keeps the topbar clean during cold-boot
 * or when all external sources fail.
 */

const TONE = {
  default: "text-foreground",
  green: "text-green",
  warm: "text-warm",
  hot: "text-hot",
};

export default function RotatingChip({ items = [], intervalMs = 8000 }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % items.length);
        setFade(false);
      }, 180);
    }, intervalMs);
    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  if (!items.length) return null;
  const item = items[Math.min(idx, items.length - 1)];
  const tone = TONE[item.tone || "default"];

  const inner = (
    <div
      data-stat-tile
      className="flex items-baseline gap-1.5 rounded px-1 -mx-1 transition-opacity duration-150"
      style={{ opacity: fade ? 0.25 : 1 }}
      title={item.title || `${item.label} ${item.value}`}
    >
      <span className="hud-label">{item.label}</span>
      <span className={`hud-num tabular-nums ${tone}`}>{item.value}</span>
    </div>
  );

  if (item.href) {
    return (
      <a href={item.href} className="shrink-0 hover:opacity-100 opacity-90 transition-opacity">
        {inner}
      </a>
    );
  }
  return <div className="shrink-0">{inner}</div>;
}
