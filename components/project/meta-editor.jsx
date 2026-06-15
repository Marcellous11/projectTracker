"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet.jsx";

function dollars(cents) {
  if (cents == null || cents === "") return "";
  return (Number(cents) / 100).toFixed(2);
}

/**
 * Inline editor (button + slide-in Sheet) for per-project metadata:
 * codename override, rate override, currency, notes. Empties = inherit.
 */
export default function MetaEditor({ rel, meta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codename, setCodename] = useState(meta?.codename ?? "");
  const [rate, setRate] = useState(dollars(meta?.rate_cents));
  const [currency, setCurrency] = useState(meta?.currency ?? "");
  const [notes, setNotes] = useState(meta?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const rateCents = rate.trim() === "" ? null : Math.round(Number(rate) * 100);
    if (rate.trim() !== "" && (!Number.isFinite(rateCents) || rateCents < 0)) {
      setError("rate must be a positive number");
      setBusy(false);
      return;
    }
    const payload = {
      codename: codename.trim() || null,
      rate_cents: rateCents,
      currency: currency.trim().toUpperCase() || null,
      notes: notes.trim() || null,
    };
    const segs = rel.split("/").map(encodeURIComponent).join("/");
    try {
      const res = await fetch(`/api/projects/meta/${segs}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `failed (${res.status})`);
        setBusy(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message || "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 rounded-lg border border-hud-border px-2.5 text-[10px] hud-mono uppercase tracking-[0.18em] text-hud-ink-dim hover:text-foreground hover:border-hud-border-strong transition-colors"
      >
        edit meta
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="border-b border-hud-border">
            <SheetTitle className="text-base font-medium">Project metadata</SheetTitle>
            <SheetDescription className="hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim">
              {rel}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <Field label="CODENAME (override)">
              <input
                value={codename}
                onChange={(e) => setCodename(e.target.value)}
                maxLength={40}
                className="hud-input hud-mono uppercase"
                placeholder="auto"
              />
            </Field>

            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <Field label="RATE (override)">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="hud-input"
                    placeholder="—"
                  />
                  <span className="hud-mono text-[10px] uppercase text-hud-ink-dim">/hr</span>
                </div>
              </Field>
              <Field label="CCY">
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="hud-input hud-mono uppercase text-center"
                  placeholder="USD"
                />
              </Field>
            </div>

            <Field label="NOTES">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                maxLength={5000}
                className="hud-input min-h-[7rem] resize-y py-2"
                placeholder="Internal notes about this project…"
              />
            </Field>

            {error && <p className="hud-mono text-[10px] text-hot">// {error}</p>}
          </form>

          <SheetFooter className="border-t border-hud-border flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="h-8 rounded-lg border border-hud-border px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-hud-ink-dim hover:text-foreground transition-colors"
            >
              cancel
            </button>
            <button
              type="submit"
              onClick={submit}
              disabled={busy}
              className="h-8 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 transition-colors"
            >
              {busy ? "…" : "save"}
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
