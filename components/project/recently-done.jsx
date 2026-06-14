import Module from "@/components/hud/module.jsx";

export default function RecentlyDone({ items = [] }) {
  return (
    <Module
      title="RECENTLY DONE"
      voice="briefing"
      caption={items.length > 0 ? `${items.length} logged` : "nothing logged"}
    >
      {items.length === 0 ? (
        <p className="hud-mono text-[11px] text-hud-ink-dim">// nothing logged yet</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-baseline gap-2 text-[12px]">
              <span className="text-green shrink-0 hud-mono">▸</span>
              <span className="flex-1 min-w-0">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}
