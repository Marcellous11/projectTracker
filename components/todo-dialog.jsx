"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.jsx";
import { formatDate } from "@/lib/time.js";

const STATE_LABEL = {
  todo: { label: "TO DO", color: "text-green border-green/40" },
  doing: { label: "DOING", color: "text-warm border-warm/40" },
  done: { label: "DONE", color: "text-muted-foreground border-border" },
};

const PRIORITY_LABEL = {
  high: { label: "HIGH", color: "text-hot border-hot/50" },
  medium: { label: "MED", color: "text-warm border-warm/50" },
  low: { label: "LOW", color: "text-muted-foreground border-border" },
};

function Badge({ label, color }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 hud-mono text-[10px] uppercase tracking-wider ${color}`}
    >
      {label}
    </span>
  );
}

function projectHref(rel) {
  return `/p/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Slide-in detail panel for a single to-do. Read-only — drag-and-drop and the
 * add-form handle mutations. Created date is fetched lazily on open.
 */
export default function TodoDialog({ item, open, onOpenChange }) {
  const [meta, setMeta] = useState({ loading: false, source: null, createdAt: null, ageLabel: null });

  useEffect(() => {
    if (!open || !item?.text || !item?.projectRel) return;
    let cancelled = false;
    setMeta({ loading: true, source: null, createdAt: null, ageLabel: null });
    const params = new URLSearchParams({ rel: item.projectRel, text: item.text });
    fetch(`/api/todos/created?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setMeta({
            loading: false,
            source: data.source || null,
            createdAt: data.createdAt || null,
            ageLabel: data.ageLabel || null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setMeta({ loading: false, source: null, createdAt: null, ageLabel: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, item?.text, item?.projectRel]);

  const state = item?.state && STATE_LABEL[item.state];
  const priority = item?.projectPriority && PRIORITY_LABEL[item.projectPriority];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="pb-2">
          {item?.projectRel ? (
            <Link
              href={projectHref(item.projectRel)}
              className="hud-mono text-[10px] uppercase tracking-wider text-hud-ink-dim hover:text-foreground w-fit"
              onClick={() => onOpenChange?.(false)}
            >
              {item?.projectName || item.projectRel}
            </Link>
          ) : (
            <span className="hud-mono text-[10px] uppercase tracking-wider text-hud-ink-dim">
              {item?.projectName || "unknown"}
            </span>
          )}
          <SheetTitle className="text-base font-medium leading-snug pr-8 whitespace-pre-wrap break-words">
            {item?.text || ""}
          </SheetTitle>
          <SheetDescription className="sr-only">To-do detail</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {state && <Badge label={state.label} color={state.color} />}
            {priority && <Badge label={`PRIORITY ${priority.label}`} color={priority.color} />}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
            <dt className="hud-mono uppercase tracking-wider text-[10px] text-hud-ink-dim self-center">Created</dt>
            <dd className="text-foreground">
              {meta.loading ? (
                <span className="text-hud-ink-dim">loading…</span>
              ) : meta.createdAt ? (
                <span>
                  {formatDate(meta.createdAt)}{" "}
                  <span className="text-hud-ink-dim">· {meta.ageLabel}</span>
                  {meta.source === "mtime" && (
                    <span className="hud-mono text-[10px] text-hud-ink-dim ml-2">
                      // file mtime (STATUS.md not in git)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-hud-ink-dim">—</span>
              )}
            </dd>

            <dt className="hud-mono uppercase tracking-wider text-[10px] text-hud-ink-dim self-center">Project</dt>
            <dd>
              {item?.projectRel ? (
                <Link
                  href={projectHref(item.projectRel)}
                  className="text-foreground hover:underline"
                  onClick={() => onOpenChange?.(false)}
                >
                  {item.projectName || item.projectRel}
                </Link>
              ) : (
                <span className="text-foreground">{item?.projectName || "—"}</span>
              )}
            </dd>
          </dl>
        </div>
      </SheetContent>
    </Sheet>
  );
}
