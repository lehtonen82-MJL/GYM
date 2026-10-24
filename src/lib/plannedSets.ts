// Planned set generation: the sets a new workout starts with for one exercise (see GLOSSARY.md).

import type { PrescribedSet } from "@/lib/programParser";

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
};

/** pct % of `kg`, rounded to the nearest 2.5 kg. */
const deloadWeight = (kg: number | null, pct: number) => (kg == null ? null : Math.round((kg * pct) / 100 / 2.5) * 2.5);

/**
 * The planned sets for one exercise in a new workout: the previous results' warmup sets first, then
 * work sets — as many as prescribed (or the target), but never fewer than were done last time.
 * Work sets take the prescription's weight/reps, else the previous set's; reps stay empty after a
 * too-heavy work set (a too-heavy warmup keeps its reps). An Easy Week (`deload`) cuts the counts
 * (rounded up, at least one work set) and every weight.
 */
export function planSets({ prescription, targetSets, previous, deload }: PlanInput): PlannedSet[] {
  const prevWarmups = previous.filter((s) => s.is_warmup);
  const prevWorkSets = previous.filter((s) => !s.is_warmup);
  let workSetCount = Math.max(prescription.length > 0 ? prescription.length : targetSets, prevWorkSets.length);
  let warmupCount = prevWarmups.length;
  if (deload) {
    workSetCount = Math.max(1, Math.ceil((workSetCount * deload.setPct) / 100));
    if (deload.reduceWarmups) warmupCount = Math.ceil((warmupCount * deload.setPct) / 100);
  }
  const weight = (kg: number | null) => (deload ? deloadWeight(kg, deload.weightPct) : kg);

  const planned: PlannedSet[] = [];
  for (const prev of prevWarmups.slice(0, warmupCount)) {
    planned.push({ set_number: planned.length + 1, weight_kg: weight(prev.weight_kg), reps: prev.reps, is_warmup: true });
  }
  for (let j = 0; j < workSetCount; j++) {
    const prev = prevWorkSets[j];
    planned.push({
      set_number: planned.length + 1,
      weight_kg: weight(prescription[j]?.weightKg ?? prev?.weight_kg ?? null),
      reps: prescription[j]?.reps ?? (prev && !prev.too_heavy ? prev.reps : null),
      is_warmup: false,
    });
  }
  return planned;
}
