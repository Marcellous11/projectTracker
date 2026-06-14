"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** "Start" button next to a project. Posts to /api/time/start. */
export default function StartTimerButton({ projectRel, projectName, disabled = false, className = "" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function start() {
    setError("");
    try {
      const res = await fetch("/api/time/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_rel: projectRel, note: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message || "network error");
    }
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        type="button"
        onClick={start}
        disabled={pending || disabled}
        title={disabled ? "Stop the current timer first" : `Start timer for ${projectName || projectRel}`}
        className={`h-7 rounded-lg border border-warm/50 px-2.5 text-[10px] hud-mono uppercase tracking-[0.18em] text-warm hover:bg-warm/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors ${className}`}
      >
        {pending ? "…" : "▸ start"}
      </button>
      {error && <span className="hud-mono text-[9px] text-hot">// {error}</span>}
    </div>
  );
}
