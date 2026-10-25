// Planned set generation: the sets a new workout starts with for one exercise (see GLOSSARY.md).

import type { PrescribedSet } from "@/lib/programParser";
import { progressionStep } from "@/lib/setRules";

export type PlannedSet = { set_number: number; weight_kg: number | null; reps: number | null; is_warmup: boolean };

export type PlanInput = {
  /** Sets prescribed by the program's scheme text (may be empty) */
  prescription: PrescribedSet[];
  /** Program target when there is no prescription */
  targetSets: number;
  /** Previous results for this exercise */
  previous: { weight_kg: number | null; reps: number | null; is_warmup: boolean; too_heavy: boolean }[];
  /** Easy Week: work sets (and optionally warmups) cut to setPct %, every weight to weightPct % */
  deload?: { weightPct: number; setPct: number; reduceWarmups: boolean };
  /** Warmups to plan when the previous results have none (see warmupKind) */
  warmup?: WarmupPlan | null;
};

/** pct % of `kg`, rounded to the nearest 2.5 kg. */
const deloadWeight = (kg: number | null, pct: number) => (kg == null ? null : Math.round((kg * pct) / 100 / 2.5) * 2.5);

export type WarmupKind = "olympic" | "main" | "compound" | "isolation" | "bodyweight";

/** How to warm up an exercise (see GLOSSARY.md "Warmup ramp"). */
export type WarmupPlan = {
  kind: WarmupKind;
  /** Equipment type, for rounding to its progression step */
  equipment: string | null;
  /** The primary muscle was already trained earlier in this workout: fewer warmups */
  muscleWarm?: boolean;
};

/** Warmup sets as share of the first work set's weight × reps, per kind (cold muscle / warm muscle). */
const WARMUP_STEPS: Record<Exclude<WarmupKind, "bodyweight">, { cold: [number, number][]; warm: [number, number][] }> = {
  olympic: { cold: [[50, 3], [70, 2], [85, 1]], warm: [[50, 3], [70, 2], [85, 1]] },
  main: { cold: [[50, 5], [70, 3], [85, 1]], warm: [[60, 3], [80, 1]] },
  compound: { cold: [[50, 6], [75, 3]], warm: [[70, 4]] },
  isolation: { cold: [[50, 10]], warm: [] },
};
const EMPTY_BAR_KG = 20;
const BAR_EQUIPMENT = ["barbell", "trap_bar", "smith"];

/**
 * Which warmups an exercise gets, from its library definition (unlinked exercises count as
 * accessories). Null: no warmups (core, cardio, bodyweight work other than pulls/pushes).
 */
export function warmupKind(
  info: { movementPattern: string | null; isMainLift: boolean; isBodyweight: boolean; equipment: string | null } | undefined
): WarmupKind | null {
  if (!info) return "isolation";
  const { movementPattern: pattern, isMainLift, isBodyweight, equipment } = info;
  if (pattern === "olympic") return "olympic";
  if (isBodyweight || equipment === "bodyweight" || equipment === "band" || equipment === "suspension") {
    return pattern === "vertical_pull" || pattern === "horizontal_pull" || pattern === "vertical_push" ? "bodyweight" : null;
  }
  if (pattern === "cardio" || pattern === "core") return pattern === "core" && equipment !== "bodyweight" ? "isolation" : null;
  if (isMainLift && equipment !== null && BAR_EQUIPMENT.includes(equipment)) return "main";
  if (pattern === "isolation" || pattern === "carry") return "isolation";
  return "compound";
}

type LibraryInfo = Parameters<typeof warmupKind>[0] extends infer T ? (T & { primaryMuscle?: string | null }) | undefined : never;

/**
 * Warmup plans for a workout's exercises in order: each exercise's kind, and whether its primary
 * muscle was already trained by an earlier exercise of the workout.
 */
export function warmupPlans(exercises: LibraryInfo[]): (WarmupPlan | null)[] {
  const trained = new Set<string>();
  return exercises.map((info) => {
    const kind = warmupKind(info);
    const muscle = info?.primaryMuscle ?? null;
    const plan = kind && { kind, equipment: info?.equipment ?? null, muscleWarm: muscle !== null && trained.has(muscle) };
    if (muscle) trained.add(muscle);
    return plan;
  });
}

/** Warmup sets before a first work set of `workKg` × `workReps`. */
function warmupSets(plan: WarmupPlan, workKg: number | null, workReps: number | null): { weight_kg: number | null; reps: number }[] {
  if (plan.kind === "bodyweight") {
    return workReps ? [{ weight_kg: null, reps: Math.max(1, Math.ceil(workReps / 2)) }] : [];
  }
  if (workKg == null || workKg <= 0) return [];
  const bar = plan.equipment !== null && BAR_EQUIPMENT.includes(plan.equipment);
  const step = progressionStep(plan.equipment) ?? 2.5;
  if (!bar && workKg < 2 * step) return [];
  const steps = WARMUP_STEPS[plan.kind][plan.muscleWarm ? "warm" : "cold"];
  const sets: { weight_kg: number; reps: number }[] = [];
  for (const [pct, reps] of steps) {
    const weight_kg = Math.round((workKg * pct) / 100 / step) * step;
    if ((bar && weight_kg < EMPTY_BAR_KG) || weight_kg <= 0 || weight_kg >= workKg) continue;
    if (sets.some((w) => w.weight_kg === weight_kg)) continue;
    sets.push({ weight_kg, reps });
  }
  return sets;
}

/**
 * The planned sets for one exercise in a new workout: the previous results' warmup sets first, then
 * as many work sets as prescribed (or the target) — the program decides the count, not last time.
 * Work sets are straight sets at last time's heaviest work set (a weight in the scheme wins); reps
 * come from the prescription, else the matching previous work set (sets beyond last time's repeat
 * its last one), left empty after a too-heavy work set (a too-heavy warmup keeps its reps). An Easy Week (`deload`) cuts the counts (rounded up, at least one work set) and
 * every weight. With a `warmup` plan and no previous warmups, warmups for the exercise's kind go first.
 */
export function planSets({ prescription, targetSets, previous, deload, warmup }: PlanInput): PlannedSet[] {
  const prevWarmups = previous.filter((s) => s.is_warmup);
  const prevWorkSets = previous.filter((s) => !s.is_warmup);
  let workSetCount = prescription.length > 0 ? prescription.length : targetSets;
  let warmupCount = prevWarmups.length;
  if (deload) {
    workSetCount = Math.max(1, Math.ceil((workSetCount * deload.setPct) / 100));
    if (deload.reduceWarmups) warmupCount = Math.ceil((warmupCount * deload.setPct) / 100);
  }
  const weight = (kg: number | null) => (deload ? deloadWeight(kg, deload.weightPct) : kg);
  // Straight sets: every work set at last time's heaviest work set (unless the scheme gives a weight)
  const prevWorkWeights = prevWorkSets.map((s) => s.weight_kg).filter((kg): kg is number => kg != null);
  const workKg = prevWorkWeights.length > 0 ? Math.max(...prevWorkWeights) : null;

  const planned: PlannedSet[] = [];
  for (const prev of prevWarmups.slice(0, warmupCount)) {
    planned.push({ set_number: planned.length + 1, weight_kg: weight(prev.weight_kg), reps: prev.reps, is_warmup: true });
  }
  if (warmup && prevWarmups.length === 0) {
    const firstWorkKg = prescription[0]?.weightKg ?? workKg;
    const firstWorkReps = prescription[0]?.reps ?? prevWorkSets[0]?.reps ?? null;
    for (const w of warmupSets(warmup, weight(firstWorkKg), firstWorkReps)) {
      planned.push({ set_number: planned.length + 1, weight_kg: w.weight_kg, reps: w.reps, is_warmup: true });
    }
  }
  for (let j = 0; j < workSetCount; j++) {
    // Sets beyond last time's repeat the last previous work set
    const prev = prevWorkSets[j] ?? prevWorkSets[prevWorkSets.length - 1];
    planned.push({
      set_number: planned.length + 1,
      weight_kg: weight(prescription[j]?.weightKg ?? workKg),
      reps: prescription[j]?.reps ?? (prev && !prev.too_heavy ? prev.reps : null),
      is_warmup: false,
    });
  }
  return planned;
}
