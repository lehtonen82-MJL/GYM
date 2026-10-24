"use server";

import { DEMO_MODE, db, getDefaultEquipment, getUserId, mockStore } from "./_shared";
import { MOCK_PREV } from "./_mocks";
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
  }>;
};

/**
 * Sets from the most recent completed workout where this exercise was done with
 * `equipment` (defaults to the exercise's library tool). History is per tool.
 */
export async function getPreviousResults(
  exerciseId: string,
  equipment?: string | null
): Promise<{ weight_kg: number; reps: number }[]> {
  if (DEMO_MODE) return MOCK_PREV[exerciseId] ?? [];

  const supabase = await db();
  const userId = await getUserId();
  const results = await getPreviousResultsInternal(supabase, userId, exerciseId, equipment);
  return results.map((r) => ({ weight_kg: r.weight_kg, reps: r.reps }));
}

// Internal version that reuses an existing client — avoids repeated auth round-trips
export async function getPreviousResultsInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string,
  equipment?: string | null
): Promise<{ weight_kg: number; reps: number; is_warmup: boolean; too_heavy: boolean }[]> {
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
      .select("id, workout_id, equipment_type, set_entries(weight_kg, reps, completed, set_number, is_warmup, too_heavy)")
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
    .map((s) => ({ weight_kg: s.weight_kg ?? 0, reps: s.reps ?? 0, is_warmup: s.is_warmup ?? false, too_heavy: s.too_heavy ?? false }));
}

export async function getSuggestedWeight(
  exerciseId: string,
  targetSets: number,
  equipment?: string | null
): Promise<number | null> {
  if (DEMO_MODE) return suggestedWeight(MOCK_PREV[exerciseId] ?? [], targetSets);

  const supabase = await db();
  const userId = await getUserId();
  return getSuggestedWeightInternal(supabase, userId, exerciseId, targetSets, equipment);
}

// Internal version that reuses an existing client — avoids repeated auth round-trips
export async function getSuggestedWeightInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string,
  targetSets: number,
  equipment?: string | null
): Promise<number | null> {
  const prev = await getPreviousResultsInternal(supabase, userId, exerciseId, equipment);
  return suggestedWeight(prev, targetSets);
}

export async function updateSet(
  setId: string,
  data: { weight_kg?: number; reps?: number; completed?: boolean; is_warmup?: boolean }
) {
  if (DEMO_MODE) {
    for (const stored of mockStore.values()) {
      for (const entry of stored.entries) {
        const set = entry.set_entries?.find((s) => s.id === setId);
        if (set) { Object.assign(set, data); return; }
      }
    }
    return;
  }

  const supabase = await db();
  await supabase.from("set_entries").update(data).eq("id", setId);
}

export async function syncWorkoutSets(
  entriesData: SetSyncEntry[],
  originalSetIds: string[]
): Promise<void> {
  if (DEMO_MODE) {
    // Update mock store in-place
    for (const { entryId, userId: entryUserId, sets } of entriesData) {
      for (const stored of mockStore.values()) {
        const entry = stored.entries.find((e) => e.id === entryId);
        if (entry) {
          entry.set_entries = sets.map((s) => ({
            ...s,
            workout_exercise_entry_id: entryId,
            user_id: entryUserId,
            created_at: new Date().toISOString(),
          }));
        }
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();
  const errors: string[] = [];

  const currentSetIds = new Set(entriesData.flatMap((e) => e.sets.map((s) => s.id)));
  const originalIdsSet = new Set(originalSetIds);

  // 1. Delete sets that existed originally but are no longer present
  const toDelete = originalSetIds.filter((id) => !currentSetIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from("set_entries").delete().in("id", toDelete).eq("user_id", userId);
    if (error) errors.push(`delete: ${error.message}`);
  }

  // 2. For each entry: upsert all current sets
  for (const { entryId, workoutDayExerciseId, sets } of entriesData) {
    for (const set of sets) {
      const isNew = !originalIdsSet.has(set.id);
      if (isNew) {
        const { error } = await supabase.from("set_entries").insert({
          id: set.id,
          workout_exercise_entry_id: entryId,
          user_id: userId,
          set_number: set.set_number,
          weight_kg: set.weight_kg,
          reps: set.reps,
          completed: set.completed,
          is_warmup: set.is_warmup,
          too_heavy: set.too_heavy,
          too_heavy_reps: set.too_heavy_reps ?? null,
        });
        if (error) errors.push(`insert set ${set.set_number}: ${error.message}`);
      } else {
        const { error } = await supabase.from("set_entries").update({
          set_number: set.set_number,
          weight_kg: set.weight_kg,
          reps: set.reps,
          completed: set.completed,
          is_warmup: set.is_warmup,
          too_heavy: set.too_heavy,
          too_heavy_reps: set.too_heavy_reps ?? null,
        }).eq("id", set.id).eq("user_id", userId);
        if (error) errors.push(`update set ${set.set_number}: ${error.message}`);
      }
    }

    // 3. Update workout_day_exercises.target_sets to work set count
    if (workoutDayExerciseId) {
      const workSetCount = sets.filter((s) => !s.is_warmup).length;
      if (workSetCount > 0) {
        await supabase.from("workout_day_exercises")
          .update({ target_sets: workSetCount })
          .eq("id", workoutDayExerciseId)
          .eq("user_id", userId);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to save sets: ${errors.join("; ")}`);
  }
}

export async function saveSets(
  sets: { id: string; weight_kg: number | null; reps: number | null; completed: boolean }[]
) {
  if (DEMO_MODE) return;

  const supabase = await db();
  for (const set of sets) {
    await supabase
      .from("set_entries")
      .update({
        weight_kg: set.weight_kg,
        reps: set.reps,
        completed: set.completed,
      })
      .eq("id", set.id);
  }
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
