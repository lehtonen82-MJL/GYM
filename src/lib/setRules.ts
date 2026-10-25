// Which sets count, and what they add up to: the set rules from GLOSSARY.md (work, warmup,
// completed and planned sets; volume, top set, previous results, suggested weight).

export type RuleSet = { weight_kg: number | null; reps: number | null; completed: boolean; is_warmup?: boolean | null };

const isCompletedWorkSet = (s: RuleSet) => s.completed && !s.is_warmup;

/**
 * Volume in kg: Σ weight × reps over completed work sets (see GLOSSARY.md). Planned sets
 * (not checked off, even if pre-filled), warmups and bodyweight sets add nothing.
 */
export function sessionVolume(sets: RuleSet[]): number {
  let total = 0;
  for (const s of sets) {
    if (!isCompletedWorkSet(s)) continue;
    if (!s.weight_kg || !s.reps || s.weight_kg <= 0 || s.reps <= 0) continue;
    total += s.weight_kg * s.reps;
  }
  return Math.round(total * 100) / 100;
}

/** The heaviest completed work set (more reps wins a tie, so bodyweight sets rank by reps). */
export function topSet(sets: RuleSet[]): { weight_kg: number; reps: number } | null {
  let top: { weight_kg: number; reps: number } | null = null;
  for (const s of sets) {
    if (!isCompletedWorkSet(s)) continue;
    const set = { weight_kg: s.weight_kg ?? 0, reps: s.reps ?? 0 };
    if (!top || set.weight_kg > top.weight_kg || (set.weight_kg === top.weight_kg && set.reps > top.reps)) top = set;
  }
  return top;
}

/**
 * Which of an exercise entry's sets make up its previous results: the completed ones, or — when
 * none was checked off (the lifter forgot to) — every set with a weight or reps entered.
 */
export function previousResultSets<T extends RuleSet>(sets: T[]): T[] {
  const withData = sets.filter((s) => s.weight_kg !== null || s.reps !== null);
  const completed = withData.filter((s) => s.completed);
  return completed.length > 0 ? completed : withData;
}

/** Progression step per equipment type, in kg; null where weight isn't what progresses. */
const PROGRESSION_STEP_KG: Record<string, number | null> = {
  barbell: 2.5,
  smith: 2.5,
  trap_bar: 2.5,
  machine_plate: 2.5,
  dumbbell: 2,
  kettlebell: 4,
  cable: 5,
  machine_stack: 5,
  bodyweight: null,
  band: null,
  suspension: null,
  cardio_machine: null,
};

/** Work sets rated above this RPE hold the suggested weight (see GLOSSARY.md "RPE"). */
const MAX_RPE_TO_PROGRESS = 9.5;

/** The progression step for an equipment type (unknown or unlinked: 2.5 kg). */
export function progressionStep(equipment: string | null): number | null {
  return equipment != null && equipment in PROGRESSION_STEP_KG ? PROGRESSION_STEP_KG[equipment] : 2.5;
}

export type SuggestionTarget = {
  targetSets: number;
  /** Reps each work set should reach; null when unknown (then only the set count matters) */
  targetReps: number | null;
  /** The exercise's equipment type (entry's tool, else the library default) */
  equipment: string | null;
  /** Easy Week: the suggestion never goes up */
  easyWeek?: boolean;
};

/**
 * Suggested weight from previous results (see GLOSSARY.md): the heaviest work set's weight, one
 * progression step down after a too-heavy set, one step up when at least `targetSets` work sets were
 * done and each reached the target reps, otherwise the same. Warmups never count. Null without
 * previous work sets, or for equipment without a progression step. A work set rated RPE 9.5+ holds.
 */
export function suggestedWeight(
  previous: { weight_kg: number | null; reps?: number | null; is_warmup?: boolean | null; too_heavy?: boolean | null; rpe?: number | null }[],
  target: SuggestionTarget
): number | null {
  const step = progressionStep(target.equipment);
  const workSets = previous.filter((s) => !s.is_warmup);
  if (step === null || workSets.length === 0) return null;
  const top = Math.max(...workSets.map((s) => s.weight_kg ?? 0));
  if (workSets.some((s) => s.too_heavy)) return Math.max(0, top - step);
  const allTargetsMet =
    workSets.length >= target.targetSets &&
    (target.targetReps == null || workSets.every((s) => (s.reps ?? 0) >= target.targetReps!));
  // A set rated RPE 9.5–10 was at (or near) the limit: no room to add weight yet
  const atLimit = workSets.some((s) => (s.rpe ?? 0) >= MAX_RPE_TO_PROGRESS);
  return allTargetsMet && !atLimit && !target.easyWeek ? top + step : top;
}

/** Top set, volume and number of completed work sets — one exercise's line in progress and export. */
export function exerciseSummary(sets: RuleSet[]): {
  top: { weight_kg: number; reps: number } | null;
  volume: number;
  workSets: number;
} {
  return { top: topSet(sets), volume: sessionVolume(sets), workSets: sets.filter(isCompletedWorkSet).length };
}
