"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TodoDialog from "@/components/todo-dialog.jsx";

const COLUMNS = [
  { key: "todo", label: "TO DO", text: "text-green", border: "border-green/40", left: "border-l-green/60" },
  { key: "doing", label: "DOING", text: "text-warm", border: "border-warm/40", left: "border-l-warm/60" },
  { key: "done", label: "DONE", text: "text-muted-foreground", border: "border-border", left: "border-l-border" },
];

// Bucket filtered column entries by projectRel, preserving first-appearance
// order so the group order stays stable across renders (and across drags).
function groupByRel(entries) {
  const order = [];
  const groups = new Map();
  for (const e of entries) {
    const key = e.item.projectRel || "__unknown__";
    if (!groups.has(key)) {
      order.push(key);
      groups.set(key, {
        rel: e.item.projectRel || null,
        name: e.item.projectName || e.item.projectRel || "unknown",
        entries: [],
      });
    }
    groups.get(key).entries.push(e);
  }
  return order.map((k) => groups.get(k));
}

function TodoRow({ item, idx, col, showProject, isDragging, onDragStart, onDragEnd, onOpen }) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`mc-stack flex items-start gap-2 py-1 pl-2 border-l-2 ${col.left} ${
        col.key === "done" ? "opacity-65" : ""
      } ${isDragging ? "opacity-40" : ""} cursor-grab active:cursor-grabbing select-none hover:bg-foreground/[0.03]`}
    >
      <span
        className={`text-[12px] flex-1 min-w-0 break-words ${
          col.key === "done" ? "line-through text-muted-foreground" : ""
        }`}
      >
        {item.text}
      </span>
      {showProject && item.projectName && (
        <ProjectTag name={item.projectName} rel={item.projectRel} />
      )}
    </li>
  );
}

function ProjectTag({ name, rel }) {
  const cls = "hud-mono text-[9px] text-hud-ink-dim shrink-0 max-w-[88px] truncate uppercase tracking-wider";
  if (!rel) return <span className={cls} title={name}>{name}</span>;
  return (
    <Link
      href={`/p/${rel.split("/").map(encodeURIComponent).join("/")}`}
      className={`${cls} hover:text-foreground`}
      title={name}
      // The parent <li> is the drag handle and the dialog trigger — keep the
      // tag's own navigation working but don't bubble up.
      draggable={false}
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

/**
 * Draggable HUD-style kanban. Items move between TO DO / DOING / DONE by
 * dragging across columns; on drop we optimistically update local state and
 * PATCH /api/todos to flip the checkbox in the project's STATUS.md.
 *
 * Props:
 *  items            [{ text, state, projectName?, projectRel }]
 *  showProject      render the project tag on the right (true on cross-project views)
 *  cap              optional per-column visible cap (overflow link shown below)
 *  overflowHref     where the "+N more →" link points when cap is hit
 *  groupByProject   bucket items by projectRel within each column with a small
 *                   header per project; suppresses the per-row project tag
 */
export default function TodoKanban({ items: itemsProp = [], showProject = false, cap, overflowHref, groupByProject = false }) {
  const router = useRouter();
  const [items, setItems] = useState(itemsProp);
  const [, startTransition] = useTransition();
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const [openItem, setOpenItem] = useState(null);

  // Resync when server rerenders give us fresh items. Cheap: identity check
  // is enough because the parent always passes a fresh array per render.
  useEffect(() => {
    setItems(itemsProp);
  }, [itemsProp]);

  async function moveItem(idx, toState) {
    const item = items[idx];
    if (!item || item.state === toState) return;
    if (!item.projectRel) {
      console.error("todo move skipped: no projectRel on item", item);
      return;
    }

    const fromState = item.state;
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, state: toState } : it)));

    try {
      const res = await fetch("/api/todos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rel: item.projectRel, text: item.text, fromState, toState }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `status ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("todo move failed:", err.message || err);
      setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, state: fromState } : it)));
    }
  }

  return (
    <>
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colItems = items
          .map((it, i) => ({ item: it, idx: i }))
          .filter(({ item }) => item.state === col.key);
        const total = colItems.length;
        const visible = cap != null ? colItems.slice(0, cap) : colItems;
        const overflow = cap != null ? total - visible.length : 0;
        const draggingItem = draggingIdx != null ? items[draggingIdx] : null;
        const isDropHover =
          hoverCol === col.key && draggingItem && draggingItem.state !== col.key;

        return (
          <div
            key={col.key}
            className={`flex flex-col gap-1.5 min-w-0 rounded-md transition-colors ${
              isDropHover ? "bg-foreground/[0.04] outline outline-1 outline-foreground/15" : ""
            }`}
            onDragOver={(e) => {
              if (draggingIdx != null) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (hoverCol !== col.key) setHoverCol(col.key);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setHoverCol((c) => (c === col.key ? null : c));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingIdx != null) moveItem(draggingIdx, col.key);
              setDraggingIdx(null);
              setHoverCol(null);
            }}
          >
            <div className={`flex items-center justify-between border-b pb-1.5 ${col.border}`}>
              <span className={`hud-label ${col.text}`}>{col.label}</span>
              <span className={`hud-num text-[10px] ${col.text}`}>{total}</span>
            </div>
            {visible.length === 0 ? (
              <p className="hud-mono text-[10px] text-hud-ink-dim py-1">// empty</p>
            ) : groupByProject ? (
              groupByRel(visible).map((g, gi) => (
                <div key={g.rel || `g${gi}`} className={gi === 0 ? "" : "mt-2"}>
                  <div className="hud-mono text-[10px] uppercase tracking-wider text-hud-ink-dim pb-0.5">
                    {g.name}
                  </div>
                  <ul className="flex flex-col">
                    {g.entries.map(({ item, idx }) => (
                      <TodoRow
                        key={`${item.projectRel || ""}::${idx}::${item.text}`}
                        item={item}
                        idx={idx}
                        col={col}
                        showProject={false}
                        isDragging={draggingIdx === idx}
                        onDragStart={(e) => {
                          setDraggingIdx(idx);
                          try {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", item.text);
                          } catch {}
                        }}
                        onDragEnd={() => {
                          setDraggingIdx(null);
                          setHoverCol(null);
                        }}
                        onOpen={() => setOpenItem(item)}
                      />
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <ul className="flex flex-col">
                {visible.map(({ item, idx }) => (
                  <TodoRow
                    key={`${item.projectRel || ""}::${idx}::${item.text}`}
                    item={item}
                    idx={idx}
                    col={col}
                    showProject={showProject}
                    isDragging={draggingIdx === idx}
                    onDragStart={(e) => {
                      setDraggingIdx(idx);
                      try {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", item.text);
                      } catch {}
                    }}
                    onDragEnd={() => {
                      setDraggingIdx(null);
                      setHoverCol(null);
                    }}
                    onOpen={() => setOpenItem(item)}
                  />
                ))}
              </ul>
            )}
            {overflow > 0 && overflowHref && (
              <Link
                href={overflowHref}
                className="hud-mono text-[10px] text-hud-ink-dim hover:text-foreground py-1"
              >
                +{overflow} more →
              </Link>
            )}
          </div>
        );
      })}
    </div>
    <TodoDialog
      item={openItem}
      open={openItem != null}
      onOpenChange={(o) => { if (!o) setOpenItem(null); }}
    />
    </>
  );
}
