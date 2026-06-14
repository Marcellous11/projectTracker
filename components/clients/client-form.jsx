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

const PALETTE = [
  "#7c3aed", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
];

function dollars(cents) {
  if (cents == null || cents === "") return "";
  return (Number(cents) / 100).toFixed(2);
}

export default function ClientForm({ open, onOpenChange, client }) {
  const router = useRouter();
  const isEdit = !!client?.id;

  const [name, setName] = useState(client?.name ?? "");
  const [color, setColor] = useState(client?.color ?? PALETTE[0]);
  const [email, setEmail] = useState(client?.contact_email ?? "");
  const [phone, setPhone] = useState(client?.contact_phone ?? "");
  const [rate, setRate] = useState(dollars(client?.default_rate_cents));
  const [currency, setCurrency] = useState(client?.default_currency ?? "USD");
  const [country, setCountry] = useState(client?.country ?? "");
  const [tz, setTz] = useState(client?.tz ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
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
      name: name.trim(),
      color,
      contact_email: email.trim() || null,
      contact_phone: phone.trim() || null,
      default_rate_cents: rateCents,
      default_currency: currency.trim().toUpperCase() || "USD",
      country: country.trim().toUpperCase() || null,
      tz: tz.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      const url = isEdit ? `/api/clients/${client.id}` : "/api/clients";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `failed (${res.status})`);
        setBusy(false);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err.message || "network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!isEdit) return;
    if (!confirm(`Delete client "${client.name}"? Projects linked to it will be unlinked.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `delete failed (${res.status})`);
        setBusy(false);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err.message || "network error");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b border-hud-border">
          <SheetTitle className="text-base font-medium">
            {isEdit ? "Edit client" : "New client"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEdit ? "Update client details" : "Create a new client"}
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
              placeholder="Acme Corp"
            />
          </Field>

          <Field label="COLOR">
            <div className="flex flex-wrap items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                maxLength={7}
                className="hud-input ml-2 w-20 hud-mono text-[11px] uppercase"
                placeholder="#rrggbb"
              />
            </div>
          </Field>

          <Field label="CONTACT EMAIL">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              className="hud-input"
              placeholder="billing@acme.com"
            />
          </Field>

          <Field label="CONTACT PHONE">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              className="hud-input"
              placeholder="+1 555 0100"
            />
          </Field>

          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <Field label="DEFAULT RATE">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="hud-input"
                  placeholder="150.00"
                />
                <span className="hud-mono text-[10px] uppercase text-hud-ink-dim">per hour</span>
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

          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <Field label="COUNTRY">
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={2}
                className="hud-input hud-mono uppercase text-center"
                placeholder="US"
              />
            </Field>
            <Field label="TIMEZONE">
              <input
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                maxLength={60}
                className="hud-input"
                placeholder="America/Los_Angeles"
              />
            </Field>
          </div>

          <Field label="NOTES">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={5000}
              className="hud-input min-h-[6rem] resize-y py-2"
              placeholder="Anything to remember about this client…"
            />
          </Field>

          {error && <p className="hud-mono text-[10px] text-hot">// {error}</p>}
        </form>

        <SheetFooter className="border-t border-hud-border flex-row justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="h-8 rounded-lg border border-hot/40 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-hot hover:bg-hot/10 disabled:opacity-40 transition-colors"
            >
              delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
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
              {busy ? "…" : isEdit ? "save" : "create"}
            </button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
