import Module from "@/components/hud/module.jsx";

function trim(s) {
  return String(s || "").trim();
}

function isBlocked(b) {
  const s = trim(b).toLowerCase();
  return s && s !== "none" && s !== "n/a";
}

/**
 * Briefing voice. Combines "next action" + "blockers" in one high-contrast
 * focus row — hot border if blocked, otherwise green-glow if active.
 */
export default function Focus({ detail }) {
  const next = trim(detail?.nextAction);
  const blockers = trim(detail?.blockers);
  const blocked = isBlocked(blockers);

  return (
    <Module
      title="FOCUS"
      voice="briefing"
      accent={blocked ? "hot" : next ? "green" : null}
      caption={blocked ? "blocked — clear this first" : next ? "next action on record" : "no focus on record"}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="hud-label">NEXT ACTION</span>
          {next ? (
            <p className="text-[14px] leading-snug whitespace-pre-wrap">{next}</p>
          ) : (
            <p className="hud-mono text-[11px] text-hud-ink-dim">// nothing queued</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={`hud-label ${blocked ? "text-hot" : ""}`}>BLOCKERS</span>
          {blocked ? (
            <p className="text-[14px] leading-snug text-hot whitespace-pre-wrap">{blockers}</p>
          ) : (
            <p className="hud-mono text-[11px] text-hud-ink-dim">// none</p>
          )}
        </div>
      </div>
    </Module>
  );
}
