"use server";

import { db, getDefaultEquipment, getUserId } from "./_shared";
import { pickLatestEntryForEquipment } from "@/lib/equipment";
import { previousResultSets, suggestedWeight } from "@/lib/setRules";

export type SetSyncEntry = {
  entryId: string;
  workoutDayExerciseId: string | null;
  userId: string;
  sets: Array<{
    id: string;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    completed: boolean;
    is_warmup: boolean;
    too_heavy: boolean;
    too_heavy_reps?: number | null;
    rpe?: number | null;
  }>;
};

/**
 * Sets from the most recent completed workout where this exercise was done with
 * `equipment` (defaults to the exercise's library tool). History is per tool.
 */
export async function getPreviousResults(
  exerciseId: string,
  equipment?: string | null
): Promise<{ weight_kg: number; reps: number; is_warmup: boolean; too_heavy: boolean; rpe: number | null }[]> {
  const supabase = await db();
  const userId = await getUserId();
  return getPreviousResultsInternal(supabase, userId, exerciseId, equipment);
}

// Internal version that reuses an existing client — avoids repeated auth round-trips
export async function getPreviousResultsInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string,
  equipment?: string | null
): Promise<{ weight_kg: number; reps: number; is_warmup: boolean; too_heavy: boolean; rpe: number | null }[]> {
  // Step 1: get recent completed workout IDs ordered by actual workout date.
  // Exclude deload workouts — after an Easy Week the next normal session should
  // restore the pre-deload baseline, not inherit the reduced weights/sets.
  const { data: recentWorkouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .eq("is_deload", false)
    .order("started_at", { ascending: false })
    .limit(30);

  if (!recentWorkouts || recentWorkouts.length === 0) return [];

  const workoutIds = (recentWorkouts as { id: string }[]).map((w) => w.id);

  // Step 2: find exercise entries matching those workout IDs
  const [{ data: entries }, defaults] = await Promise.all([
    supabase
      .from("workout_exercise_entries")
      .select("id, workout_id, equipment_type, set_entries(weight_kg, reps, completed, set_number, is_warmup, too_heavy, rpe)")
      .eq("exercise_id", exerciseId)
      .eq("user_id", userId)
      .in("workout_id", workoutIds),
    getDefaultEquipment(supabase, userId, [exerciseId]),
  ]);

  if (!entries || entries.length === 0) return [];

  type SetRow = {
    weight_kg: number | null;
    reps: number | null;
    set_number: number;
    completed: boolean;
    is_warmup: boolean;
    too_heavy: boolean;
    rpe: number | null;
  };
  const previousSets = (e: { set_entries: unknown }) => previousResultSets((e.set_entries ?? []) as SetRow[]);

  // Pick the entry from the most-recent completed workout done with the same tool
  const entry = pickLatestEntryForEquipment(
    entries as { workout_id: string; equipment_type: string | null; set_entries: unknown }[],
    workoutIds,
    equipment,
    defaults[exerciseId],
    (e) => previousSets(e).length > 0
  );
  if (!entry) return [];

  return previousSets(entry)
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({ weight_kg: s.weight_kg ?? 0, reps: s.reps ?? 0, is_warmup: s.is_warmup ?? false, too_heavy: s.too_heavy ?? false, rpe: s.rpe ?? null }));
}

export async function getSuggestedWeight(
  exerciseId: string,
  targetSets: number,
  equipment?: string | null,
  targetReps?: number | null
): Promise<number | null> {
  const supabase = await db();
  const userId = await getUserId();
  return getSuggestedWeightInternal(supabase, userId, exerciseId, targetSets, equipment, targetReps);
}

// Internal version that reuses an existing client — avoids repeated auth round-trips
export async function getSuggestedWeightInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string,
  targetSets: number,
  equipment?: string | null,
  targetReps?: number | null
): Promise<number | null> {
  const [prev, defaults] = await Promise.all([
    getPreviousResultsInternal(supabase, userId, exerciseId, equipment),
    equipment ? Promise.resolve({}) : getDefaultEquipment(supabase, userId, [exerciseId]),
  ]);
  return suggestedWeight(prev, {
    targetSets,
    targetReps: targetReps ?? null,
    equipment: equipment ?? (defaults as Record<string, string | null>)[exerciseId] ?? null,
  });
}

export async function updateSet(
  setId: string,
  data: { weight_kg?: number; reps?: number; completed?: boolean; is_warmup?: boolean }
) {
  const supabase = await db();
  await supabase.from("set_entries").update(data).eq("id", setId);
}

/**
 * Save a finished workout's sets in one transaction (save_workout_sets RPC, migration 021): deletes the
 * sets in `originalSetIds` that are gone, upserts every current set, and sets each program exercise's
 * target_sets to its work-set count.
 */
export async function syncWorkoutSets(entriesData: SetSyncEntry[], originalSetIds: string[]): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.rpc("save_workout_sets", { p_entries: entriesData, p_original_ids: originalSetIds });
  if (error) throw new Error(`Failed to save sets: ${error.message}`);
}

export async function saveTooHeavySets(
  setIds: string[],
  value: boolean,
  achievedReps?: number | null
): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();

  if (setIds.length === 0) return;

  const updatePayload: Record<string, unknown> = { too_heavy: value };
  if (value) {
    updatePayload.too_heavy_reps = achievedReps ?? null;
  } else {
    updatePayload.too_heavy_reps = null;
  }

  const { error } = await supabase
    .from("set_entries")
    .update(updatePayload)
    .in("id", setIds)
    .eq("user_id", userId);

  if (error) {
    // If the error is about too_heavy_reps column missing (migration 008 not yet run),
    // fall back to saving just the too_heavy flag without reps
    if (error.message?.includes("too_heavy_reps") || error.code === "42703") {
      const { error: fallbackError } = await supabase
        .from("set_entries")
        .update({ too_heavy: value })
        .in("id", setIds)
        .eq("user_id", userId);
      if (fallbackError) throw new Error(`Failed to update too_heavy: ${fallbackError.message}`);
      return;
    }
    throw new Error(`Failed to update too_heavy: ${error.message}`);
  }
}

export async function getLastTooHeavyFlags(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseIds: string[],
  /** Tool per exercise for the new session; missing = the exercise's default tool. */
  equipmentByExercise: Record<string, string | null | undefined> = {}
): Promise<Record<string, { setNumber: number; achievedReps: number | null }[]>> {
  if (exerciseIds.length === 0) return {};

  // Get the 30 most recent completed workouts
  const { data: recentWorkouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(30);

  if (!recentWorkouts || recentWorkouts.length === 0) return {};

  const workoutIds = (recentWorkouts as { id: string }[]).map((w) => w.id);

  // Fetch exercise entries with their sets for those workouts
  const [{ data: entryRows }, defaults] = await Promise.all([
    supabase
      .from("workout_exercise_entries")
      .select("exercise_id, workout_id, equipment_type, set_entries(set_number, too_heavy, too_heavy_reps)")
      .eq("user_id", userId)
      .in("exercise_id", exerciseIds)
      .in("workout_id", workoutIds),
    getDefaultEquipment(supabase, userId, exerciseIds),
  ]);

  if (!entryRows || entryRows.length === 0) return {};

  const rows = entryRows as {
    exercise_id: string;
    workout_id: string;
    equipment_type: string | null;
    set_entries: { set_number: number; too_heavy: boolean | null; too_heavy_reps: number | null }[];
  }[];

  // For each exercise, find the most recent entry with the same tool and extract too_heavy set info
  const flags: Record<string, { setNumber: number; achievedReps: number | null }[]> = {};
  for (const exId of exerciseIds) {
    const entry = pickLatestEntryForEquipment(
      rows.filter((r) => r.exercise_id === exId),
      workoutIds,
      equipmentByExercise[exId],
      defaults[exId]
    );
    if (entry) {
      flags[exId] = (entry.set_entries ?? [])
        .filter((s) => s.too_heavy === true)
        .map((s) => ({ setNumber: s.set_number, achievedReps: s.too_heavy_reps ?? null }));
    }
  }
  return flags;
}
