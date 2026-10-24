// Pure helpers for per-equipment history (Phase G3/G7).
// Kept out of the "use server" action files so they can be unit-tested and shared.

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine_plate: "Machine (plate)",
  machine_stack: "Machine (stack)",
  smith: "Smith Machine",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  trap_bar: "Trap Bar",
  band: "Band",
  suspension: "TRX",
  cardio_machine: "Cardio Machine",
  other: "Other",
};

export const EQUIPMENT_ORDER = [
  "barbell", "dumbbell", "cable", "machine_plate", "machine_stack",
  "smith", "bodyweight", "kettlebell", "trap_bar", "band", "suspension",
  "cardio_machine", "other",
];

/** Display label for a tool; null = unlinked exercise with no tool recorded. */
export function equipmentLabel(equipment: string | null): string {
  if (equipment === null) return "Unspecified";
  return EQUIPMENT_LABELS[equipment] ?? equipment;
}

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

export type EquipmentUsage = { equipment_type: string | null; label: string; last_used: string };

/**
 * Distinct tools an exercise was performed with, most recently used first.
 * Untagged entries count as the definition's default tool.
 */
export function summarizeEquipmentUsage(
  entries: { equipment_type: string | null; started_at: string }[],
  defaultEquipment: string | null | undefined
): EquipmentUsage[] {
  const lastUsed = new Map<string | null, string>();
  for (const e of entries) {
    const eq = effectiveEquipment(e.equipment_type, defaultEquipment);
    const prev = lastUsed.get(eq);
    if (!prev || e.started_at > prev) lastUsed.set(eq, e.started_at);
  }
  return Array.from(lastUsed, ([equipment_type, last_used]) => ({
    equipment_type,
    label: equipmentLabel(equipment_type),
    last_used,
  })).sort((a, b) => b.last_used.localeCompare(a.last_used));
}
