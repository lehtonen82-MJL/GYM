"use client";

import { useState, useEffect } from "react";
import { getExerciseProgress } from "@/lib/actions";

type Exercise = { id: string; name: string };
type DataPoint = { date: string; weight_kg: number; reps: number } | null;

export default function ProgressClient({
  exercises,
}: {
  exercises: Exercise[];
}) {
  const [selectedId, setSelectedId] = useState(exercises[0]?.id ?? "");
  const [data, setData] = useState<NonNullable<DataPoint>[]>([]);
  const [loading, setLoading] = useState(!!exercises[0]?.id);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getExerciseProgress(selectedId).then((d) => {
      if (cancelled) return;
      setData((d ?? []).filter(Boolean) as NonNullable<DataPoint>[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const maxWeight = data.length > 0 ? Math.max(...data.map((d) => d.weight_kg)) : 0;
  const minWeight = data.length > 0 ? Math.min(...data.map((d) => d.weight_kg)) : 0;
  const range = maxWeight - minWeight || 1;

  return (
    <div className="space-y-4">
      {/* Exercise selector */}
      <select
        value={selectedId}
        onChange={(e) => {
          setLoading(true);
          setSelectedId(e.target.value);
        }}
        className="w-full px-4 py-3 rounded-xl bg-zinc-900 text-white border border-zinc-800 focus:border-blue-500 focus:outline-none text-base"
      >
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>

      {/* Chart */}
      <div className="bg-card rounded-2xl border border-border p-4">
        {loading ? (
          <p className="text-muted text-center py-8">Loading...</p>
        ) : data.length === 0 ? (
          <p className="text-muted text-center py-8">No data yet</p>
        ) : (
          <div>
            {/* Simple SVG line chart */}
            <svg
              viewBox="0 0 320 180"
              className="w-full h-44"
              preserveAspectRatio="none"
            >
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
              {[0, 0.5, 1].map((f) => (
                <text
                  key={f}
                  x="35"
                  y={24 + f * 140}
                  textAnchor="end"
                  fill="#a1a1aa"
                  fontSize="10"
                >
                  {Math.round(maxWeight - f * range)}
                </text>
              ))}

              {/* Line */}
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={data
                  .map((d, i) => {
                    const x = 40 + (i / Math.max(data.length - 1, 1)) * 270;
                    const y =
                      20 +
                      ((maxWeight - d.weight_kg) / range) * 140;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />

              {/* Dots */}
              {data.map((d, i) => {
                const x = 40 + (i / Math.max(data.length - 1, 1)) * 270;
                const y =
                  20 + ((maxWeight - d.weight_kg) / range) * 140;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#3b82f6"
                  />
                );
              })}
            </svg>

            {/* Data table */}
            <div className="scrollbar-hidden mt-4 space-y-1 max-h-48 overflow-y-auto">
              {[...data].reverse().map((d, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm py-1 border-b border-border last:border-0"
                >
                  <span className="text-muted">
                    {new Date(d.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-white font-mono">
                    {d.weight_kg}kg x {d.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

