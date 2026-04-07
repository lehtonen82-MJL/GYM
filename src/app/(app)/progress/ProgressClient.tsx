"use client";

import { useState, useEffect } from "react";
import { getExerciseProgress, getRowingHistory, type RowingDataPoint } from "@/lib/actions";

type Exercise = { id: string; name: string };
type DataPoint = { date: string; weight_kg: number; reps: number; sets: number; volume: number };
type Tab = "lifting" | "rowing";

function formatPace(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "-";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MiniChart({
  data,
  getValue,
  color,
  unit,
  inverted,
  formatLabel,
}: {
  data: { date: string }[];
  getValue: (d: { date: string }) => number;
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

export default function ProgressClient({
  exercises,
}: {
  exercises: Exercise[];
}) {
  const [tab, setTab] = useState<Tab>("lifting");

  // Lifting state
  const [selectedId, setSelectedId] = useState(exercises[0]?.id ?? "");
  const [data, setData] = useState<DataPoint[]>([]);
  const [liftingLoading, setLiftingLoading] = useState(!!exercises[0]?.id);

  // Rowing state
  const [rowingData, setRowingData] = useState<RowingDataPoint[]>([]);
  const [rowingLoading, setRowingLoading] = useState(false);
  const [rowingFetched, setRowingFetched] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLiftingLoading(true);
    getExerciseProgress(selectedId).then((d) => {
      if (cancelled) return;
      setData((d ?? []).filter(Boolean) as DataPoint[]);
      setLiftingLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (tab !== "rowing" || rowingFetched) return;
    let cancelled = false;
    setRowingLoading(true);
    getRowingHistory().then((d) => {
      if (cancelled) return;
      setRowingData(d ?? []);
      setRowingLoading(false);
      setRowingFetched(true);
    });
    return () => { cancelled = true; };
  }, [tab, rowingFetched]);

  const hasVolume = data.some((d) => d.volume > 0);

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 gap-1">
        {(["lifting", "rowing"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 active:text-zinc-300"
            }`}
          >
            {t === "lifting" ? "Lifting" : "Rowing"}
          </button>
        ))}
      </div>

      {/* ── LIFTING TAB ── */}
      {tab === "lifting" && (
        <>
          <select
            value={selectedId}
            onChange={(e) => {
              setLiftingLoading(true);
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

          {liftingLoading ? (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-muted text-center py-8">Loading...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-muted text-center py-8">No data yet</p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold text-muted mb-2">Top Set</p>
                <MiniChart
                  data={data}
                  getValue={(d) => (d as DataPoint).weight_kg}
                  color="#3b82f6"
                  unit=""
                />
              </div>

              {hasVolume && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-sm font-semibold text-muted mb-2">Total Volume</p>
                  <MiniChart
                    data={data}
                    getValue={(d) => (d as DataPoint).volume}
                    color="#22c55e"
                    unit=""
                  />
                </div>
              )}

              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="scrollbar-hidden space-y-1 max-h-48 overflow-y-auto">
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
                        {d.weight_kg}kg × {d.reps}
                        {d.sets > 0 && <span className="text-muted ml-2">· {d.sets} sets</span>}
                        {d.volume > 0 && (
                          <span className="text-muted ml-2">· {Math.round(d.volume)}kg vol</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── ROWING TAB ── */}
      {tab === "rowing" && (
        <>
          {rowingLoading ? (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-muted text-center py-8">Loading...</p>
            </div>
          ) : rowingData.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-muted text-center py-8">No rowing sessions yet</p>
            </div>
          ) : (
            <>
              {/* Avg 500m pace chart — inverted: lower = faster = higher on chart */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold text-muted mb-1">Avg 500m Pace</p>
                <p className="text-xs text-zinc-500 mb-2">Lower is faster ↓</p>
                <MiniChart
                  data={rowingData}
                  getValue={(d) => (d as RowingDataPoint).pace_per_500_seconds}
                  color="#f59e0b"
                  unit=""
                  inverted
                  formatLabel={(v) => formatPace(v)}
                />
              </div>

              {/* Session table */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="scrollbar-hidden space-y-1 max-h-64 overflow-y-auto">
                  {[...rowingData].reverse().map((d, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-muted shrink-0">
                        {new Date(d.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="text-right font-mono">
                        <span className="text-amber-400 font-semibold">
                          {formatPace(d.pace_per_500_seconds)}/500m
                        </span>
                        {d.distance_m != null && (
                          <span className="text-muted ml-2">
                            {d.distance_m >= 1000
                              ? `${(d.distance_m / 1000).toFixed(1)}km`
                              : `${d.distance_m}m`}
                          </span>
                        )}
                        {d.duration_seconds != null && (
                          <span className="text-muted ml-2">{formatDuration(d.duration_seconds)}</span>
                        )}
                        {d.calories != null && (
                          <span className="text-muted ml-2">{d.calories}cal</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

