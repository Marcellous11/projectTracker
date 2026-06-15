"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.jsx";
import Module from "@/components/hud/module.jsx";
import { History, TelescopeIcon, CalendarClock, GitCommitHorizontal, GitPullRequest } from "lucide-react";

/**
 * Render an AI summary string as soft bullets (matching the project pages).
 * Strips leading "- "/"•"/"*". Falls back to a paragraph for a single line.
 */
function SummaryBody({ text, fallback }) {
  if (!text) {
    return <p className="text-[13px] text-hud-ink-dim">{fallback}</p>;
  }
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s+/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return (
      <ul className="soft-bullets">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-[15px] leading-relaxed text-foreground/90">{text}</p>;
}

/** Compact muted list of raw source items beneath an AI summary. */
function SourceList({ title, icon: Icon, children }) {
  return (
    <div className="mt-4 border-t border-hud-border/50 pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-hud-ink-dim">
        {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden />}
        {title}
      </div>
      {children}
    </div>
  );
}

// Parse gcalcli `--nocolor agenda` text into clean day groups. A day starts
// with a "Mon Jun 15" style header; lines under it (indented) are its events.
function parseAgenda(text) {
  const days = [];
  let cur = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = raw.match(/^([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2})\s+(.*)$/);
    if (m) {
      cur = { date: m[1], events: [] };
      days.push(cur);
      if (m[2].trim()) cur.events.push(m[2].trim());
    } else if (cur) {
      cur.events.push(raw.trim());
    } else {
      cur = { date: "", events: [raw.trim()] };
      days.push(cur);
    }
  }
  return days;
}

// "14:30" → "2:30p" — compact 12-hour so the time column stays narrow.
function fmt12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "a" : "p";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")}${ap}`;
}

function EventsBlock({ text }) {
  const days = parseAgenda(text);
  if (!days.length) return null;
  return (
    <SourceList title="Calendar" icon={CalendarClock}>
      <div className="flex flex-col gap-3">
        {days.map((d, i) => {
          const timed = [];
          const allDay = [];
          for (const e of d.events) {
            const tm = e.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
            if (tm) timed.push({ time: fmt12(tm[1]), title: tm[2] });
            else allDay.push(e);
          }
          return (
            <div key={i}>
              {d.date && (
                <div className="mb-1 text-[12px] font-semibold text-foreground/90">{d.date}</div>
              )}
              <ul className="flex flex-col gap-1 text-[12px] text-foreground/75">
                {timed.map((e, j) => (
                  <li key={j} className="flex items-baseline gap-2">
                    <span className="w-11 shrink-0 tabular-nums text-hud-ink-dim">{e.time}</span>
                    <span className="min-w-0">{e.title}</span>
                  </li>
                ))}
                {allDay.length > 0 && (
                  <li className="flex items-baseline gap-2">
                    <span className="w-11 shrink-0 text-[11px] text-hud-ink-dim">All day</span>
                    <span className="min-w-0">{allDay.join(" · ")}</span>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </SourceList>
  );
}

function CommitsBlock({ commits }) {
  if (!commits?.length) return null;
  return (
    <SourceList title="Project activity" icon={GitCommitHorizontal}>
      <ul className="flex flex-col gap-1 text-[12px] text-foreground/75">
        {commits.map((c, i) => (
          <li key={i} className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 rounded-full bg-card px-1.5 text-[10px] text-hud-ink-dim">{c.label}</span>
            <span className="min-w-0 truncate">{c.message}</span>
          </li>
        ))}
      </ul>
    </SourceList>
  );
}

function PRsBlock({ prs }) {
  if (!prs?.length) return null;
  return (
    <SourceList title="Open PRs" icon={GitPullRequest}>
      <ul className="flex flex-col gap-1.5 text-[12px] text-foreground/75">
        {prs.map((p, i) => {
          const Row = (
            <>
              <span className="hud-mono shrink-0 text-[11px] text-hud-ink-dim">#{p.number}</span>
              <span className="shrink-0 rounded-full bg-card px-1.5 text-[10px] text-hud-ink-dim">{p.label}</span>
              <span className="min-w-0">{p.title}</span>
            </>
          );
          return (
            <li key={i}>
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-stack flex items-baseline gap-2 transition-colors hover:text-foreground"
                >
                  {Row}
                  <span className="shrink-0 text-green">↗</span>
                </a>
              ) : (
                <span className="mc-stack flex items-baseline gap-2">{Row}</span>
              )}
            </li>
          );
        })}
      </ul>
    </SourceList>
  );
}

function PeriodPanel({ period }) {
  const ctx = period?.context || {};
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Looking back */}
      <Module title="Looking back" voice="briefing" icon={History} caption="What happened — calendar, email, code">
        <SummaryBody text={period?.back} fallback="Not generated yet — runs on the sync timer." />
        <EventsBlock text={ctx.backEvents} />
        <CommitsBlock commits={ctx.commits} />
      </Module>

      {/* Looking ahead */}
      <Module title="Looking ahead" voice="briefing" icon={TelescopeIcon} caption="Upcoming events + likely completions">
        <SummaryBody text={period?.ahead} fallback="Not generated yet — runs on the sync timer." />
        <EventsBlock text={ctx.aheadEvents} />
        <PRsBlock prs={ctx.prs} />
      </Module>
    </div>
  );
}

export default function ReviewClient({ day, week, month }) {
  return (
    <Tabs defaultValue="day" className="gap-4">
      <TabsList className="self-start bg-card">
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>

      <TabsContent value="day">
        <PeriodPanel period={day} />
      </TabsContent>
      <TabsContent value="week">
        <PeriodPanel period={week} />
      </TabsContent>
      <TabsContent value="month">
        <PeriodPanel period={month} />
      </TabsContent>
    </Tabs>
  );
}
