"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Reads {entry_id, project_rel, started_at} from a cookie set by /api/time/start. */
export default function TimerChip({ timer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer?.entry_id]);

  if (!timer) return null;

  async function stop() {
    try {
      const res = await fetch("/api/time/stop", { method: "POST" });
      if (res.ok) startTransition(() => router.refresh());
    } catch {/* swallow */}
  }

  const elapsed = now - Number(timer.started_at || now);

  return (
    <button
      type="button"
      onClick={stop}
      disabled={pending}
      title={`Stop timer for ${timer.project_rel}`}
      className="flex items-center gap-1.5 shrink-0 rounded border border-warm/50 bg-warm/10 px-2 py-0.5 hover:bg-warm/15 transition-colors disabled:opacity-40"
    >
      <span className="inline-block size-1.5 rounded-full bg-warm hud-pulse" />
      <span className="hud-mono text-[10px] uppercase tracking-[0.16em] text-warm">
        {pending ? "STOPPING" : "REC"}
      </span>
      <span className="hud-num text-[11px] tabular-nums text-warm">{fmt(elapsed)}</span>
      <span className="hud-mono text-[10px] uppercase text-warm/70 truncate max-w-[12rem]">
        {timer.project_rel}
      </span>
    </button>
  );
}
