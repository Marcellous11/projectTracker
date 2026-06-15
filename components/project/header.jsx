import { Pill } from "@/components/hud/pill.jsx";
import MetaEditor from "@/components/project/meta-editor.jsx";
import { ExternalLink } from "lucide-react";

function fmtDate(d) {
  if (!d) return null;
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function statusTone(status) {
  if (!status) return "untracked";
  if (status === "active") return "active";
  if (status === "blocked") return "blocked";
  if (status === "paused") return "paused";
  if (status === "done") return "done";
  return "untracked";
}

function stalenessTone(d) {
  if (d == null) return "muted";
  if (d >= 14) return "hot";
  if (d >= 7) return "warm";
  return "green";
}

/**
 * Per-project briefing header. Hex codename + name + pills + a quiet
 * coordinate-style caption (branch · short-cwd · last contact).
 */
export default function BriefingHeader({ detail, rel, branch = null, lastSessionAt = null, meta = null, githubUrl = null }) {
  const tone = statusTone(detail?.status);
  const stTone = stalenessTone(detail?.staleDays);
  const shortCwd = (() => {
    const dir = detail?.dir || "";
    const trimmed = dir.replace(/^\/Users\/[^/]+/, "~");
    return trimmed.length > 56 ? "…" + trimmed.slice(-55) : trimmed;
  })();
  const lastContact = lastSessionAt
    ? new Date(lastSessionAt).toISOString().replace("T", " ").slice(0, 19) + "Z"
    : "—";

  return (
    <section className="flex flex-col gap-3 pb-4 border-b border-hud-border">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight truncate min-w-0">{detail?.name || "Untitled"}</h1>
        <div className="flex items-center gap-2 ml-auto">
          <Pill tone={tone}>{detail?.status || "untracked"}</Pill>
          {detail?.priority && <Pill tone="done">{detail.priority}</Pill>}
          {detail?.staleDays != null && (
            <Pill tone={stTone === "green" ? "active" : stTone === "warm" ? "paused" : stTone === "hot" ? "blocked" : "done"}>
              {detail.staleDays}d stale
            </Pill>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-soft btn-soft-ghost h-8 px-3 text-[13px]"
            >
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
              GitHub
            </a>
          )}
          <MetaEditor rel={rel} meta={meta} />
        </div>
      </div>

      {/* Quiet meta caption: branch · path · last worked. SHAs/paths stay mono. */}
      <div className="text-[12px] text-hud-ink-dim flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Branch <span className="hud-mono text-foreground/80">{branch || "HEAD"}</span></span>
        <span>Path <span className="hud-mono text-foreground/80">{shortCwd}</span></span>
        <span>Last worked <span className="text-foreground/80">{fmtDate(detail?.lastWorked) || "—"}</span></span>
        <span>Last contact <span className="hud-mono text-foreground/80">{lastContact}</span></span>
      </div>
    </section>
  );
}
