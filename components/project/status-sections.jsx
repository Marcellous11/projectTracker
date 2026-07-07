import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, CircleDot, Circle, AlertTriangle, CheckCheck, Flag } from "lucide-react";

// Inline markdown — renders **bold**, `code`, [links], ~~strike~~ inside our
// lists WITHOUT the block <p> wrapper, so list rows stay tight one-liners.
function Md({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <>{children}</>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{children}</a>
        ),
        code: ({ children }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
        ),
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// Split a STATUS.md prose section into clean lines, stripping leading bullet /
// number markers so we can re-render them as a tidy list instead of a blob.
function toLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}
function isNumbered(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numbered = lines.filter((l) => /^\d+[.)]\s+/.test(l)).length;
  return lines.length > 1 && numbered >= Math.ceil(lines.length / 2);
}

/** A clean ordered/unordered list rendered from a prose section. */
function CleanList({ text }) {
  const lines = toLines(text);
  if (lines.length === 0) return null;
  if (lines.length === 1) {
    return <p className="text-[14px] leading-relaxed text-foreground/90"><Md>{lines[0]}</Md></p>;
  }
  if (isNumbered(text)) {
    return (
      <ol className="flex flex-col gap-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-snug text-foreground/90">
            <span className="hud-num shrink-0 font-semibold text-primary">{i + 1}.</span>
            <span className="min-w-0"><Md>{l}</Md></span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul className="soft-bullets">
      {lines.map((l, i) => <li key={i}><Md>{l}</Md></li>)}
    </ul>
  );
}

/* ── Stats strip — the numbers that matter, up top ────────────────────────── */
export function StatStrip({ detail, prCount = 0, itineraryCount = 0 }) {
  const c = detail.todoCounts || {};
  const total = (c.todo || 0) + (c.doing || 0) + (c.done || 0);
  const isDone = detail.status === "done";
  const pct = isDone ? 100 : total ? Math.round(((c.done || 0) / total) * 100) : null;
  const stale = detail.staleDays;

  const stats = [
    pct != null && { label: isDone ? "Complete" : "Progress", value: `${pct}%`, accent: "kpi-accent-green" },
    total > 0 && { label: "Done", value: `${c.done || 0}/${total}` },
    (c.doing || 0) > 0 && { label: "In progress", value: c.doing, accent: "kpi-accent-warm" },
    { label: "Open PRs", value: prCount, accent: "kpi-accent-blue" },
    itineraryCount > 0 && { label: "Itinerary", value: itineraryCount },
    stale != null && { label: "Last worked", value: stale === 0 ? "today" : `${stale}d ago` },
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {pct != null && (
        <div className="cc-bar">
          <span className="cc-bar-fill" data-done={isDone ? "true" : "false"} style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`kpi ${s.accent || ""}`}>
            <span className="kpi-value">{s.value}</span>
            <span className="kpi-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Where we are — current focus + blockers ──────────────────────────────── */
export function WhereWeAre({ nextAction, blockers }) {
  const hasBlockers = blockers && toLines(blockers).length > 0 &&
    !/^none\.?$/i.test(String(blockers).trim());
  if (!nextAction && !hasBlockers) return null;
  return (
    <section className="soft-card flex flex-col gap-4 p-5">
      <h2 className="soft-title flex items-center gap-2">
        <Flag size={18} strokeWidth={2} className="text-primary" aria-hidden />
        Where we are
      </h2>
      {nextAction && <CleanList text={nextAction} />}
      {hasBlockers && (
        <div className="rounded-xl border border-hot/40 bg-hot/10 p-3.5">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-hot">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden /> Blockers
          </div>
          <div className="text-foreground/90">
            <CleanList text={blockers} />
          </div>
        </div>
      )}
    </section>
  );
}

const TODO_MARK = {
  done: { Icon: CheckCircle2, cls: "text-green" },
  doing: { Icon: CircleDot, cls: "text-warm" },
  todo: { Icon: Circle, cls: "text-muted-foreground" },
};

/* ── Worklist — the To-do / acceptance criteria as a real checklist ───────── */
export function Worklist({ todos = [], counts = {} }) {
  if (!todos.length) return null;
  const total = todos.length;
  const done = counts.done || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  // What needs doing first, then in-progress, then completed.
  const order = { todo: 0, doing: 1, done: 2 };
  const sorted = [...todos].sort((a, b) => (order[a.state] ?? 0) - (order[b.state] ?? 0));

  return (
    <section className="soft-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="soft-title flex items-center gap-2">
          <CheckCheck size={18} strokeWidth={2} className="text-primary" aria-hidden />
          What's left
        </h2>
        <span className="hud-num text-[13px] font-semibold text-foreground">
          {done}/{total} <span className="text-muted-foreground">· {pct}%</span>
        </span>
      </div>
      <div className="cc-bar">
        <span className="cc-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="flex flex-col">
        {sorted.map((t, i) => {
          const m = TODO_MARK[t.state] || TODO_MARK.todo;
          const M = m.Icon;
          return (
            <li
              key={i}
              className="flex items-start gap-2.5 border-b border-hud-border/40 py-2.5 last:border-0"
            >
              <M size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${m.cls}`} aria-hidden />
              <span className={`min-w-0 text-[14px] leading-snug ${t.state === "done" ? "text-muted-foreground line-through" : "text-foreground/90"}`}>
                <Md>{t.text}</Md>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Recently done — tight numbered list, capped ──────────────────────────── */
export function RecentlyDone({ items = [], cap = 6 }) {
  if (!items.length) return null;
  const shown = items.slice(0, cap);
  const more = items.length - shown.length;
  return (
    <section className="soft-card flex flex-col gap-3 p-5">
      <h2 className="soft-title flex items-center gap-2">
        <CheckCircle2 size={18} strokeWidth={2} className="text-green" aria-hidden />
        Recently done
      </h2>
      <ol className="flex flex-col gap-2.5">
        {shown.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-foreground/85">
            <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-green/70" aria-hidden />
            <span className="min-w-0"><Md>{it}</Md></span>
          </li>
        ))}
      </ol>
      {more > 0 && (
        <p className="text-[12px] text-muted-foreground">+{more} more in the full notes below</p>
      )}
    </section>
  );
}
