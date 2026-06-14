"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet.jsx";

const STATUSES = ["active", "blocked", "paused", "done"];
const PRIORITIES = ["high", "medium", "low"];

function autoSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "+ NEW PROJECT" button + Sheet form, mounted in the sidebar header.
 * Posts to /api/projects/create. On success, refreshes the dashboard so
 * the new entry appears in the roster (with a green idle dot if there's
 * an open Claude session in that folder, otherwise dim).
 */
export default function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [folderTouched, setFolderTouched] = useState(false);

  // Auto-fill folder from the name until the user types in the folder field.
  useEffect(() => {
    if (!folderTouched) setFolder(autoSlug(name));
  }, [name, folderTouched]);

  function reset() {
    setName(""); setFolder(""); setStatus("active"); setPriority("medium");
    setError(""); setFolderTouched(false); setBusy(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          folder: folder.trim() || null,
          status,
          priority,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `failed (${res.status})`);
        setBusy(false);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err?.message || "network error");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Scaffold a new project (creates folder + STATUS.md)"
        className="hud-mono text-[10px] uppercase tracking-[0.16em] text-green/80 hover:text-green border border-green/40 hover:bg-green/10 rounded px-1.5 py-0.5 transition-colors shrink-0"
      >
        + new
      </button>
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="border-b border-hud-border">
            <SheetTitle className="text-base font-medium">New project</SheetTitle>
            <SheetDescription className="sr-only">
              Scaffold a STATUS.md (and create the folder if it doesn't exist) so the dashboard tracks this project.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <Field label="NAME">
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="hud-input"
                placeholder="My Cool App"
              />
              <p className="hud-mono text-[10px] text-hud-ink-dim mt-1">
                appears as <code>project:</code> in STATUS.md
              </p>
            </Field>

            <Field label="FOLDER">
              <input
                value={folder}
                onChange={(e) => { setFolder(e.target.value); setFolderTouched(true); }}
                maxLength={200}
                className="hud-input hud-mono text-[12px]"
                placeholder="auto: my-cool-app"
              />
              <p className="hud-mono text-[10px] text-hud-ink-dim mt-1">
                relative to PROJECTS_ROOT. Folder will be created if it doesn't exist. Leave blank to auto-derive from the name.
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="STATUS">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="hud-input hud-mono text-[12px]"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="PRIORITY">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="hud-input hud-mono text-[12px]"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            {error && <p className="hud-mono text-[10px] text-hot">// {error}</p>}
          </form>

          <SheetFooter className="border-t border-hud-border flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              disabled={busy}
              className="h-8 rounded-lg border border-hud-border px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-hud-ink-dim hover:text-foreground disabled:opacity-40 transition-colors"
            >
              cancel
            </button>
            <button
              type="submit"
              onClick={submit}
              disabled={busy || !name.trim()}
              className="h-8 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 transition-colors"
            >
              {busy ? "…" : "create"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="hud-mono text-[10px] uppercase tracking-[0.18em] text-hud-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
