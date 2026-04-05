"use client";

import { useMemo, useState } from "react";
import type { WorkoutBonusCardio } from "@/lib/types";

export type BonusCardioDraft = {
  machine_type: "rower";
  distance_m: number | null;
  duration_seconds: number | null;
  pace_per_500_seconds: number | null;
  calories: number | null;
  stroke_rate: number | null;
  avg_watts: number | null;
  extra_metrics: Record<string, number | null>;
};

type Props = {
  value: BonusCardioDraft;
  onChange: (next: BonusCardioDraft) => void;
  readOnly?: boolean;
  saved?: WorkoutBonusCardio | null;
};

const REQUIRED_LABELS = {
  distance_m: "Distance (m)",
  duration_seconds: "Time (mm:ss)",
  avg_pace_per_500_seconds: "Avg pace/500m",
} as const;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasRequiredManualRowData(v: BonusCardioDraft): boolean {
  return (
    isFiniteNumber(v.distance_m) &&
    isFiniteNumber(v.duration_seconds) &&
    isFiniteNumber(v.extra_metrics?.avg_pace_per_500_seconds)
  );
}

function getMissingRequiredManualFields(v: BonusCardioDraft): string[] {
  const missing: string[] = [];
  if (!isFiniteNumber(v.distance_m)) missing.push(REQUIRED_LABELS.distance_m);
  if (!isFiniteNumber(v.duration_seconds)) missing.push(REQUIRED_LABELS.duration_seconds);
  if (!isFiniteNumber(v.extra_metrics?.avg_pace_per_500_seconds)) {
    missing.push(REQUIRED_LABELS.avg_pace_per_500_seconds);
  }
  return missing;
}

export function createEmptyBonusCardio(): BonusCardioDraft {
  return {
    machine_type: "rower",
    distance_m: null,
    duration_seconds: null,
    pace_per_500_seconds: null,
    calories: null,
    stroke_rate: null,
    avg_watts: null,
    extra_metrics: {},
  };
}

export function hasBonusCardioData(v: BonusCardioDraft): boolean {
  return [
    v.distance_m,
    v.duration_seconds,
    v.pace_per_500_seconds,
    v.calories,
    v.stroke_rate,
    v.avg_watts,
    ...Object.values(v.extra_metrics ?? {}),
  ].some((x) => isFiniteNumber(x));
}

export default function BonusCardioCapture({
  value,
  onChange,
  readOnly = false,
  saved,
}: Props) {
  const source = useMemo(
    () =>
      saved
        ? {
            machine_type: "rower" as const,
            distance_m: saved.distance_m,
            duration_seconds: saved.duration_seconds,
            pace_per_500_seconds: saved.pace_per_500_seconds,
            calories: saved.calories,
            stroke_rate: saved.stroke_rate,
            avg_watts: saved.avg_watts,
            extra_metrics: saved.extra_metrics ?? {},
          }
        : value,
    [saved, value]
  );

  const summary = useMemo(() => {
    if (!hasBonusCardioData(source)) return "No bonus cardio data yet";
    return [
      source.distance_m ? `${source.distance_m}m` : null,
      source.duration_seconds ? `Time ${formatSeconds(source.duration_seconds)}` : null,
      source.extra_metrics.avg_pace_per_500_seconds
        ? `Avg pace ${formatSeconds(source.extra_metrics.avg_pace_per_500_seconds)}/500m`
        : null,
      source.pace_per_500_seconds
        ? `Pace ${formatSeconds(source.pace_per_500_seconds)}/500m`
        : null,
      source.stroke_rate ? `${source.stroke_rate} spm` : null,
      source.calories ? `${source.calories} cal` : null,
      source.avg_watts ? `${source.avg_watts} W` : null,
    ]
      .filter(Boolean)
      .join(" - ");
  }, [source]);

  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [editingAvgPace, setEditingAvgPace] = useState<string | null>(null);
  const [editingPace, setEditingPace] = useState<string | null>(null);

  const timeInput =
    editingTime ??
    (value.duration_seconds != null ? formatSecondsForInput(value.duration_seconds) : "");
  const avgPaceInput =
    editingAvgPace ??
    (value.extra_metrics.avg_pace_per_500_seconds != null
      ? formatSecondsForInput(value.extra_metrics.avg_pace_per_500_seconds)
      : "");
  const paceInput =
    editingPace ??
    (value.pace_per_500_seconds != null ? formatSecondsForInput(value.pace_per_500_seconds) : "");

  function updateNumber<K extends keyof BonusCardioDraft>(key: K, raw: string) {
    const n = raw.trim() === "" ? null : Number(raw);
    onChange({
      ...value,
      [key]: isFiniteNumber(n) ? n : null,
    });
  }

  function updateDuration<K extends keyof BonusCardioDraft>(key: K, raw: string) {
    const sec = parseTimeToSeconds(raw);
    onChange({
      ...value,
      [key]: sec,
    });
  }

  function updateExtraDuration(key: string, raw: string) {
    const sec = parseTimeToSeconds(raw);
    onChange({
      ...value,
      extra_metrics: {
        ...(value.extra_metrics ?? {}),
        [key]: sec,
      },
    });
  }

  function handleTimeInputChange(raw: string) {
    setEditingTime(raw);
    updateDuration("duration_seconds", raw);
  }

  function handleAvgPaceInputChange(raw: string) {
    setEditingAvgPace(raw);
    updateExtraDuration("avg_pace_per_500_seconds", raw);
  }

  function handlePaceInputChange(raw: string) {
    setEditingPace(raw);
    updateDuration("pace_per_500_seconds", raw);
  }

  function normalizeTimeInput() {
    const raw = editingTime ?? "";
    const parsed = parseTimeToSeconds(raw);
    if (parsed != null || raw.trim() === "") {
      setEditingTime(null);
    }
  }

  function normalizeAvgPaceInput() {
    const raw = editingAvgPace ?? "";
    const parsed = parseTimeToSeconds(raw);
    if (parsed != null || raw.trim() === "") {
      setEditingAvgPace(null);
    }
  }

  function normalizePaceInput() {
    const raw = editingPace ?? "";
    const parsed = parseTimeToSeconds(raw);
    if (parsed != null || raw.trim() === "") {
      setEditingPace(null);
    }
  }

  const missingRequired = getMissingRequiredManualFields(value);
  const hasPartialRequired =
    !hasRequiredManualRowData(value) &&
    [
      value.distance_m,
      value.duration_seconds,
      value.extra_metrics?.avg_pace_per_500_seconds,
    ].some((x) => isFiniteNumber(x));

  const detectedExtras = Object.entries(source.extra_metrics ?? {}).filter(
    ([, v]) => isFiniteNumber(v)
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-white font-semibold">Bonus Cardio (Rower)</h3>
        <p className="text-xs text-muted mt-1">{summary}</p>
      </div>

      {!readOnly && (
        <>
          <div className="rounded border border-border bg-zinc-900 p-2">
            <p className="text-xs text-zinc-200">Manual input only</p>
            <p className="text-[11px] text-muted mt-1">
              Required for row entry: Distance, Time, Avg pace/500m.
            </p>
          </div>

          {hasPartialRequired && (
            <p className="text-xs text-amber-300">
              Missing required fields: {missingRequired.join(", ")}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Distance (m) *
              <input
                type="number"
                inputMode="numeric"
                value={value.distance_m ?? ""}
                onChange={(e) => updateNumber("distance_m", e.target.value)}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
            <label className="text-xs text-muted">
              Time (mm:ss) *
              <input
                type="text"
                value={timeInput}
                onChange={(e) => handleTimeInputChange(e.target.value)}
                onBlur={normalizeTimeInput}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
            <label className="text-xs text-muted">
              Avg pace/500m (mm:ss) *
              <input
                type="text"
                value={avgPaceInput}
                onChange={(e) => handleAvgPaceInputChange(e.target.value)}
                onBlur={normalizeAvgPaceInput}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
            <label className="text-xs text-muted">
              Pace/500m (optional)
              <input
                type="text"
                value={paceInput}
                onChange={(e) => handlePaceInputChange(e.target.value)}
                onBlur={normalizePaceInput}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
            <label className="text-xs text-muted">
              Stroke rate (spm)
              <input
                type="number"
                inputMode="numeric"
                value={value.stroke_rate ?? ""}
                onChange={(e) => updateNumber("stroke_rate", e.target.value)}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
            <label className="text-xs text-muted">
              Calories
              <input
                type="number"
                inputMode="numeric"
                value={value.calories ?? ""}
                onChange={(e) => updateNumber("calories", e.target.value)}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
            <label className="text-xs text-muted">
              Avg watts
              <input
                type="number"
                inputMode="numeric"
                value={value.avg_watts ?? ""}
                onChange={(e) => updateNumber("avg_watts", e.target.value)}
                className="mt-1 w-full rounded border border-border bg-zinc-900 px-2 py-1 text-white"
              />
            </label>
          </div>
        </>
      )}

      {detectedExtras.length > 0 && (
        <div className="rounded border border-border bg-zinc-900 p-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Extra metrics</p>
          <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-zinc-200">
            {detectedExtras.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-muted">{k}</span>
                <span>{formatExtraValue(k, v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatExtraValue(key: string, value: number | null): string {
  if (!isFiniteNumber(value)) return "-";
  if (key.includes("duration") || key.includes("pace")) return formatSeconds(value);
  if (key.includes("distance") || key === "split_meters") return `${Math.round(value)}`;
  return String(Math.round(value * 10) / 10);
}

function parseTimeToSeconds(raw: string): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const mmss = text.match(/^(\d{1,3}):(\d{1,2})(?:\.(\d))?$/);
  if (mmss) {
    const mins = Number(mmss[1]);
    const secs = Number(mmss[2]);
    const tenth = mmss[3] ? Number(mmss[3]) / 10 : 0;
    if (Number.isFinite(mins) && Number.isFinite(secs) && secs >= 0 && secs < 60) {
      return mins * 60 + secs + tenth;
    }
    return null;
  }

  const compact = text.match(/^(\d{3,4})$/);
  if (compact) {
    const digits = compact[1];
    const mins = Number(digits.slice(0, digits.length - 2));
    const secs = Number(digits.slice(-2));
    if (Number.isFinite(mins) && Number.isFinite(secs) && secs >= 0 && secs < 60) {
      return mins * 60 + secs;
    }
    return null;
  }

  const plain = Number(text);
  return Number.isFinite(plain) && plain >= 0 ? plain : null;
}

function formatSeconds(total: number): string {
  if (!Number.isFinite(total)) return "";
  const safe = Math.max(0, total);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

function formatSecondsForInput(total: number): string {
  if (!Number.isFinite(total)) return "";
  const safe = Math.max(0, total);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  const nearestSecond = Math.round(secs);
  const isWholeSecond = Math.abs(secs - nearestSecond) < 0.05;
  if (isWholeSecond) {
    return `${mins}:${String(nearestSecond).padStart(2, "0")}`;
  }
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}
