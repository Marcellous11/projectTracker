"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmtDuration, billed } from "@/lib/duration.js";

function fmtDateTime(ms) {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function dayKey(ms) {
  const d = new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key) {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function EntriesTable({ entries }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState(null);
  const [_, startTransition] = useTransition();

  async function remove(id) {
    if (!confirm("Delete this entry?")) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setPendingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <p className="hud-mono text-[11px] text-hud-ink-dim">
        // no entries match this filter
      </p>
    );
  }

  // Group by day (descending — already sorted by started_at desc).
  const groups = [];
  let current = null;
  for (const e of entries) {
    const k = dayKey(e.started_at);
    if (!current || current.key !== k) {
      current = { key: k, label: dayLabel(k), entries: [], total_ms: 0 };
      groups.push(current);
    }
    current.entries.push(e);
    if (e.ended_at) current.total_ms += (e.ended_at - e.started_at);
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key}>
          <header className="flex items-baseline justify-between mb-2">
            <h3 className="hud-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
              {g.label}
            </h3>
            <span className="hud-num text-[12px] tabular-nums text-foreground">
              {fmtDuration(g.total_ms)}
            </span>
          </header>
          <ul className="flex flex-col divide-y divide-hud-border rounded-lg border border-hud-border bg-card/30">
            {g.entries.map((e) => {
              const dur = e.ended_at ? (e.ended_at - e.started_at) : null;
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2">
                  {e.client_color && (
                    <span
                      className="size-2 shrink-0 rounded-full border border-hud-border"
                      style={{ backgroundColor: e.client_color }}
                      title={e.client_name || ""}
                    />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/p/${e.project_rel.split("/").map(encodeURIComponent).join("/")}`}
                        className="hud-mono text-[11px] uppercase tracking-[0.14em] text-foreground/85 hover:text-foreground truncate"
                      >
                        {e.project_rel}
                      </Link>
                      {e.source === "auto" && (
                        <span className="hud-mono text-[9px] uppercase tracking-[0.16em] text-hud-ink-dim border border-hud-border rounded px-1 py-0.5">
                          auto
                        </span>
                      )}
                      {!e.billable && (
                        <span className="hud-mono text-[9px] uppercase tracking-[0.16em] text-hud-ink-dim">
                          non-billable
                        </span>
                      )}
                    </span>
                    {e.note && (
                      <span className="block text-[12px] text-foreground/70 truncate" title={e.note}>
                        {e.note}
                      </span>
                    )}
                    <span className="block hud-mono text-[10px] text-hud-ink-dim">
                      {fmtDateTime(e.started_at)} → {e.ended_at ? fmtDateTime(e.ended_at) : "RUNNING"}
                    </span>
                  </span>
                  <span className="hud-num text-[12px] tabular-nums text-foreground shrink-0 w-16 text-right">
                    {dur ? fmtDuration(dur) : "—"}
                  </span>
                  <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 w-24 text-right">
                    {e.billable && e.rate_cents ? billed(dur, e.rate_cents, e.currency || "USD") : ""}
                  </span>
                  {e.source === "manual" && (
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      disabled={pendingId === e.id}
                      className="hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim hover:text-hot transition-colors shrink-0 disabled:opacity-40"
                      title="Delete entry"
                    >
                      del
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
