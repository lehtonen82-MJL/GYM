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

/**
 * Suggested weight from previous results: the heaviest work set's weight, +2.5 kg once at least
 * `targetSets` work sets were done. Warmup sets never count. Null without previous work sets.
 */
export function suggestedWeight(
  previous: { weight_kg: number | null; is_warmup?: boolean | null }[],
  targetSets: number
): number | null {
  const workSets = previous.filter((s) => !s.is_warmup);
  if (workSets.length === 0) return null;
  const maxWeight = Math.max(...workSets.map((s) => s.weight_kg ?? 0));
  return workSets.length >= targetSets ? maxWeight + 2.5 : maxWeight;
}

/** Top set, volume and number of completed work sets — one exercise's line in progress and export. */
export function exerciseSummary(sets: RuleSet[]): {
  top: { weight_kg: number; reps: number } | null;
  volume: number;
  workSets: number;
} {
  return { top: topSet(sets), volume: sessionVolume(sets), workSets: sets.filter(isCompletedWorkSet).length };
}
