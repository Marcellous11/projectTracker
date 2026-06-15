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

function EventsBlock({ text }) {
  const t = (text || "").trim();
  if (!t) return null;
  return (
    <SourceList title="Calendar" icon={CalendarClock}>
      <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-foreground/75">{t}</pre>
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
      <ul className="flex flex-col gap-1 text-[12px] text-foreground/75">
        {prs.map((p, i) => (
          <li key={i} className="flex min-w-0 items-baseline gap-2">
            <span className="hud-mono shrink-0 text-[11px] text-hud-ink-dim">#{p.number}</span>
            <span className="shrink-0 rounded-full bg-card px-1.5 text-[10px] text-hud-ink-dim">{p.label}</span>
            <span className="min-w-0 truncate">{p.title}</span>
          </li>
        ))}
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
