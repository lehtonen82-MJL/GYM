"use client";

/** Small line chart of one value over dated points (Progress tabs). */
export default function MiniChart<T extends { date: string }>({
  data,
  getValue,
  color,
  unit,
  inverted,
  formatLabel,
}: {
  data: T[];
  getValue: (d: T) => number;
  color: string;
  unit: string;
  inverted?: boolean;
  formatLabel?: (v: number) => string;
}) {
  const values = data.map(getValue);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  // inverted: lower value → higher on chart (e.g. pace: faster = better)
  const getY = (v: number) =>
    inverted
      ? 20 + ((v - minVal) / range) * 140
      : 20 + ((maxVal - v) / range) * 140;

  const labelFor = formatLabel ?? ((v: number) => `${Math.round(v)}${unit}`);

  return (
    <svg viewBox="0 0 320 180" className="w-full h-44" preserveAspectRatio="none">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1="40"
          y1={20 + f * 140}
          x2="310"
          y2={20 + f * 140}
          stroke="#3f3f46"
          strokeWidth="0.5"
        />
      ))}

      {/* Y-axis labels */}
      {[0, 0.5, 1].map((f) => {
        const v = inverted ? minVal + f * range : maxVal - f * range;
        return (
          <text key={f} x="35" y={24 + f * 140} textAnchor="end" fill="#a1a1aa" fontSize="10">
            {labelFor(v)}
          </text>
        );
      })}

      {/* Line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={data
          .map((d, i) => {
            const x = 40 + (i / Math.max(data.length - 1, 1)) * 270;
            const y = getY(getValue(d));
            return `${x},${y}`;
          })
          .join(" ")}
      />

      {/* Dots */}
      {data.map((d, i) => {
        const x = 40 + (i / Math.max(data.length - 1, 1)) * 270;
        const y = getY(getValue(d));
        return <circle key={i} cx={x} cy={y} r="4" fill={color} />;
      })}
    </svg>
  );
}
