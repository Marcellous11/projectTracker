"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

async function patch(rel, client_id) {
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

/**
 * Inline client picker for the briefing header. Two states:
 *  - meta?.client_id set    -> show ClientTag-style pill that opens a switch/unlink menu
 *  - no client yet          -> show "+ link client" CTA that opens a picker menu
 *
 * Goes right next to the codename pill so it's the first thing you see.
 */
export default function ClientPicker({ rel, meta, clients }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function pick(client_id) {
    setError("");
    setOpen(false);
    try {
      await patch(rel, client_id);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err.message || "failed");
    }
  }

  const linked = meta?.client_id ? clients.find((c) => c.id === meta.client_id) : null;

  return (
    <div ref={wrapRef} className="relative inline-flex items-center">
      {linked ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={pending}
          title="Change or unlink client"
          className="inline-flex items-center gap-1.5 rounded-full border border-hud-border bg-card/60 px-2 py-0.5 text-[11px] hover:border-hud-border-strong hover:bg-card transition-colors disabled:opacity-40"
        >
          <span
            className="size-2 rounded-full border border-hud-border"
            style={{ backgroundColor: linked.color || "transparent" }}
          />
          <span className="hud-mono text-[10px] uppercase tracking-[0.14em] text-foreground/85">
            {linked.name}
          </span>
          <span className="hud-mono text-[9px] text-hud-ink-dim">▾</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-hud-border px-2 py-0.5 text-[11px] hud-mono uppercase tracking-[0.14em] text-hud-ink-dim hover:text-foreground hover:border-hud-border-strong transition-colors disabled:opacity-40"
        >
          + link client
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 flex flex-col rounded-lg border border-hud-border bg-popover py-1 shadow-lg min-w-[14rem]">
          {clients.length === 0 ? (
            <p className="px-3 py-2 hud-mono text-[10px] uppercase tracking-[0.16em] text-hud-ink-dim">
              // no clients yet — create one on /clients
            </p>
          ) : (
            clients.map((c) => {
              const active = meta?.client_id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-sidebar-accent/40 ${active ? "text-foreground" : "text-foreground/85"}`}
                >
                  <span
                    className="size-2 rounded-full border border-hud-border shrink-0"
                    style={{ backgroundColor: c.color || "transparent" }}
                  />
                  <span className="flex-1">{c.name}</span>
                  {active && <span className="hud-mono text-[10px] text-hud-ink-dim">·linked</span>}
                </button>
              );
            })
          )}
          {linked && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex items-center gap-2 px-3 py-1.5 text-left text-[12px] border-t border-hud-border text-hot/85 hover:bg-hot/10"
            >
              <span className="hud-mono text-[10px] uppercase tracking-[0.14em]">× unlink</span>
            </button>
          )}
        </div>
      )}
      {error && <span className="ml-2 hud-mono text-[10px] text-hot">// {error}</span>}
    </div>
  );
}
