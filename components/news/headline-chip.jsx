"use client";

import { useEffect, useState } from "react";

/**
 * Topbar rotating headline chip — one article visible at a time, fades +
 * advances every `intervalMs`. Replaces the Phase 8 KP/QKE telemetry chip.
 *
 * Items shape (matches the Article shape from lib/external/news.js):
 *   { id, source: "AP"|"NPR"|..., scope: "federal"|"world"|"local"|"context",
 *     title: string, url: string, ts: string }
 *
 * Renders nothing if items is empty — keeps the topbar clean when feeds fail.
 */

const SCOPE_TONE = {
  federal: "text-foreground",
  world:   "text-[var(--color-blue)]",
  local:   "text-green",
  context: "text-hud-ink-dim",
};

function clipTitle(s, max = 64) {
  if (!s) return "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut.slice(0, max)).trimEnd() + "…";
}

export default function HeadlineChip({ items = [], intervalMs = 10000 }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setFade(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % items.length);
        setFade(false);
      }, 220);
    }, intervalMs);
    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  if (!items.length) return null;
  const item = items[Math.min(idx, items.length - 1)];
  const tone = SCOPE_TONE[item.scope] || "text-foreground";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      title={item.title}
      className="shrink-0 min-w-0 max-w-[44rem] flex items-baseline gap-2 transition-opacity duration-200 hover:opacity-100 opacity-95"
      style={{ opacity: fade ? 0.25 : 0.95 }}
    >
      <span className={`hud-label shrink-0 ${tone}`}>{item.source}</span>
      <span className="hud-mono text-[11px] text-foreground/90 truncate">
        {clipTitle(item.title, 64)}
      </span>
    </a>
  );
}
