"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Compact "add a to-do" form. POSTs to /api/todos and refreshes the route
 * so the new line shows up immediately. Two modes:
 *
 *   - With a fixed `rel` (per-project page) → just an input.
 *   - With a `projects` list (home / all-to-dos) → input + project picker.
 */
export default function AddTodo({ rel, projects, defaultRel, placeholder = "Add a to-do…" }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pickRel, setPickRel] = useState(defaultRel || projects?.[0]?.rel || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const targetRel = rel || pickRel;
  const showPicker = !rel && Array.isArray(projects);

  async function submit(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    if (!targetRel) {
      setError("pick a project");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rel: targetRel, text: clean }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `failed (${res.status})`);
        return;
      }
      setText("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message || "network error");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {showPicker && (
          <select
            value={pickRel}
            onChange={(e) => setPickRel(e.target.value)}
            className="h-8 max-w-[180px] rounded-lg border border-input bg-transparent px-2 text-xs hud-mono uppercase tracking-wider text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="project"
          >
            {projects.map((p) => (
              <option key={p.rel} value={p.rel}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={pending}
          maxLength={500}
          className="h-8 flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="h-8 shrink-0 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          {pending ? "…" : "add"}
        </button>
      </div>
      {error && <p className="hud-mono text-[10px] text-hot">// {error}</p>}
    </form>
  );
}
