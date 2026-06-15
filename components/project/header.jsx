import { Pill, HexPill } from "@/components/hud/pill.jsx";
import { codename } from "@/lib/codename.js";
import MetaEditor from "@/components/project/meta-editor.jsx";

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
export default function BriefingHeader({ detail, rel, branch = null, lastSessionAt = null, meta = null }) {
  const tone = statusTone(detail?.status);
  const stTone = stalenessTone(detail?.staleDays);
  const displayCodename = meta?.codename || codename(rel);
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
        <HexPill tone={tone} className="shrink-0">{displayCodename}</HexPill>
        <h1 className="hud-mono tracking-tight text-2xl truncate min-w-0">{detail?.name || "Untitled"}</h1>
        <div className="flex items-center gap-2 ml-auto">
          <Pill tone={tone}>{detail?.status || "untracked"}</Pill>
          {detail?.priority && <Pill tone="done">{detail.priority}</Pill>}
          {detail?.staleDays != null && (
            <Pill tone={stTone === "green" ? "active" : stTone === "warm" ? "paused" : stTone === "hot" ? "blocked" : "done"}>
              {detail.staleDays}d stale
            </Pill>
          )}
          <MetaEditor rel={rel} meta={meta} />
        </div>
      </div>

      {/* Coordinate-style caption: branch · short-cwd · last contact */}
      <div className="hud-mono text-[11px] text-hud-ink-dim flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>BRANCH <span className="text-foreground/80">{branch || "HEAD"}</span></span>
        <span>PATH <span className="text-foreground/80">{shortCwd}</span></span>
        <span>LAST WORKED <span className="text-foreground/80">{fmtDate(detail?.lastWorked) || "—"}</span></span>
        <span>LAST CONTACT <span className="text-foreground/80">{lastContact}</span></span>
      </div>
    </section>
  );
}
