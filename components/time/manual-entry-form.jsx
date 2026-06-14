"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function combineLocal(dateStr, timeStr) {
  if (!dateStr || !timeStr) return NaN;
  return new Date(`${dateStr}T${timeStr}`).getTime();
}

/** Manual time-entry form: project, date, start, end, note, billable. */
export default function ManualEntryForm({ projects }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [project, setProject] = useState(projects[0]?.rel || "");
  const [date, setDate] = useState(todayDateInput());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    const s = combineLocal(date, start);
    const en = combineLocal(date, end);
    if (!project) return setError("pick a project");
    if (!Number.isFinite(s) || !Number.isFinite(en)) return setError("invalid time");
    if (en <= s) return setError("end must be after start");
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_rel: project,
          started_at: s,
          ended_at: en,
          note: note.trim() || null,
          billable,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `failed (${res.status})`);
        return;
      }
      setStart(""); setEnd(""); setNote("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message || "network error");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-hud-border bg-card/40 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="hud-label">// MANUAL ENTRY</span>
        <span className="hud-mono text-[10px] text-hud-ink-dim">log time after the fact</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_8rem_6rem_6rem_auto] gap-2 items-end">
        <Field label="PROJECT">
          <select value={project} onChange={(e) => setProject(e.target.value)} className="hud-input" required>
            {projects.map((p) => (
              <option key={p.rel} value={p.rel}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="DATE">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="hud-input" />
        </Field>
        <Field label="START">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required className="hud-input" />
        </Field>
        <Field label="END">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required className="hud-input" />
        </Field>
        <label className="flex items-center gap-2 self-end h-8 hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          billable
        </label>
      </div>
      <Field label="NOTE">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="What did you do? (e.g. design review, client call)"
          className="hud-input"
        />
      </Field>
      {error && <p className="hud-mono text-[10px] text-hot">// {error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 transition-colors"
        >
          {pending ? "…" : "log time"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="hud-mono text-[10px] uppercase tracking-[0.18em] text-hud-ink-dim">{label}</span>
      {children}
    </label>
  );
}
