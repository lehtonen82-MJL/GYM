"use server";

import type { Workout, WorkoutExerciseEntry } from "@/lib/types";
import { parseSchemePrescription } from "@/lib/programParser";
import { planSets, type PlanInput, type PlannedSet } from "@/lib/plannedSets";
import { suggestedWeight } from "@/lib/setRules";
import { db, getUserId } from "./_shared";
import { getPreviousResultsInternal, getSuggestedWeightInternal, getLastTooHeavyFlags } from "./sets";
import { linkExerciseToLibraryInternal } from "./exercises";

export type StartWorkoutResult = {
  id: string;
  workout: Workout;
  entries: WorkoutExerciseEntry[];
  suggestions: Record<string, number | null>;
  /** Maps exercise_id → array of set_numbers that were too heavy last time */
  tooHeavyFlags: Record<string, { setNumber: number; achievedReps: number | null }[]>;
};

async function buildStartWorkoutResultFromExisting(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  workout: Workout
): Promise<StartWorkoutResult | null> {
  const { data: entriesData } = await supabase
    .from("workout_exercise_entries")
    .select(
      "*, exercise:exercises!workout_exercise_entries_exercise_id_fkey(*), original_exercise:exercises!workout_exercise_entries_original_exercise_id_fkey(*), workout_day_exercise:workout_day_exercises(*, exercise:exercises(*)), set_entries:set_entries(*)"
    )
    .eq("workout_id", workout.id)
    .eq("user_id", userId)
    .order("created_at");

  const entries = (entriesData ?? []) as WorkoutExerciseEntry[];
  if (entries.length === 0) return null;

  for (const entry of entries) {
    entry.set_entries?.sort(
      (a: { set_number: number }, b: { set_number: number }) =>
        a.set_number - b.set_number
    );
  }

  const suggestions: Record<string, number | null> = {};
  // Fetch all suggestions in parallel — one Supabase client, no re-auth per exercise
  const suggestionPairs = await Promise.all(
    entries.map(async (entry) => {
      const targetSets =
        entry.workout_day_exercise?.target_sets ?? entry.set_entries?.length ?? 1;
      const weight = await getSuggestedWeightInternal(
        supabase, userId, entry.exercise_id, targetSets, entry.equipment_type
      );
      return [entry.exercise_id, weight] as [string, number | null];
    })
  );
  for (const [exerciseId, weight] of suggestionPairs) {
    suggestions[exerciseId] = weight;
  }

  // Fetch too_heavy flags from previous completed workouts for these exercises,
  // scoped to the tool each entry is tagged with
  const tooHeavyFlags = await getLastTooHeavyFlags(
    supabase,
    userId,
    entries.map((e) => e.exercise_id),
    Object.fromEntries(entries.map((e) => [e.exercise_id, e.equipment_type]))
  );

  return {
    id: workout.id,
    workout,
    entries,
    suggestions,
    tooHeavyFlags,
  };
}

type WdeRow = {
  id: string;
  exercise_id: string;
  target_sets: number;
  target_reps?: number;
  scheme_text?: string;
  exercise: unknown;
};

/**
 * Adds the program exercises to a new workout: one entry each with its planned sets (planSets), plus
 * the suggested weights and too-heavy flags the client needs. In an Easy Week the suggestion is last
 * time's top weight, without the +2.5 kg progression.
 */
async function addPlannedExercises(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  workout: Workout,
  wdes: WdeRow[],
  deload?: PlanInput["deload"]
): Promise<StartWorkoutResult> {
  const [entryResults, prevResultsAll] = await Promise.all([
    Promise.all(
      wdes.map((wde) =>
        supabase
          .from("workout_exercise_entries")
          .insert({ workout_id: workout.id, exercise_id: wde.exercise_id, workout_day_exercise_id: wde.id, user_id: userId })
          .select("*")
          .single()
      )
    ),
    Promise.all(wdes.map((wde) => getPreviousResultsInternal(supabase, userId, wde.exercise_id))),
  ]);

  const setRows: (PlannedSet & { workout_exercise_entry_id: string; user_id: string; completed: boolean })[] = [];
  const created: { entry: WorkoutExerciseEntry; wde: WdeRow; previous: (typeof prevResultsAll)[number] }[] = [];
  wdes.forEach((wde, i) => {
    const entry = entryResults[i].data as WorkoutExerciseEntry | null;
    if (!entry) return;
    const previous = prevResultsAll[i] ?? [];
    const planned = planSets({ prescription: parseSchemePrescription(wde.scheme_text), targetSets: wde.target_sets, previous, deload });
    for (const set of planned) setRows.push({ ...set, workout_exercise_entry_id: entry.id, user_id: userId, completed: false });
    created.push({ entry, wde, previous });
  });

  // Single round-trip for all sets
  const { data: insertedSets } = await supabase.from("set_entries").insert(setRows).select("*").order("set_number");
  const setsByEntryId: Record<string, NonNullable<WorkoutExerciseEntry["set_entries"]>> = {};
  for (const s of insertedSets ?? []) {
    (setsByEntryId[s.workout_exercise_entry_id as string] ??= []).push(s);
  }

  const suggestions: Record<string, number | null> = {};
  const entries: WorkoutExerciseEntry[] = created.map(({ entry, wde, previous }) => {
    suggestions[wde.exercise_id] = suggestedWeight(previous, deload ? Number.POSITIVE_INFINITY : wde.target_sets);
    return {
      ...entry,
      exercise: wde.exercise as WorkoutExerciseEntry["exercise"],
      workout_day_exercise: wde as WorkoutExerciseEntry["workout_day_exercise"],
      set_entries: setsByEntryId[entry.id] ?? [],
    };
  });

  const tooHeavyFlags = await getLastTooHeavyFlags(supabase, userId, entries.map((e) => e.exercise_id));
  return { id: workout.id, workout, entries, suggestions, tooHeavyFlags };
}

export async function startWorkout(
  workoutDayId: string,
  isDeload = false,
  deloadWeightPct = 80,
  deloadSetPct = 50,
  deloadReduceWarmups = false
): Promise<StartWorkoutResult | null> {
  const supabase = await db();
  const userId = await getUserId();

  // 1. Get workout day
  const { data: day } = await supabase
    .from("workout_days")
    .select("*")
    .eq("id", workoutDayId)
    .eq("user_id", userId)
    .single();
  if (!day) return null;

  // 2. Reuse the latest unfinished workout for this slot if it exists.
  const { data: unfinishedWorkout } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("user_id", userId)
    .eq("workout_day_id", workoutDayId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unfinishedWorkout) {
    const resumed = await buildStartWorkoutResultFromExisting(
      supabase,
      userId,
      unfinishedWorkout as Workout
    );
    if (resumed) return resumed;
  }

  // 2. Create workout row
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, workout_day_id: workoutDayId, is_deload: isDeload })
    .select("*")
    .single();
  if (wErr || !workout) return null;
  workout.workout_day = day;

  // 3. Get exercises — try legacy workout_day_exercises first, fall back to program_exercises.
  // This handles both old data (wde table) and programs built/imported via the program builder
  // (which stores exercises in program_exercises, not workout_day_exercises).
  let resolvedWdes: WdeRow[] = [];

  const { data: legacyWdes } = await supabase
    .from("workout_day_exercises")
    .select("*, exercise:exercises(*)")
    .eq("workout_day_id", workoutDayId)
    .eq("user_id", userId)
    .order("order_index");

  if (legacyWdes && legacyWdes.length > 0) {
    resolvedWdes = legacyWdes as WdeRow[];
  } else {
    // Fall back: materialise program_exercises → workout_day_exercises on-demand
    const { data: pes } = await supabase
      .from("program_exercises")
      .select("*")
      .eq("program_day_id", workoutDayId)
      .eq("user_id", userId)
      .order("sort_order");

    if (!pes || pes.length === 0) return null;

    for (const pe of pes) {
      let exerciseId: string | null = (pe.exercise_id as string | null) ?? null;

      // If program exercise has no linked exercise record, find or create one by name
      if (!exerciseId) {
        const normalized = (pe.exercise_name_snapshot as string).toLowerCase().trim();
        const { data: existing } = await supabase
          .from("exercises")
          .select("id")
          .eq("user_id", userId)
          .eq("normalized_name", normalized)
          .limit(1)
          .maybeSingle();
        if (existing) {
          exerciseId = existing.id as string;
        } else {
          const { data: created } = await supabase
            .from("exercises")
            .insert({ user_id: userId, name: pe.exercise_name_snapshot, normalized_name: normalized })
            .select("id")
            .single();
          exerciseId = created?.id ?? null;
          // Link new exercise to global library for enriched metadata
          if (exerciseId) {
            await linkExerciseToLibraryInternal(supabase, userId, exerciseId, pe.exercise_name_snapshot as string);
          }
        }
      }

      if (!exerciseId) continue;

      // Find or create a workout_day_exercises row for this (day, exercise) pair
      const { data: existingWde } = await supabase
        .from("workout_day_exercises")
        .select("*, exercise:exercises(*)")
        .eq("workout_day_id", workoutDayId)
        .eq("exercise_id", exerciseId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      const schemeText = (pe.scheme_text as string | null) ?? undefined;
      const prescription = parseSchemePrescription(schemeText);
      const firstReps = prescription[0]?.reps;

      if (existingWde) {
        resolvedWdes.push({
          ...(existingWde as WdeRow),
          scheme_text: schemeText,
        });
      } else {
        const { data: newWde } = await supabase
          .from("workout_day_exercises")
          .insert({
            workout_day_id: workoutDayId,
            exercise_id: exerciseId,
            user_id: userId,
            order_index: pe.sort_order ?? 0,
            target_sets: (pe.target_sets as number | null) ?? 3,
            target_reps: firstReps ?? 5,
          })
          .select("*, exercise:exercises(*)")
          .single();
        if (newWde) {
          resolvedWdes.push({
            ...(newWde as WdeRow),
            scheme_text: schemeText,
          });
        }
      }
    }
  }

  if (resolvedWdes.length === 0) return null;

  return addPlannedExercises(
    supabase,
    userId,
    workout as Workout,
    resolvedWdes,
    isDeload ? { weightPct: deloadWeightPct, setPct: deloadSetPct, reduceWarmups: deloadReduceWarmups } : undefined
  );
}

export async function startDeloadWorkout(
  primaryDayId: string,
  additionalDayIds: string[] = [],
  deloadWeightPct = 80,
  deloadSetPct = 50,
  deloadReduceWarmups = false
): Promise<StartWorkoutResult | null> {
  // For normal deload (no additional days), reuse the main path.
  if (additionalDayIds.length === 0) {
    return startWorkout(primaryDayId, true, deloadWeightPct, deloadSetPct, deloadReduceWarmups);
  }


  const supabase = await db();
  const userId = await getUserId();

  // Get the primary workout day for metadata
  const { data: primaryDay } = await supabase
    .from("workout_days")
    .select("*")
    .eq("id", primaryDayId)
    .eq("user_id", userId)
    .single();
  if (!primaryDay) return null;

  // Fetch all additional days for the auto-note
  const { data: extraDays } = await supabase
    .from("workout_days")
    .select("id, name")
    .in("id", additionalDayIds)
    .eq("user_id", userId);

  const dayNames = [
    (primaryDay as { name: string }).name,
    ...((extraDays ?? []) as { name: string }[]).map((d) => d.name),
  ];
  const autoNote = `Easy week — ${dayNames.join(" + ")}`;

  // Create workout row tied to the primary day
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      workout_day_id: primaryDayId,
      is_deload: true,
      notes: autoNote,
    })
    .select("*, workout_day:workout_days(*)")
    .single();
  if (wErr || !workout) return null;

  // Collect exercises from all days in order, deduplicated by exercise_id
  const allDayIds = [primaryDayId, ...additionalDayIds];
  const seenExerciseIds = new Set<string>();

  const allWdes: WdeRow[] = [];

  for (const dayId of allDayIds) {
    // Try legacy workout_day_exercises first
    const { data: legacyWdes } = await supabase
      .from("workout_day_exercises")
      .select("*, exercise:exercises(*)")
      .eq("workout_day_id", dayId)
      .eq("user_id", userId)
      .order("order_index");

    if (legacyWdes && legacyWdes.length > 0) {
      for (const wde of legacyWdes as WdeRow[]) {
        if (!seenExerciseIds.has(wde.exercise_id)) {
          seenExerciseIds.add(wde.exercise_id);
          allWdes.push(wde);
        }
      }
    } else {
      // Fall back to program_exercises and materialise wde rows
      const { data: pes } = await supabase
        .from("program_exercises")
        .select("*")
        .eq("program_day_id", dayId)
        .eq("user_id", userId)
        .order("sort_order");

      for (const pe of pes ?? []) {
        let exerciseId: string | null = (pe.exercise_id as string | null) ?? null;
        if (!exerciseId) {
          const normalized = (pe.exercise_name_snapshot as string).toLowerCase().trim();
          const { data: existing } = await supabase
            .from("exercises")
            .select("id")
            .eq("user_id", userId)
            .eq("normalized_name", normalized)
            .limit(1)
            .maybeSingle();
          if (existing) {
            exerciseId = existing.id as string;
          } else {
            const { data: created } = await supabase
              .from("exercises")
              .insert({ user_id: userId, name: pe.exercise_name_snapshot, normalized_name: normalized })
              .select("id")
              .single();
            exerciseId = created?.id ?? null;
          }
        }
        if (!exerciseId || seenExerciseIds.has(exerciseId)) continue;
        seenExerciseIds.add(exerciseId);

        const schemeText = (pe.scheme_text as string | null) ?? undefined;
        const prescription = parseSchemePrescription(schemeText);
        const firstReps = prescription[0]?.reps;

        const wde = await supabase
          .from("workout_day_exercises")
          .select("*, exercise:exercises(*)")
          .eq("workout_day_id", dayId)
          .eq("exercise_id", exerciseId)
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (!wde.data) {
          const { data: newWde } = await supabase
            .from("workout_day_exercises")
            .insert({
              workout_day_id: dayId,
              exercise_id: exerciseId,
              user_id: userId,
              order_index: pe.sort_order ?? 0,
              target_sets: (pe.target_sets as number | null) ?? 3,
              target_reps: firstReps ?? 5,
            })
            .select("*, exercise:exercises(*)")
            .single();
          if (newWde) allWdes.push({ ...(newWde as WdeRow), scheme_text: schemeText });
        } else {
          allWdes.push({ ...(wde.data as WdeRow), scheme_text: schemeText });
        }
      }
    }
  }

  if (allWdes.length === 0) return null;

  return addPlannedExercises(supabase, userId, workout as Workout, allWdes, {
    weightPct: deloadWeightPct,
    setPct: deloadSetPct,
    reduceWarmups: deloadReduceWarmups,
  });
}

export async function getWorkout(
  workoutId: string
): Promise<{ workout: Workout; entries: WorkoutExerciseEntry[] } | null> {
  const supabase = await db();
  const userId = await getUserId();

  const { data: workout } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .single();
  if (!workout) return null;

  // Fetch entries without nested set_entries or named-FK joins to avoid query
  // failures if migrations haven't been applied or FK names differ.
  const { data: entries, error: entriesError } = await supabase
    .from("workout_exercise_entries")
    .select(
      "*, exercise:exercises!workout_exercise_entries_exercise_id_fkey(*), workout_day_exercise:workout_day_exercises(*, exercise:exercises(*))"
    )
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .order("created_at");

  if (entriesError) {
    console.error("[getWorkout] entries query error:", entriesError.message, entriesError.details);
  }

  const entryList = entries ?? [];

  // Fetch set_entries in a separate robust query
  let setEntries: Array<Record<string, unknown>> = [];
  if (entryList.length > 0) {
    const entryIds = entryList.map((e) => e.id as string);
    const { data: setsData, error: setsError } = await supabase
      .from("set_entries")
      .select("*")
      .in("workout_exercise_entry_id", entryIds)
      .eq("user_id", userId)
      .order("set_number");
    if (setsError) {
      console.error("[getWorkout] set_entries query error:", setsError.message);
    }
    setEntries = setsData ?? [];
  }

  console.log(`[getWorkout] entries=${entryList.length} sets=${setEntries.length}`);

  // Group sets by entry id
  const setsByEntry = new Map<string, unknown[]>();
  for (const s of setEntries) {
    const eid = s.workout_exercise_entry_id as string;
    if (!setsByEntry.has(eid)) setsByEntry.set(eid, []);
    setsByEntry.get(eid)!.push(s);
  }

  // Merge set_entries into entries
  const enriched: WorkoutExerciseEntry[] = entryList.map((entry) => ({
    ...(entry as WorkoutExerciseEntry),
    set_entries: (setsByEntry.get(entry.id as string) ?? []) as WorkoutExerciseEntry["set_entries"],
  }));

  return { workout, entries: enriched };
}

export async function completeWorkout(
  workoutId: string,
  notes: string | null
) {
  const supabase = await db();

  // Mark workout complete
  const { data: workout } = await supabase
    .from("workouts")
    .update({ completed_at: new Date().toISOString(), notes })
    .eq("id", workoutId)
    .select("started_at")
    .single();

  // Refresh PRs for every exercise in this workout
  if (workout?.started_at) {
    const userId = await getUserId();
    const { data: entries } = await supabase
      .from("workout_exercise_entries")
      .select("exercise_id, equipment_type")
      .eq("workout_id", workoutId)
      .eq("user_id", userId)
      .not("exercise_id", "is", null);

    if (entries?.length) {
      // PRs are scoped per tool (migration 018); null = the exercise's default tool
      await Promise.all(
        entries.map((e) =>
          supabase.rpc("upsert_exercise_prs", {
            p_user_id: userId,
            p_exercise_id: e.exercise_id,
            p_workout_started_at: workout.started_at,
            p_equipment_type: e.equipment_type ?? null,
          })
        )
      );
    }
  }
}

/**
 * Swap the exercise on a workout_exercise_entry mid-workout.
 * Records the original exercise_id in original_exercise_id (only if not already swapped).
 * Returns the old exercise_id.
 */
export async function swapWorkoutExercise(
  entryId: string,
  newExerciseId: string
): Promise<string> {
  const supabase = await db();
  const userId = await getUserId();

  // Get current state
  const { data: current } = await supabase
    .from("workout_exercise_entries")
    .select("exercise_id, original_exercise_id")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();

  if (!current) throw new Error("Entry not found");

  const oldExerciseId = current.exercise_id as string;

  // Only record original_exercise_id on first swap (not on re-swap)
  const originalId = (current.original_exercise_id as string | null) ?? oldExerciseId;

  const { error } = await supabase
    .from("workout_exercise_entries")
    // Reset the tool: the old exercise's equipment tag doesn't apply to the new one,
    // and history/PRs are filtered by it (NULL = new exercise's default tool)
    .update({ exercise_id: newExerciseId, original_exercise_id: originalId, equipment_type: null })
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to swap exercise: ${error.message}`);

  return oldExerciseId;
}

/**
 * Returns the most recent alternative exercise used for a given program slot,
 * i.e. the last time original_exercise_id was set on an entry for this slot.
 */
export async function getLastUsedAlternative(
  programExerciseId: string
): Promise<{ exercise_id: string; exercise_name: string; date: string } | null> {
  const supabase = await db();
  const userId = await getUserId();

  // Find the most recent completed workout entry for this program slot that had a swap
  const { data } = await supabase
    .from("workout_exercise_entries")
    .select(
      "exercise_id, exercise:exercises!workout_exercise_entries_exercise_id_fkey(name), workout:workouts!inner(started_at, completed_at), workout_day_exercise_id"
    )
    .eq("user_id", userId)
    .eq("workout_day_exercise_id", programExerciseId)
    .not("original_exercise_id", "is", null)
    .not("workout.completed_at", "is", null)
    .order("workout.started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const w = (data.workout as unknown as { started_at: string } | null);
  const ex = (data.exercise as unknown as { name: string } | null);
  return {
    exercise_id: data.exercise_id as string,
    exercise_name: ex?.name ?? "Unknown",
    date: w ? new Date(w.started_at).toISOString().split("T")[0] : "",
  };
}

/** Update a program exercise slot to permanently use a different exercise */
export async function updateProgramExerciseDefault(
  programExerciseId: string,
  newExerciseId: string
): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();

  // Get the new exercise name for the snapshot
  const { data: ex } = await supabase
    .from("exercises")
    .select("name")
    .eq("id", newExerciseId)
    .eq("user_id", userId)
    .single();

  if (!ex) throw new Error("Exercise not found");

  const { error } = await supabase
    .from("program_exercises")
    .update({ exercise_id: newExerciseId, exercise_name_snapshot: (ex as { name: string }).name })
    .eq("id", programExerciseId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to update program exercise: ${error.message}`);
}
