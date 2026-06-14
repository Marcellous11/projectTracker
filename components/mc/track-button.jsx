"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * "+ track" button for SessionRow entries that aren't yet a tracked project.
 * Scaffolds a STATUS.md at the session's cwd via POST /api/projects/track,
 * then router.refresh() so the new entry pops into the sidebar within a tick.
 *
 * Hidden when `cwd` is missing (parent should pass null when the cwd is
 * outside the host projects root or already matches a project).
 */
export default function TrackButton({ cwd }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(null); // null | "ok" | string error

  if (!cwd) return null;

  async function track(e) {
    e.preventDefault();
    e.stopPropagation();
    setStatus(null);
    try {
      const res = await fetch("/api/projects/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd }),
      });
      if (res.status === 201 || res.status === 409) {
        setStatus("ok");
        startTransition(() => router.refresh());
        return;
      }
      const data = await res.json().catch(() => ({}));
      setStatus(data?.error || `failed (${res.status})`);
    } catch (err) {
      setStatus(err?.message || "network error");
    }
  }

  return (
    <button
      type="button"
      onClick={track}
      disabled={pending}
      title={status && status !== "ok" ? status : `Track ${cwd} as a project`}
      className={
        "hud-mono text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded border transition-colors shrink-0 " +
        (status === "ok"
          ? "border-green/40 text-green/80"
          : status
            ? "border-hot/40 text-hot hover:bg-hot/10"
            : "border-hud-border text-hud-ink-dim hover:text-foreground hover:border-hud-border-strong")
      }
    >
      {status === "ok" ? "tracked" : pending ? "…" : "+ track"}
    </button>
  );
}
