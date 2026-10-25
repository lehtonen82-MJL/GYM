"use server";

import type {
  WorkoutExerciseEntry,
  WorkoutTemplateListItem,
  WorkoutTemplateWithExercises,
} from "@/lib/types";
import { db, getDefaultEquipment, getUserId } from "./_shared";
import { type StartWorkoutResult } from "./workout";
import { getPreviousResultsInternal, getLastTooHeavyFlags } from "./sets";
import { planSets, type PlannedSet } from "@/lib/plannedSets";
import { suggestedWeight } from "@/lib/setRules";

/** Rows to insert for an entry's planned sets. */
function setRowsFor(planned: PlannedSet[], entryId: string, userId: string) {
  return planned.map((set) => ({ ...set, workout_exercise_entry_id: entryId, user_id: userId, completed: false }));
}

// ════════════════════════════════════════════════════════
// START BLANK WORKOUT
// ════════════════════════════════════════════════════════

export async function startBlankWorkout(name?: string): Promise<StartWorkoutResult | null> {
  const supabase = await db();
  const userId = await getUserId();

  // Check whether the import_session_name column exists (migration 004 may not be applied)
  const { error: probeErr } = await supabase
    .from("workouts")
    .select("import_session_name")
    .limit(0);
  const hasSessionName = !probeErr;

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    workout_day_id: null,
    is_deload: false,
  };
  if (hasSessionName) {
    insertPayload.import_session_name = name ?? "Freestyle workout";
  }

  const { data: workout, error } = await supabase
    .from("workouts")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !workout) {
    throw new Error(error?.message ?? "Failed to create workout");
  }

  return {
    id: workout.id as string,
    workout: workout as StartWorkoutResult["workout"],
    entries: [],
    suggestions: {},
    tooHeavyFlags: {},
  };
}

// ════════════════════════════════════════════════════════
// ADD EXERCISE TO WORKOUT
// ════════════════════════════════════════════════════════

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  targetSets = 3,
  targetReps = 8
): Promise<WorkoutExerciseEntry | { __error: string } | null> {
  const supabase = await db();
  const userId = await getUserId();

  // Insert the exercise entry (and fetch its previous results to plan the sets)
  const [{ data: entry, error: entryErr }, previous] = await Promise.all([
    supabase
      .from("workout_exercise_entries")
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        workout_day_exercise_id: null,
        user_id: userId,
      })
      .select("*, exercise:exercises!workout_exercise_entries_exercise_id_fkey(*)")
      .single(),
    getPreviousResultsInternal(supabase, userId, exerciseId),
  ]);

  if (entryErr || !entry) {
    const msg = `entry insert failed: ${entryErr?.message ?? "no data"} | ${entryErr?.details ?? ""} | hint: ${entryErr?.hint ?? ""}`;
    console.error("[addExerciseToWorkout]", msg);
    return { __error: msg };
  }

  // Planned sets from previous results (empty work sets when the exercise has none);
  // too_heavy/too_heavy_reps are left to their DB defaults.
  const setRows = setRowsFor(planSets({ prescription: [], targetSets, previous }), entry.id as string, userId);

  const { data: sets, error: setsErr } = await supabase
    .from("set_entries")
    .insert(setRows)
    .select("*");

  if (setsErr) {
    const msg = `sets insert failed: ${setsErr?.message ?? "no data"} | ${setsErr?.details ?? ""} | hint: ${setsErr?.hint ?? ""}`;
    console.error("[addExerciseToWorkout]", msg);
    return { __error: msg };
  }

  return {
    ...(entry as WorkoutExerciseEntry),
    set_entries: (sets ?? []) as WorkoutExerciseEntry["set_entries"],
  };
}

// ════════════════════════════════════════════════════════
// REMOVE EXERCISE FROM WORKOUT
// ════════════════════════════════════════════════════════

export async function removeExerciseFromWorkout(entryId: string): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();
  await supabase
    .from("workout_exercise_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);
}

// ════════════════════════════════════════════════════════
// SAVE WORKOUT AS TEMPLATE
// ════════════════════════════════════════════════════════

export async function saveWorkoutAsTemplate(workoutId: string, name: string): Promise<string | null> {
  const supabase = await db();
  const userId = await getUserId();

  // Fetch the workout's entries with exercise names
  const { data: entriesData } = await supabase
    .from("workout_exercise_entries")
    .select("id, exercise_id, exercise:exercises!workout_exercise_entries_exercise_id_fkey(name), set_entries(is_warmup, set_number)")
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .order("created_at");

  if (!entriesData || entriesData.length === 0) return null;

  // Create the template
  const { data: template, error: tmplErr } = await supabase
    .from("workout_templates")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  if (tmplErr || !template) return null;
  const templateId = template.id as string;

  // Insert template exercises
  type EntryRow = {
    exercise_id: string;
    exercise: { name: string } | null;
    set_entries: { is_warmup: boolean; set_number: number }[];
  };

  const exerciseRows = (entriesData as unknown as EntryRow[]).map((entry, i) => {
    const workSets = (entry.set_entries ?? []).filter((s) => !s.is_warmup).length;
    return {
      template_id: templateId,
      user_id: userId,
      exercise_id: entry.exercise_id,
      exercise_name_snapshot: entry.exercise?.name ?? entry.exercise_id,
      target_sets: workSets > 0 ? workSets : 3,
      target_reps: 8,
      sort_order: i,
    };
  });

  await supabase.from("workout_template_exercises").insert(exerciseRows);

  return templateId;
}

// ════════════════════════════════════════════════════════
// GET WORKOUT TEMPLATES (list for Today page)
// ════════════════════════════════════════════════════════

export async function getWorkoutTemplates(): Promise<WorkoutTemplateListItem[]> {
  const supabase = await db();
  const userId = await getUserId();

  const { data: templates } = await supabase
    .from("workout_templates")
    .select("id, name, last_used_at, created_at")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!templates || templates.length === 0) return [];

  // For each template, fetch its first 4 exercise names and count
  const results: WorkoutTemplateListItem[] = await Promise.all(
    (templates as { id: string; name: string; last_used_at: string | null; created_at: string }[]).map(async (t) => {
      const { data: exercises } = await supabase
        .from("workout_template_exercises")
        .select("exercise_name_snapshot")
        .eq("template_id", t.id)
        .order("sort_order")
        .limit(4);

      const { count } = await supabase
        .from("workout_template_exercises")
        .select("id", { count: "exact", head: true })
        .eq("template_id", t.id);

      return {
        id: t.id,
        user_id: userId,
        name: t.name,
        last_used_at: t.last_used_at,
        created_at: t.created_at,
        exercise_count: count ?? 0,
        exercise_names: (exercises ?? []).map((e: { exercise_name_snapshot: string }) => e.exercise_name_snapshot),
      };
    })
  );

  return results;
}

// ════════════════════════════════════════════════════════
// GET SINGLE TEMPLATE (full preview)
// ════════════════════════════════════════════════════════

export async function getWorkoutTemplate(templateId: string): Promise<WorkoutTemplateWithExercises | null> {
  const supabase = await db();
  const userId = await getUserId();

  const { data: template } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();

  if (!template) return null;

  const { data: exercises } = await supabase
    .from("workout_template_exercises")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");

  return {
    ...(template as { id: string; user_id: string; name: string; last_used_at: string | null; created_at: string }),
    exercises: (exercises ?? []) as unknown as WorkoutTemplateWithExercises["exercises"],
  };
}

// ════════════════════════════════════════════════════════
// RENAME / DELETE TEMPLATE
// ════════════════════════════════════════════════════════

export async function renameWorkoutTemplate(templateId: string, name: string): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();
  await supabase.from("workout_templates").update({ name }).eq("id", templateId).eq("user_id", userId);
}

export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();
  await supabase.from("workout_templates").delete().eq("id", templateId).eq("user_id", userId);
}

// ════════════════════════════════════════════════════════
// START WORKOUT FROM TEMPLATE
// ════════════════════════════════════════════════════════

export async function startWorkoutFromTemplate(templateId: string): Promise<StartWorkoutResult | null> {
  const supabase = await db();
  const userId = await getUserId();

  // Fetch the template
  const { data: template } = await supabase
    .from("workout_templates")
    .select("*, workout_template_exercises(*)")
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();

  if (!template) return null;

  type TemplateExRow = {
    exercise_id: string;
    exercise_name_snapshot: string;
    target_sets: number;
    target_reps: number;
    sort_order: number;
  };
  const templateExercises = ((template as { workout_template_exercises: TemplateExRow[] }).workout_template_exercises ?? [])
    .sort((a, b) => a.sort_order - b.sort_order);

  const exerciseIds = templateExercises.map((ex) => ex.exercise_id);
  const [previousAll, defaultEquipment, { data: exerciseRows }] = await Promise.all([
    Promise.all(templateExercises.map((ex) => getPreviousResultsInternal(supabase, userId, ex.exercise_id))),
    getDefaultEquipment(supabase, userId, exerciseIds),
    supabase.from("exercises").select("*").in("id", exerciseIds).eq("user_id", userId),
  ]);

  // Workout, entries and planned sets in one transaction (start_workout RPC, migrations 021 + 023)
  const { data, error } = await supabase.rpc("start_workout", {
    p_workout: { workout_day_id: null, is_deload: false, notes: null, import_session_name: (template as { name: string }).name },
    p_entries: templateExercises.map((ex, i) => ({
      exercise_id: ex.exercise_id,
      workout_day_exercise_id: null,
      sets: planSets({ prescription: [], targetSets: ex.target_sets, previous: previousAll[i] }),
    })),
  });
  if (error || !data) {
    console.error("[startWorkoutFromTemplate] start_workout RPC failed:", error?.message);
    return null;
  }
  const created = data as { workout: StartWorkoutResult["workout"]; entries: WorkoutExerciseEntry[] };
  const exerciseById = new Map((exerciseRows ?? []).map((e) => [e.id as string, e]));
  const entriesWithSets = created.entries.map((entry) => ({
    ...entry,
    exercise: exerciseById.get(entry.exercise_id) as WorkoutExerciseEntry["exercise"],
  }));

  const tooHeavyFlags = await getLastTooHeavyFlags(supabase, userId, exerciseIds);
  const suggestions: Record<string, number | null> = {};
  templateExercises.forEach((ex, i) => {
    suggestions[ex.exercise_id] = suggestedWeight(previousAll[i], {
      targetSets: ex.target_sets,
      targetReps: ex.target_reps,
      equipment: defaultEquipment[ex.exercise_id] ?? null,
    });
  });

  // Mark template last used
  await supabase.from("workout_templates").update({ last_used_at: new Date().toISOString() }).eq("id", templateId);

  return {
    id: created.workout.id,
    workout: created.workout,
    entries: entriesWithSets,
    suggestions,
    tooHeavyFlags,
  };
}
