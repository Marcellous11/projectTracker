import Module from "@/components/hud/module.jsx";

function fmtDate(iso) {
  if (!iso) return "—";
  const x = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export default function RecentCommits({ git }) {
  const isRepo = !!git?.isRepo;
  const commits = git?.commits || [];

  return (
    <Module
      title="RECENT COMMITS"
      voice="signals"
      caption={isRepo ? `git log · ${commits.length} shown` : "not a git repository"}
    >
      {!isRepo ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// not a git repository</p>
      ) : commits.length === 0 ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// no commits found</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {commits.map((c) => (
            <li key={c.hash} className="flex flex-col gap-0.5">
              <span className="text-[13px] leading-snug">{c.subject}</span>
              <span className="hud-mono text-[10px] text-hud-ink-dim">
                <span className="text-green">{c.short}</span> · {fmtDate(c.dateISO)} · {c.author}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}
