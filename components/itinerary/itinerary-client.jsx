"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The itinerary capture surface. Mobile-first: a big dictation-friendly box,
// large touch targets. Use the iOS keyboard mic to talk items in.

function fmtAge(ts) {
  const ms = Date.now() - ts;
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const STATUS_META = {
  open: { label: "Open", cls: "text-green border-green/40" },
  sent: { label: "Sent", cls: "text-[var(--color-blue)] border-[var(--color-blue)]/40" },
  done: { label: "Done", cls: "text-hud-ink-dim border-border" },
};

export default function ItineraryClient({ initialItems, initialCounts, projects }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [counts, setCounts] = useState(initialCounts);
  const [body, setBody] = useState("");
  const [project, setProject] = useState("");
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/itinerary", { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setCounts(d.counts);
    }
    startTransition(() => router.refresh());
  }

  async function add() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, project: project || null }),
      });
      if (res.ok) {
        setBody("");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(id, status) {
    await fetch(`/api/itinerary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function remove(id) {
    await fetch(`/api/itinerary/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function sendAll() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const openCount = counts.open || 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-hud-label">Itinerary</span>
        <h1 className="text-xl font-semibold text-foreground">Today&rsquo;s capture queue</h1>
        <p className="text-sm text-muted-foreground">
          Jot what you want to work on as you browse. Tap the keyboard mic to dictate.
          Then hand the list to Monday.
        </p>
      </header>

      {/* Capture box */}
      <div className="flex flex-col gap-3 rounded-xl border border-hud-border bg-card/60 p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
          rows={3}
          placeholder="What do you want to tackle? (⌘/Ctrl+Enter to add)"
          className="w-full resize-y rounded-lg border border-hud-border bg-background/70 px-3 py-2.5 text-base text-foreground outline-none focus:border-hud-border-strong"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="min-h-10 flex-1 rounded-lg border border-hud-border bg-background/70 px-3 text-sm text-foreground outline-none"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.rel} value={p.rel}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={busy || !body.trim()}
            className="btn-soft btn-soft-primary min-h-10 px-5"
          >
            Add
          </button>
        </div>
      </div>

      {/* Send to Monday */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-hud-border bg-card/40 px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold text-foreground">{openCount}</span>{" "}
          <span className="text-muted-foreground">open · {counts.sent || 0} sent · {counts.done || 0} done</span>
        </div>
        <button
          onClick={sendAll}
          disabled={busy || openCount === 0}
          className="btn-soft btn-soft-blue min-h-10 px-4"
        >
          Send to Monday →
        </button>
      </div>

      {/* List */}
      <ul className="flex flex-col gap-2">
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-hud-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing captured yet. Add your first item above.
          </li>
        )}
        {items.map((it) => {
          const meta = STATUS_META[it.status] || STATUS_META.open;
          const projName = projects.find((p) => p.rel === it.project)?.name || it.project;
          return (
            <li
              key={it.id}
              className={`flex items-start gap-3 rounded-xl border border-hud-border bg-card/50 p-3 ${
                it.status === "done" ? "opacity-55" : ""
              }`}
            >
              <button
                onClick={() => patch(it.id, it.status === "done" ? "open" : "done")}
                aria-label="toggle done"
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border ${
                  it.status === "done" ? "border-green bg-green/20 text-green" : "border-hud-border text-transparent hover:border-green/60"
                }`}
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <p className={`break-words text-[15px] text-foreground ${it.status === "done" ? "line-through" : ""}`}>
                  {it.body}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${meta.cls}`}>
                    {meta.label}
                  </span>
                  {projName && (
                    <span className="text-[11px] text-hud-ink-dim">
                      {projName}
                    </span>
                  )}
                  <span className="text-[11px] text-hud-ink-dim">{fmtAge(it.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => remove(it.id)}
                aria-label="delete"
                className="mt-0.5 shrink-0 px-1 text-lg leading-none text-hud-ink-dim hover:text-hot"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {pending && <p className="text-center text-[10px] text-hud-ink-dim">syncing…</p>}
    </div>
  );
}
