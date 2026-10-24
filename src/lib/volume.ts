// Session volume / tonnage (Phase 5.4).

type VolumeSet = { weight_kg: number | null; reps: number | null; is_warmup?: boolean | null };

/**
 * Σ weight × reps over work sets (warmups excluded) that have both weight and reps entered,
 * in kg. Matches the "sets with data" rule used for previous results: a set counts even if
 * its checkmark wasn't tapped.
 */
export function sessionVolume(sets: VolumeSet[]): number {
  let total = 0;
  for (const s of sets) {
    if (s.is_warmup) continue;
    if (!s.weight_kg || !s.reps || s.weight_kg <= 0 || s.reps <= 0) continue;
    total += s.weight_kg * s.reps;
  }
  return Math.round(total * 100) / 100;
}
