// Shared display formatters (Phase 3). Pure functions — safe in client and server code.
//
// Weights are stored and computed in kg everywhere (weight_kg columns, suggestions, PRs).
// Conversion to the user's unit happens only at the UI boundary: toDisplay() for rendering,
// fromDisplay() for input.

export type WeightUnit = "kg" | "lb";

export const KG_PER_LB = 0.45359237;

/** Stepper increment in the given unit. */
export function weightStep(unit: WeightUnit): number {
  return unit === "lb" ? 5 : 2.5;
}

/**
 * kg → display value in `unit`. lb is rounded to 0.1 so a value typed in lb survives the
 * round trip through kg (and the DB's 2-decimal numeric) unchanged.
 */
export function toDisplay(weightKg: number, unit: WeightUnit): number {
  if (unit === "kg") return weightKg;
  return Math.round((weightKg / KG_PER_LB) * 10) / 10;
}

/**
 * Display value in `unit` → kg. lb is rounded to 0.01 kg — the precision of the
 * weight_kg numeric(6,2) column — so the in-memory value equals what gets stored.
 */
export function fromDisplay(value: number, unit: WeightUnit): number {
  if (unit === "kg") return value;
  return Math.round(value * KG_PER_LB * 100) / 100;
}

function trimNumber(n: number, maxDecimals: number): string {
  return String(Number(n.toFixed(maxDecimals)));
}

/** "100 kg", "220.5 lb". `compact` drops the space: "100kg". */
export function formatWeight(
  weightKg: number,
  unit: WeightUnit,
  { compact = false, maxDecimals = 2 }: { compact?: boolean; maxDecimals?: number } = {}
): string {
  return `${trimNumber(toDisplay(weightKg, unit), maxDecimals)}${compact ? "" : " "}${unit}`;
}

/** "100kg × 5" — a set as shown in summaries and history. */
export function formatSet(weightKg: number, reps: number | string, unit: WeightUnit): string {
  return `${formatWeight(weightKg, unit, { compact: true })} × ${reps}`;
}

/** Volume (Σ weight × reps, kg) → display unit, unrounded (for charts). */
export function toDisplayVolume(volumeKg: number, unit: WeightUnit): number {
  return unit === "kg" ? volumeKg : volumeKg / KG_PER_LB;
}

/** Volume in `unit`, whole numbers: "2000 kg". */
export function formatVolume(volumeKg: number, unit: WeightUnit): string {
  return `${Math.round(toDisplayVolume(volumeKg, unit))} ${unit}`;
}

/** "Saturday, Oct 24" */
export function formatWeekdayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/** "Oct 24" */
export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Oct 24, 09:40 AM" */
export function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Workout length between two timestamps: "45m", "1h 5m"; "" while unfinished. */
export function formatDuration(start: string, end: string | null): string {
  if (!end) return "";
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Seconds as m:ss — rowing pace and duration: "1:52". */
export function formatPace(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
