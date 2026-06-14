"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClientForm from "./client-form.jsx";

function fmtRate(cents, ccy) {
  if (cents == null) return "—";
  const v = (Number(cents) / 100).toFixed(2);
  return `${ccy || "USD"} ${v}/h`;
}

function projectHref(rel) {
  return "/p/" + rel.split("/").map(encodeURIComponent).join("/");
}

async function patchProjectClient(rel, client_id) {
  const segs = rel.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`/api/projects/meta/${segs}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `failed (${res.status})`);
  }
}

function fmtMoney(cents, ccy) {
  if (cents == null) return null;
  return `${ccy || ""} ${(Number(cents) / 100).toFixed(2)}`.trim();
}

export default function ClientsTable({ clients, projects, signals = {} }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const projectsByClient = new Map();
  const unassigned = [];
  for (const p of projects) {
    if (p.client_id == null) unassigned.push(p);
    else {
      if (!projectsByClient.has(p.client_id)) projectsByClient.set(p.client_id, []);
      projectsByClient.get(p.client_id).push(p);
    }
  }

  async function link(rel, client_id) {
    setError("");
    try {
      await patchProjectClient(rel, client_id);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message || "link failed");
    }
  }

  async function unlink(rel) {
    setError("");
    try {
      await patchProjectClient(rel, null);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message || "unlink failed");
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clients.length} {clients.length === 1 ? "client" : "clients"} ·{" "}
          <span className="hud-mono text-[11px] text-hud-ink-dim">
            {unassigned.length} project{unassigned.length === 1 ? "" : "s"} unassigned
          </span>
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-8 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 transition-colors"
        >
          + new client
        </button>
      </div>

      {error && (
        <p className="mb-3 hud-mono text-[10px] text-hot">// {error}</p>
      )}

      {clients.length === 0 ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">
          // no clients yet. create one to start tagging projects.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hud-border rounded-lg border border-hud-border bg-card/40">
          {clients.map((c) => {
            const expanded = expandedId === c.id;
            const linked = projectsByClient.get(c.id) || [];
            const sig = signals[c.id] || {};
            return (
              <li key={c.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    className="flex flex-1 items-center gap-3 text-left hover:opacity-80 transition-opacity min-w-0"
                    aria-expanded={expanded}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full border border-hud-border"
                      style={{ backgroundColor: c.color || "transparent" }}
                    />
                    <span className="hud-mono text-[10px] text-hud-ink-dim shrink-0 w-3">
                      {expanded ? "▾" : "▸"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="block truncate text-[13px] font-medium">{c.name}</span>
                        {sig.holiday && (
                          <span
                            className="size-1.5 rounded-full bg-warm shrink-0"
                            title={`Public holiday today: ${sig.holiday.name}`}
                          />
                        )}
                      </span>
                      <span className="block hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim">
                        {c.contact_email || c.contact_phone || "no contact"}
                        {sig.localTime && (
                          <span className="ml-2" title={sig.tz || ""}>
                            · {sig.localTime}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim shrink-0">
                      {linked.length} {linked.length === 1 ? "project" : "projects"}
                    </span>
                    <span className="hud-num text-[11px] text-foreground tabular-nums shrink-0 w-28 text-right">
                      {fmtRate(c.default_rate_cents, c.default_currency)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim hover:text-foreground shrink-0 transition-colors"
                    title="Edit client"
                  >
                    edit
                  </button>
                </div>

                {expanded && (
                  <ExpandedRow
                    client={c}
                    linked={linked}
                    unassigned={unassigned}
                    onLink={link}
                    onUnlink={unlink}
                    pending={pending}
                    signal={sig}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unassigned.length > 0 && (
        <section className="mt-6">
          <h2 className="hud-label mb-2">// UNASSIGNED PROJECTS</h2>
          <ul className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <li key={p.rel}>
                <BulkAssignChip project={p} clients={clients} onLink={link} pending={pending} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && <ClientForm open={creating} onOpenChange={setCreating} />}
      {editing && (
        <ClientForm
          key={editing.id}
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          client={editing}
        />
      )}
    </>
  );
}

function ExpandedRow({ client, linked, unassigned, onLink, onUnlink, pending, signal = {} }) {
  const [picking, setPicking] = useState("");

  const billClient = signal.monthBillClient ? fmtMoney(signal.monthBillClient.cents, signal.monthBillClient.ccy) : null;
  const billUser = signal.monthBillUser ? fmtMoney(signal.monthBillUser.cents, signal.monthBillUser.ccy) : null;
  const hasSignals = signal.localTime || signal.holiday || billClient;

  return (
    <div className="border-t border-hud-border bg-background/40 px-4 py-3 flex flex-col gap-3">
      {hasSignals && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim">
          {signal.localTime && (
            <span title={signal.tz || ""}>// LOCAL <span className="text-foreground">{signal.localTime}</span></span>
          )}
          {signal.holiday && (
            <span className="text-warm">// HOLIDAY {signal.holiday.name}</span>
          )}
          {billClient && (
            <span>// MTD BILL <span className="text-foreground">{billClient}</span>
              {billUser && <span className="ml-1 text-hud-ink-dim">≈ {billUser}</span>}
            </span>
          )}
        </div>
      )}
      {linked.length === 0 ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// no projects linked yet</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {linked.map((p) => (
            <li
              key={p.rel}
              className="flex items-center gap-2 rounded-full border border-hud-border bg-card/60 pl-3 pr-1 py-1 text-[12px]"
            >
              <Link
                href={projectHref(p.rel)}
                className="text-foreground/85 hover:text-foreground truncate max-w-[18rem]"
                title={p.rel}
              >
                {p.name}
              </Link>
              <button
                type="button"
                onClick={() => onUnlink(p.rel)}
                disabled={pending}
                className="size-5 rounded-full hud-mono text-[12px] text-hud-ink-dim hover:bg-hot/15 hover:text-hot disabled:opacity-40 transition-colors"
                title="Unlink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {unassigned.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (picking) {
              onLink(picking, client.id);
              setPicking("");
            }
          }}
          className="flex items-center gap-2"
        >
          <select
            value={picking}
            onChange={(e) => setPicking(e.target.value)}
            className="hud-input max-w-xs"
          >
            <option value="">+ link an unassigned project…</option>
            {unassigned.map((p) => (
              <option key={p.rel} value={p.rel}>{p.name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!picking || pending}
            className="h-8 rounded-lg border border-green/50 px-3 text-[11px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 transition-colors"
          >
            link
          </button>
        </form>
      )}
    </div>
  );
}

function BulkAssignChip({ project, clients, onLink, pending }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={pending}
        className="flex items-center gap-2 rounded-full border border-hud-border bg-card/60 px-3 py-1 text-[12px] hover:bg-card hover:border-hud-border-strong disabled:opacity-40 transition-colors"
      >
        <span className="truncate max-w-[16rem]">{project.name}</span>
        <span className="hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim">+ client</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 flex flex-col rounded-lg border border-hud-border bg-popover py-1 shadow-lg min-w-[12rem]">
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onLink(project.rel, c.id);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-sidebar-accent/40"
            >
              <span
                className="size-2 rounded-full border border-hud-border shrink-0"
                style={{ backgroundColor: c.color || "transparent" }}
              />
              <span>{c.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim px-3 py-1.5 hover:text-foreground"
          >
            // cancel
          </button>
        </div>
      )}
    </div>
  );
}
