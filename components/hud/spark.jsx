/**
 * Sparkline — pure SVG polyline + optional final-dot, no chart library.
 * Accepts values: number[]. Auto-scales to local min/max. Renders a thin
 * baseline. Server-renderable (no use of useId).
 */
export default function Spark({
  values = [],
  width = 96,
  height = 24,
  stroke = "currentColor",
  baseline = true,
  showDot = true,
  className = "",
  ariaLabel = "trend",
}) {
  const n = values.length;
  if (n < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        role="img"
        aria-label={ariaLabel}
      >
        {baseline && (
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={stroke}
            strokeOpacity={0.25}
            strokeDasharray="2 2"
          />
        )}
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (n - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 2) - 1; // 1px top/bottom padding
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const last = points.split(" ").pop().split(",");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {baseline && (
        <line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke={stroke}
          strokeOpacity={0.15}
        />
      )}
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      {showDot && (
        <circle cx={Number(last[0])} cy={Number(last[1])} r={1.75} fill={stroke} />
      )}
    </svg>
  );
}
