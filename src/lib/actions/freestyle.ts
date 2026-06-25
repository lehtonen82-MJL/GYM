"use server";

import type {
  WorkoutExerciseEntry,
  WorkoutTemplateListItem,
  WorkoutTemplateWithExercises,
} from "@/lib/types";
import { DEMO_MODE, db, getUserId, uid, mockStore } from "./_shared";
import { MOCK_EXERCISES } from "./_mocks";
import { type StartWorkoutResult } from "./workout";
import { getPreviousResultsInternal, getSuggestedWeightInternal, getLastTooHeavyFlags } from "./sets";

// ── Demo mock store for templates ──────────────────────────

declare const globalThis: typeof global & {
  __mockTemplates?: MockTemplate[];
};

type MockTemplate = {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  exercises: { exercise_id: string; exercise_name_snapshot: string; target_sets: number; target_reps: number; sort_order: number }[];
};

if (!globalThis.__mockTemplates) globalThis.__mockTemplates = [];
const mockTemplates = globalThis.__mockTemplates;

// ════════════════════════════════════════════════════════
// START BLANK WORKOUT
// ════════════════════════════════════════════════════════

export async function startBlankWorkout(name?: string): Promise<StartWorkoutResult | null> {
  if (DEMO_MODE) {
    const workoutId = uid();
    const workout = {
      id: workoutId,
      user_id: "mock-user",
      workout_day_id: null,
      import_session_name: name ?? "Freestyle workout",
      started_at: new Date().toISOString(),
      completed_at: null,
      notes: null,
      is_deload: false,
      created_at: new Date().toISOString(),
    };
    mockStore.set(workoutId, { workout, entries: [] });
    return { id: workoutId, workout, entries: [], suggestions: {}, tooHeavyFlags: {} };
  }

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
  if (DEMO_MODE) {
    const stored = mockStore.get(workoutId);
    if (!stored) return null;

    // Find exercise name from mock data
    let exerciseName = exerciseId;
    for (const exercises of Object.values(MOCK_EXERCISES)) {
      const ex = exercises.find((e) => e.id === exerciseId);
      if (ex) { exerciseName = ex.name; break; }
    }

    const entryId = uid();
    const sets = Array.from({ length: targetSets }, (_, i) => ({
      id: uid(),
      workout_exercise_entry_id: entryId,
      user_id: "mock-user",
      set_number: i + 1,
      weight_kg: null as number | null,
      reps: null as number | null,
      completed: false,
      is_warmup: false,
      too_heavy: false,
      too_heavy_reps: null as number | null,
      created_at: new Date().toISOString(),
    }));

    const entry: WorkoutExerciseEntry = {
      id: entryId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      workout_day_exercise_id: null,
      user_id: "mock-user",
      exercise: { id: exerciseId, user_id: "mock-user", name: exerciseName, created_at: new Date().toISOString() },
      set_entries: sets,
      created_at: new Date().toISOString(),
    };

    stored.entries.push(entry);
    return entry;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Insert the exercise entry
  const { data: entry, error: entryErr } = await supabase
    .from("workout_exercise_entries")
    .insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      workout_day_exercise_id: null,
      user_id: userId,
    })
    .select("*, exercise:exercises!workout_exercise_entries_exercise_id_fkey(*)")
    .single();

  if (entryErr || !entry) {
    const msg = `entry insert failed: ${entryErr?.message ?? "no data"} | ${entryErr?.details ?? ""} | hint: ${entryErr?.hint ?? ""}`;
    console.error("[addExerciseToWorkout]", msg);
    return { __error: msg };
  }

  // Insert blank sets — omit too_heavy/too_heavy_reps so DB defaults apply,
  // matching the same approach used by startWorkout.
  const setRows = Array.from({ length: targetSets }, (_, i) => ({
    workout_exercise_entry_id: entry.id as string,
    user_id: userId,
    set_number: i + 1,
    weight_kg: null as number | null,
    reps: null as number | null,
    completed: false,
    is_warmup: false,
  }));

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
  if (DEMO_MODE) {
    for (const stored of mockStore.values()) {
      const idx = stored.entries.findIndex((e) => e.id === entryId);
      if (idx !== -1) { stored.entries.splice(idx, 1); return; }
    }
    return;
  }

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
  if (DEMO_MODE) {
    const stored = mockStore.get(workoutId);
    if (!stored) return null;
    const templateId = uid();
    const exercises = stored.entries.map((entry, i) => ({
      exercise_id: entry.exercise_id,
      exercise_name_snapshot: entry.exercise?.name ?? entry.exercise_id,
      target_sets: (entry.set_entries ?? []).filter((s) => !s.is_warmup).length || 3,
      target_reps: 8,
      sort_order: i,
    }));
    mockTemplates.push({
      id: templateId,
      name,
      last_used_at: null,
      created_at: new Date().toISOString(),
      exercises,
    });
    return templateId;
  }

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
  if (DEMO_MODE) {
    return mockTemplates.map((t) => ({
      id: t.id,
      user_id: "mock-user",
      name: t.name,
      last_used_at: t.last_used_at,
      created_at: t.created_at,
      exercise_count: t.exercises.length,
      exercise_names: t.exercises.slice(0, 4).map((e) => e.exercise_name_snapshot),
    }));
  }

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
  if (DEMO_MODE) {
    const t = mockTemplates.find((t) => t.id === templateId);
    if (!t) return null;
    return {
      id: t.id,
      user_id: "mock-user",
      name: t.name,
      last_used_at: t.last_used_at,
      created_at: t.created_at,
      exercises: t.exercises.map((e, i) => ({
        id: `${t.id}-ex-${i}`,
        template_id: t.id,
        user_id: "mock-user",
        exercise_id: e.exercise_id,
        exercise_name_snapshot: e.exercise_name_snapshot,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        sort_order: e.sort_order,
      })),
    };
  }

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
  if (DEMO_MODE) {
    const t = mockTemplates.find((t) => t.id === templateId);
    if (t) t.name = name;
    return;
  }
  const supabase = await db();
  const userId = await getUserId();
  await supabase.from("workout_templates").update({ name }).eq("id", templateId).eq("user_id", userId);
}

export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = mockTemplates.findIndex((t) => t.id === templateId);
    if (idx !== -1) mockTemplates.splice(idx, 1);
    return;
  }
  const supabase = await db();
  const userId = await getUserId();
  await supabase.from("workout_templates").delete().eq("id", templateId).eq("user_id", userId);
}

// ════════════════════════════════════════════════════════
// START WORKOUT FROM TEMPLATE
// ════════════════════════════════════════════════════════

export async function startWorkoutFromTemplate(templateId: string): Promise<StartWorkoutResult | null> {
  if (DEMO_MODE) {
    const t = mockTemplates.find((t) => t.id === templateId);
    if (!t) return null;
    t.last_used_at = new Date().toISOString();

    const workoutId = uid();
    const workout = {
      id: workoutId,
      user_id: "mock-user",
      workout_day_id: null,
      import_session_name: t.name,
      started_at: new Date().toISOString(),
      completed_at: null,
      notes: null,
      is_deload: false,
      created_at: new Date().toISOString(),
    };

    const entries = t.exercises.map((ex) => {
      const entryId = uid();
      const sets = Array.from({ length: ex.target_sets }, (_, i) => ({
        id: uid(),
        workout_exercise_entry_id: entryId,
        user_id: "mock-user",
        set_number: i + 1,
        weight_kg: null as number | null,
        reps: null as number | null,
        completed: false,
        is_warmup: false,
        too_heavy: false,
        too_heavy_reps: null as number | null,
        created_at: new Date().toISOString(),
      }));
      return {
        id: entryId,
        workout_id: workoutId,
        exercise_id: ex.exercise_id,
        workout_day_exercise_id: null,
        user_id: "mock-user",
        exercise: { id: ex.exercise_id, user_id: "mock-user", name: ex.exercise_name_snapshot, created_at: new Date().toISOString() },
        set_entries: sets,
        created_at: new Date().toISOString(),
      } satisfies WorkoutExerciseEntry;
    });

    mockStore.set(workoutId, { workout, entries });
    return { id: workoutId, workout, entries, suggestions: {}, tooHeavyFlags: {} };
  }

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

  // Create a blank workout
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      workout_day_id: null,
      import_session_name: (template as { name: string }).name,
      is_deload: false,
    })
    .select("*")
    .single();

  if (wErr || !workout) return null;

  const workoutId = workout.id as string;

  // Create entries + sets + fetch suggestions in parallel per exercise
  const [entryResults, prevResults] = await Promise.all([
    Promise.all(
      templateExercises.map((ex) =>
        supabase
          .from("workout_exercise_entries")
          .insert({
            workout_id: workoutId,
            exercise_id: ex.exercise_id,
            workout_day_exercise_id: null,
            user_id: userId,
          })
          .select("*, exercise:exercises!workout_exercise_entries_exercise_id_fkey(*)")
          .single()
      )
    ),
    Promise.all(
      templateExercises.map((ex) =>
        getPreviousResultsInternal(supabase, userId, ex.exercise_id)
      )
    ),
  ]);

  // Batch-insert all sets
  const allSetRows: object[] = [];
  const entryObjs: WorkoutExerciseEntry[] = [];

  for (let i = 0; i < templateExercises.length; i++) {
    const { data: entry } = entryResults[i];
    if (!entry) continue;
    const ex = templateExercises[i];
    const entryId = entry.id as string;

    const setRows = Array.from({ length: ex.target_sets }, (_, j) => ({
      workout_exercise_entry_id: entryId,
      user_id: userId,
      set_number: j + 1,
      weight_kg: null as number | null,
      reps: null as number | null,
      completed: false,
      is_warmup: false,
    }));
    allSetRows.push(...setRows);
    entryObjs.push(entry as WorkoutExerciseEntry);
  }

  const { data: insertedSets } = await supabase.from("set_entries").insert(allSetRows).select("*");
  const setsByEntry: Record<string, WorkoutExerciseEntry["set_entries"]> = {};
  for (const s of insertedSets ?? []) {
    const sid = (s as { workout_exercise_entry_id: string }).workout_exercise_entry_id;
    if (!setsByEntry[sid]) setsByEntry[sid] = [];
    setsByEntry[sid]!.push(s as NonNullable<WorkoutExerciseEntry["set_entries"]>[number]);
  }

  const entriesWithSets = entryObjs.map((e) => ({
    ...e,
    set_entries: setsByEntry[e.id] ?? [],
  }));

  // Build suggestions and tooHeavyFlags
  const exerciseIds = templateExercises.map((ex) => ex.exercise_id);
  const [suggestionResults, tooHeavyFlags] = await Promise.all([
    Promise.all(templateExercises.map((ex) => getSuggestedWeightInternal(supabase, userId, ex.exercise_id, ex.target_sets))),
    getLastTooHeavyFlags(supabase, userId, exerciseIds),
  ]);
  const suggestions: Record<string, number | null> = {};
  templateExercises.forEach((ex, i) => { suggestions[ex.exercise_id] = suggestionResults[i]; });

  // Mark template last used
  await supabase.from("workout_templates").update({ last_used_at: new Date().toISOString() }).eq("id", templateId);

  return {
    id: workoutId,
    workout: workout as StartWorkoutResult["workout"],
    entries: entriesWithSets,
    suggestions,
    tooHeavyFlags,
  };
}
