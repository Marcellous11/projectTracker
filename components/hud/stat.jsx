import { cn } from "@/lib/utils";
import Spark from "./spark.jsx";

/**
 * Big mono number with an uppercase label below and an optional sparkline.
 * Color tracks tone (default | green | warm | hot | blue).
 */
export default function Stat({
  label,
  value,
  hint = null,
  tone = "default",
  spark = null,
  sparkColor = null,
  className = "",
  size = "md", // "sm" | "md" | "lg"
}) {
  const tones = {
    default: "text-foreground",
    green: "text-green",
    warm: "text-warm",
    hot: "text-hot",
    blue: "text-[var(--color-blue)]",
    muted: "text-muted-foreground",
  };
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <span className="hud-label truncate">{label}</span>
      <div className={cn("hud-num leading-none", sizes[size], tones[tone])}>{value}</div>
      {hint && <span className="hud-mono text-[10px] text-hud-ink-dim truncate">{hint}</span>}
      {spark && spark.length > 0 && (
        <div className={cn("mt-1", tones[tone])}>
          <Spark values={spark} stroke={sparkColor ?? "currentColor"} width={88} height={18} />
        </div>
      )}
    </div>
  );
}
