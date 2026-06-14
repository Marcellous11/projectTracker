import Link from "next/link";
import Module from "@/components/hud/module.jsx";
import { fmtDuration } from "@/lib/duration.js";

function fmtRelative(ms) {
  if (!ms) return "—";
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TimeSummary({ totalsToday, totalsWeek, totalsMonth, totalsByClient, lastAutoSyncAt }) {
  const sum = (arr) => arr.reduce((n, r) => n + (Number(r.total_ms) || 0), 0);
  const topProjectsWeek = [...totalsWeek].slice(0, 4);

  return (
    <Module
      title="TIME"
      voice="ops"
      caption="manual + auto-rolled Claude session activity"
      right={
        <Link
          href="/time"
          className="hud-mono text-[10px] uppercase tracking-[0.18em] text-hud-ink-dim hover:text-foreground"
        >
          open log →
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="TODAY" value={fmtDuration(sum(totalsToday))} />
        <Stat label="WEEK" value={fmtDuration(sum(totalsWeek))} />
        <Stat label="MONTH" value={fmtDuration(sum(totalsMonth))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="hud-label mb-2">// TOP PROJECTS · WEEK</div>
          {topProjectsWeek.length === 0 ? (
            <p className="hud-mono text-[11px] text-hud-ink-dim">// no time logged</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {topProjectsWeek.map((r) => (
                <li key={r.project_rel} className="flex items-baseline gap-2 text-[12px]">
                  <Link
                    href={`/p/${r.project_rel.split("/").map(encodeURIComponent).join("/")}`}
                    className="flex-1 min-w-0 truncate hud-mono uppercase tracking-[0.14em] text-foreground/85 hover:text-foreground"
                  >
                    {r.project_rel}
                  </Link>
                  <span className="hud-num text-[12px] tabular-nums shrink-0">
                    {fmtDuration(r.total_ms)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="hud-label mb-2">// BY CLIENT · MONTH</div>
          {totalsByClient.length === 0 ? (
            <p className="hud-mono text-[11px] text-hud-ink-dim">// no client time yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {totalsByClient.slice(0, 4).map((c) => (
                <li key={c.client_id ?? "none"} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="size-2 shrink-0 rounded-full border border-hud-border"
                    style={{ backgroundColor: c.client_color || "transparent" }}
                  />
                  <span className="flex-1 min-w-0 truncate">{c.client_name || "(unassigned)"}</span>
                  <span className="hud-num text-[12px] tabular-nums shrink-0">
                    {fmtDuration(c.total_ms)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {lastAutoSyncAt && (
        <p className="hud-mono text-[10px] text-hud-ink-dim mt-3">
          // auto-sync {fmtRelative(lastAutoSyncAt)}
        </p>
      )}
    </Module>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-hud-border bg-card/30 p-2 flex flex-col gap-0.5">
      <span className="hud-label">{label}</span>
      <span className="hud-num text-lg tabular-nums">{value}</span>
    </div>
  );
}
