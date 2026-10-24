// Session volume / tonnage (Phase 5.4).

export type VolumeSet = { weight_kg: number | null; reps: number | null; completed: boolean; is_warmup?: boolean | null };

/**
 * Volume in kg: Σ weight × reps over completed work sets (see GLOSSARY.md). Planned sets
 * (not checked off, even if pre-filled), warmups and bodyweight sets add nothing.
 */
export function sessionVolume(sets: VolumeSet[]): number {
  let total = 0;
  for (const s of sets) {
    if (!s.completed || s.is_warmup) continue;
    if (!s.weight_kg || !s.reps || s.weight_kg <= 0 || s.reps <= 0) continue;
    total += s.weight_kg * s.reps;
  }
  return Math.round(total * 100) / 100;
}
