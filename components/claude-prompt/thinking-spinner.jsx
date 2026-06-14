"use client";

import { useEffect, useState } from "react";

/**
 * Native Claude Code terminal "thinking" indicator, in the browser.
 *
 *   ✻ Ruminating… (4s · ↑ 1.2k ↓ 38 · esc to interrupt)
 *
 * The gerund cycles every ~2s — same list flavor as the terminal client.
 * Elapsed seconds tick once a second. Token counts are optional; pass
 * `usage` (partial or final) and we'll format them.
 */

const GERUNDS = [
  "Accomplishing", "Actioning", "Actualizing", "Baking", "Brewing",
  "Calculating", "Cerebrating", "Churning", "Clauding", "Coalescing",
  "Cogitating", "Computing", "Concocting", "Conjuring", "Considering",
  "Contemplating", "Cooking", "Crafting", "Creating", "Crunching",
  "Deliberating", "Determining", "Divining", "Effecting", "Finagling",
  "Forging", "Forming", "Generating", "Hatching", "Herding",
  "Honking", "Hustling", "Ideating", "Inferring", "Manifesting",
  "Marinating", "Moseying", "Mulling", "Mustering", "Musing",
  "Noodling", "Percolating", "Pondering", "Processing", "Puttering",
  "Ruminating", "Schlepping", "Shucking", "Simmering", "Smooshing",
  "Spinning", "Stewing", "Synthesizing", "Thinking", "Transmuting",
  "Unfurling", "Vibing", "Wandering", "Whipping up", "Working",
];

function pickGerund() {
  return GERUNDS[Math.floor(Math.random() * GERUNDS.length)];
}

function fmtTokens(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ThinkingSpinner({ startedAt, usage = null, label = null }) {
  const [gerund, setGerund] = useState(() => label || pickGerund());
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
  );

  useEffect(() => {
    // Gerund rolls every 2s — matches the terminal cadence.
    if (label) { setGerund(label); return; }
    const iv = setInterval(() => setGerund(pickGerund()), 2000);
    return () => clearInterval(iv);
  }, [label]);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const iv = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(iv);
  }, [startedAt]);

  const inTok = fmtTokens(usage?.input_tokens);
  const outTok = fmtTokens(usage?.output_tokens);
  const meta = [
    `${elapsed}s`,
    inTok ? `↑ ${inTok}` : null,
    outTok ? `↓ ${outTok}` : null,
    "esc to interrupt",
  ].filter(Boolean).join(" · ");

  return (
    <div className="hud-mono text-sm text-warm flex items-baseline gap-2 py-1">
      <span className="claude-spinner-glyph inline-block animate-pulse">✻</span>
      <span>
        {gerund}…
        <span className="text-hud-ink-dim"> ({meta})</span>
      </span>
    </div>
  );
}
