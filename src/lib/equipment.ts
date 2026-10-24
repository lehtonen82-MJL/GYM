// Pure helpers for per-equipment history (Phase G3).
// Kept out of the "use server" action files so they can be unit-tested and shared.

/**
 * The tool an entry was actually performed with.
 * `workout_exercise_entries.equipment_type` is only set when the user picked a tool
 * explicitly; otherwise the entry used the exercise definition's default tool.
 * Returns null for unlinked exercises with no explicit tool.
 */
export function effectiveEquipment(
  entryEquipment: string | null | undefined,
  defaultEquipment: string | null | undefined
): string | null {
  return entryEquipment ?? defaultEquipment ?? null;
}

/** True when an entry's tool matches the requested tool (both resolved against the default). */
export function matchesEquipment(
  entryEquipment: string | null | undefined,
  requestedEquipment: string | null | undefined,
  defaultEquipment: string | null | undefined
): boolean {
  return (
    effectiveEquipment(entryEquipment, defaultEquipment) ===
    effectiveEquipment(requestedEquipment, defaultEquipment)
  );
}

/**
 * From entries across recent workouts, pick the one from the most recent workout
 * (by `workoutIds` order) that was done with the requested tool and passes `accept`.
 */
export function pickLatestEntryForEquipment<T extends { workout_id: string; equipment_type?: string | null }>(
  entries: T[],
  workoutIds: string[],
  requestedEquipment: string | null | undefined,
  defaultEquipment: string | null | undefined,
  accept: (entry: T) => boolean = () => true
): T | null {
  const sameTool = entries.filter((e) =>
    matchesEquipment(e.equipment_type, requestedEquipment, defaultEquipment)
  );
  for (const workoutId of workoutIds) {
    const entry = sameTool.find((e) => e.workout_id === workoutId && accept(e));
    if (entry) return entry;
  }
  return null;
}
