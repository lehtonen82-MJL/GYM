"use client";

import { useState, useEffect, useRef } from "react";
import {
  getExerciseEquipmentUsage,
  getExerciseProgress,
  getExercisePRs,
  getRowingHistory,
  type RowingDataPoint,
} from "@/lib/actions";
import type { EquipmentUsage } from "@/lib/equipment";
import {
  formatPace,
  formatSet,
  formatShortDate,
  formatVolume,
  formatWeight,
  toDisplay,
  toDisplayVolume,
} from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { ExercisePR } from "@/lib/types";
import MusclesTab from "./MusclesTab";
import BodyTab from "./BodyTab";
import MiniChart from "./MiniChart";

type Exercise = { id: string; name: string };
type DataPoint = { date: string; weight_kg: number; reps: number; sets: number; volume: number };
type Tab = "lifting" | "rowing" | "muscles" | "body";

/** Progress + PRs for one exercise, scoped to one tool (undefined = the exercise's default tool). */
async function fetchLifting(
  exerciseId: string,
  equipment: string | null | undefined
): Promise<[DataPoint[], ExercisePR[]]> {
  const [progressData, prData] = await Promise.all([
    getExerciseProgress(exerciseId, equipment),
    getExercisePRs(exerciseId, equipment),
  ]);
  return [(progressData ?? []).filter(Boolean) as DataPoint[], prData];
}



export default function ProgressClient({
  exercises,
}: {
  exercises: Exercise[];
}) {
  const [tab, setTab] = useState<Tab>("lifting");
  const { unit } = useSettings();

  // Lifting state
  const [selectedId, setSelectedId] = useState(exercises[0]?.id ?? "");
  const [data, setData] = useState<DataPoint[]>([]);
  const [liftingLoading, setLiftingLoading] = useState(!!exercises[0]?.id);
  const [prs, setPRs] = useState<ExercisePR[]>([]);
  // Tools this exercise was done with; history and PRs are tracked per tool
  const [equipmentUsage, setEquipmentUsage] = useState<EquipmentUsage[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null | undefined>(undefined);
  // Latest lifting request wins (exercise change vs. tool tap)
  const liftingRequest = useRef(0);

  // Rowing state
  const [rowingData, setRowingData] = useState<RowingDataPoint[]>([]);
  const [rowingFetched, setRowingFetched] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    // Loading state and cleared PRs are set where selectedId changes (the select's onChange)
    const request = ++liftingRequest.current;
    getExerciseEquipmentUsage(selectedId)
      .then((usage) => {
        if (cancelled || request !== liftingRequest.current) return;
        setEquipmentUsage(usage);
        // Start on the most recently used tool
        const equipment = usage[0]?.equipment_type ?? undefined;
        setSelectedEquipment(equipment);
        return fetchLifting(selectedId, equipment).then(([progressData, prData]) => {
          if (cancelled || request !== liftingRequest.current) return;
          setData(progressData);
          setPRs(prData);
          setLiftingLoading(false);
        });
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  async function handleSelectEquipment(equipment: string | null) {
    if (equipment === selectedEquipment) return;
    const request = ++liftingRequest.current;
    setSelectedEquipment(equipment);
    setLiftingLoading(true);
    const [progressData, prData] = await fetchLifting(selectedId, equipment);
    if (request !== liftingRequest.current) return;
    setData(progressData);
    setPRs(prData);
    setLiftingLoading(false);
  }

  useEffect(() => {
    if (tab !== "rowing" || rowingFetched) return;
    let cancelled = false;
    getRowingHistory()
      .then((d) => {
        if (cancelled) return;
        setRowingData(d ?? []);
        setRowingFetched(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[ProgressClient] getRowingHistory error:", err);
        setRowingFetched(true);
      });
    return () => { cancelled = true; };
  }, [tab, rowingFetched]);

  const rowingLoading = tab === "rowing" && !rowingFetched;
  const hasVolume = data.some((d) => d.volume > 0);
  // Bodyweight exercise: all data points have weight_kg = 0 (no weight entered)
  const isBodyweight = data.length > 0 && data.every((d) => d.weight_kg === 0);

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex rounded-xl bg-card border border-border p-1 gap-1">
        {(["lifting", "muscles", "body", "rowing"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? "bg-surface-hover text-white" : "text-muted active:text-soft"
            }`}
          >
            {{ lifting: "Lifting", muscles: "Muscles", body: "Body", rowing: "Rowing" }[t]}
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
              setPRs([]);
              setSelectedId(e.target.value);
            }}
            className="w-full px-4 py-3 rounded-xl bg-card text-white border border-border focus:border-accent focus:outline-none text-base"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          {equipmentUsage.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment">
              {equipmentUsage.map((u) => (
                <button
                  key={u.equipment_type ?? "none"}
                  type="button"
                  onClick={() => handleSelectEquipment(u.equipment_type)}
                  aria-pressed={u.equipment_type === selectedEquipment}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    u.equipment_type === selectedEquipment
                      ? "bg-accent border-accent text-on-accent"
                      : "bg-card border-border text-muted active:text-soft"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          )}

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
              {/* PR summary strip */}
              {prs.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {(["max_weight", "1rm_estimate", "max_volume"] as const).map((type) => {
                    const pr = prs.find((p) => p.pr_type === type);
                    if (!pr) return null;
                    const labels = { max_weight: "Best Set", "1rm_estimate": "Est. 1RM", max_volume: "Best Vol" };
                    const formatted =
                      type === "max_volume"
                        ? formatVolume(pr.value, unit)
                        : formatWeight(pr.value, unit, { maxDecimals: 1 });
                    return (
                      <div key={type} className="bg-card border border-border rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted uppercase tracking-wide">{labels[type]}</p>
                        <p className="text-white font-bold text-base mt-0.5">{formatted}</p>
                        <p className="text-[10px] text-subtle mt-0.5">
                          {formatShortDate(pr.achieved_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold text-muted mb-2">
                  {isBodyweight ? "Top Set (reps)" : "Top Set"}
                </p>
                <MiniChart
                  data={data}
                  getValue={(d) => isBodyweight ? (d as DataPoint).reps : toDisplay((d as DataPoint).weight_kg, unit)}
                  color="#c6f432"
                  unit={isBodyweight ? "" : ""}
                  formatLabel={isBodyweight ? (v) => `${Math.round(v)} reps` : undefined}
                />
              </div>

              {hasVolume && !isBodyweight && (
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-sm font-semibold text-muted mb-2">Total Volume</p>
                  <MiniChart
                    data={data}
                    getValue={(d) => toDisplayVolume((d as DataPoint).volume, unit)}
                    color="#c6f432"
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
                        {formatShortDate(d.date)}
                      </span>
                      <span className="text-white font-mono">
                        {isBodyweight
                          ? `× ${d.reps} reps`
                          : formatSet(d.weight_kg, d.reps, unit)}
                        {d.sets > 0 && <span className="text-muted ml-2">· {d.sets} sets</span>}
                        {d.volume > 0 && (
                          <span className="text-muted ml-2">· {formatVolume(d.volume, unit)} vol</span>
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

      {/* ── MUSCLES TAB ── */}
      {tab === "muscles" && <MusclesTab />}

      {/* ── BODY TAB ── */}
      {tab === "body" && <BodyTab />}

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
                <p className="text-xs text-muted mb-2">Lower is faster ↓</p>
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
                        {formatShortDate(d.date)}
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
                          <span className="text-muted ml-2">{d.duration_seconds ? formatPace(d.duration_seconds) : "-"}</span>
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
