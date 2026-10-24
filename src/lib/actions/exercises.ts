"use server";

import type { ExerciseDefinition, ProgramExerciseAlternative } from "@/lib/types";
import { db, getDefaultEquipment, getUserId } from "./_shared";
import { matchesEquipment, summarizeEquipmentUsage, type EquipmentUsage } from "@/lib/equipment";
import { buildLibraryIndex, findDefinitionMatch, type LibraryIndex } from "@/lib/exerciseMatching";
import { exerciseSummary, type RuleSet } from "@/lib/setRules";

export async function getExerciseList() {
  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId)
    .order("name");

  return data ?? [];
}

/** Like getExerciseList but includes linked library metadata for badge display. */
export async function getExerciseListEnriched(): Promise<Array<{
  id: string;
  name: string;
  equipment_type?: string;
  primary_muscle?: string;
  is_bodyweight?: boolean;
}>> {
  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("exercises")
    .select("id, name, is_bodyweight, exercise_definition_id, definition:exercise_definitions(equipment_type, primary_muscle)")
    .eq("user_id", userId)
    .order("name");

  return (data ?? []).map((ex) => {
    const def = Array.isArray(ex.definition) ? ex.definition[0] : ex.definition;
    return {
      id: ex.id as string,
      name: ex.name as string,
      is_bodyweight: (ex.is_bodyweight as boolean | null) ?? false,
      equipment_type: (def as { equipment_type?: string } | null)?.equipment_type,
      primary_muscle: (def as { primary_muscle?: string } | null)?.primary_muscle,
    };
  });
}

/**
 * Merged exercise list for the Swap Exercise modal.
 * Returns user's own exercises (source: "user") plus any library exercises
 * they haven't logged yet (source: "library"), de-duped by normalized_name.
 */
export async function getExerciseListForSwap(): Promise<Array<{
  id: string;
  name: string;
  equipment_type?: string;
  primary_muscle?: string;
  is_bodyweight?: boolean;
  source: "user" | "library";
}>> {
  const supabase = await db();
  const userId = await getUserId();

  const [userResult, libraryResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, is_bodyweight, definition:exercise_definitions(equipment_type, primary_muscle, normalized_name)")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("exercise_definitions")
      .select("id, name, normalized_name, equipment_type, primary_muscle, is_bodyweight")
      .order("name"),
  ]);

  if (userResult.error) console.error("[getExerciseListForSwap] exercises error:", userResult.error);
  if (libraryResult.error) console.error("[getExerciseListForSwap] exercise_definitions error:", libraryResult.error);

  const userExercises = userResult.data;
  const libraryExercises = libraryResult.data;

  const userItems = (userExercises ?? []).map((ex) => {
    const def = Array.isArray(ex.definition) ? ex.definition[0] : ex.definition;
    const defTyped = def as { equipment_type?: string; primary_muscle?: string; normalized_name?: string } | null;
    return {
      id: ex.id as string,
      name: ex.name as string,
      is_bodyweight: (ex.is_bodyweight as boolean | null) ?? false,
      equipment_type: defTyped?.equipment_type,
      primary_muscle: defTyped?.primary_muscle,
      _normalized: defTyped?.normalized_name ?? (ex.name as string).toLowerCase().trim(),
      source: "user" as const,
    };
  });

  const userNormalizedNames = new Set(userItems.map((u) => u._normalized));

  const libraryItems = (libraryExercises ?? [])
    .filter((lib) => !userNormalizedNames.has(lib.normalized_name as string))
    .map((lib) => ({
      id: lib.id as string,
      name: lib.name as string,
      is_bodyweight: (lib.is_bodyweight as boolean) ?? false,
      equipment_type: lib.equipment_type as string,
      primary_muscle: lib.primary_muscle as string,
      source: "library" as const,
    }));

  return [
    ...userItems.map(({ _normalized: _n, ...rest }) => rest),
    ...libraryItems,
  ];
}

/**
 * When a user picks a library exercise they've never logged, we need a real
 * row in their exercises table. This finds or creates it and links to the library.
 * Returns the user-scoped exercise id to use in workout_exercise_entries.
 */
export async function getOrCreateExerciseFromLibrary(
  libraryDefinitionId: string,
  exerciseName: string
): Promise<string | null> {
  const supabase = await db();
  const userId = await getUserId();
  const normalized = exerciseName.toLowerCase().trim();

  // Check if already exists
  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("user_id", userId)
    .eq("normalized_name", normalized)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  // Create new exercise row linked to library
  const { data: created } = await supabase
    .from("exercises")
    .insert({ user_id: userId, name: exerciseName, normalized_name: normalized, exercise_definition_id: libraryDefinitionId })
    .select("id")
    .single();

  return created?.id ?? null;
}

/**
 * Tools this exercise has been performed with in completed workouts, most recent first.
 * Used by the progress page to pick which tool's history to chart.
 */
export async function getExerciseEquipmentUsage(exerciseId: string): Promise<EquipmentUsage[]> {
  const supabase = await db();
  const userId = await getUserId();

  const [{ data }, defaults] = await Promise.all([
    supabase
      .from("workout_exercise_entries")
      .select("equipment_type, workout:workouts!inner(started_at, completed_at)")
      .eq("exercise_id", exerciseId)
      .eq("user_id", userId)
      .not("workout.completed_at", "is", null),
    getDefaultEquipment(supabase, userId, [exerciseId]),
  ]);

  const rows = (data ?? []) as unknown as {
    equipment_type: string | null;
    workout: { started_at: string; completed_at: string | null } | null;
  }[];
  return summarizeEquipmentUsage(
    rows
      .filter((r) => r.workout?.completed_at)
      .map((r) => ({ equipment_type: r.equipment_type, started_at: r.workout!.started_at })),
    defaults[exerciseId]
  );
}

/**
 * Per-date top set / volume for an exercise done with `equipment`
 * (defaults to the exercise's library tool). History is tracked per tool.
 */
export async function getExerciseProgress(exerciseId: string, equipment?: string | null) {
  const supabase = await db();
  const userId = await getUserId();
  const defaults = await getDefaultEquipment(supabase, userId, [exerciseId]);

  // All sets for this exercise in finished workouts; setRules decides which count (completed work sets).
  const { data } = await supabase
    .from("set_entries")
    .select(
      "weight_kg, reps, completed, is_warmup, workout_exercise_entry:workout_exercise_entries!inner(exercise_id, equipment_type, workout:workouts!inner(started_at, completed_at))"
    )
    .eq("workout_exercise_entry.exercise_id", exerciseId)
    .eq("user_id", userId)
    .or("weight_kg.not.is.null,reps.not.is.null");

  if (!data || data.length === 0) return [];

  const setsByDate = new Map<string, RuleSet[]>();
  for (const row of data) {
    const we = row.workout_exercise_entry as unknown as {
      equipment_type: string | null;
      workout: { started_at: string; completed_at: string | null };
    };
    if (!we?.workout?.completed_at) continue;
    if (!matchesEquipment(we.equipment_type, equipment, defaults[exerciseId])) continue;
    const date = we.workout.started_at.split("T")[0];
    const list = setsByDate.get(date) ?? [];
    list.push(row as RuleSet);
    setsByDate.set(date, list);
  }

  // Per date: top set, volume and number of completed work sets
  return Array.from(setsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, sets]) => {
      const { top, volume, workSets } = exerciseSummary(sets);
      return top ? [{ date, weight_kg: top.weight_kg, reps: top.reps, sets: workSets, volume }] : [];
    });
}

export async function getExerciseDefinitions(filters?: {
  primaryMuscle?: string;
  equipmentType?: string;
  movementPattern?: string;
  search?: string;
}): Promise<ExerciseDefinition[]> {
  const supabase = await db();
  let query = supabase
    .from("exercise_definitions")
    .select("*")
    .order("name");

  if (filters?.primaryMuscle) {
    query = query.eq("primary_muscle", filters.primaryMuscle);
  }
  if (filters?.equipmentType) {
    query = query.eq("equipment_type", filters.equipmentType);
  }
  if (filters?.movementPattern) {
    query = query.eq("movement_pattern", filters.movementPattern);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data } = await query;
  return (data ?? []) as ExerciseDefinition[];
}

// The library is global and only changes with migrations: cache the index per server
// process for a few minutes instead of re-reading ~300 rows for every link.
const LIBRARY_TTL_MS = 5 * 60 * 1000;
let libraryCache: { at: number; index: LibraryIndex<ExerciseDefinition> } | null = null;

async function getLibraryIndex(
  supabase: Awaited<ReturnType<typeof db>>
): Promise<LibraryIndex<ExerciseDefinition>> {
  if (libraryCache && Date.now() - libraryCache.at < LIBRARY_TTL_MS) return libraryCache.index;
  const { data } = await supabase.from("exercise_definitions").select("*");
  const index = buildLibraryIndex((data ?? []) as ExerciseDefinition[]);
  if (data?.length) libraryCache = { at: Date.now(), index };
  return index;
}

/**
 * Given a display name, find the matching exercise_definition (name or alias, spelling-
 * insensitive — see src/lib/exerciseMatching.ts). Returns null when none or ambiguous.
 */
export async function matchExerciseToLibrary(
  name: string
): Promise<ExerciseDefinition | null> {
  const supabase = await db();
  return findDefinitionMatch(name, await getLibraryIndex(supabase));
}

/**
 * Internal: link a newly created exercise to the library, reusing an existing supabase client.
 * Only fires when exercise_definition_id is not already set.
 * Silently skips if no matching definition is found. Returns whether it linked.
 */
export async function linkExerciseToLibraryInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string,
  exerciseName: string
): Promise<boolean> {
  const def = findDefinitionMatch(exerciseName, await getLibraryIndex(supabase));
  if (!def) return false;

  const { error } = await supabase
    .from("exercises")
    .update({
      exercise_definition_id: def.id,
      is_bodyweight: def.is_bodyweight,
      is_main_lift: def.is_main_lift,
      category: def.equipment_type,
    })
    .eq("id", exerciseId)
    .eq("user_id", userId);
  return !error;
}

/** User exercises the library doesn't recognize (no definition) — shown in Settings. */
export async function getUnlinkedExercises(): Promise<{ id: string; name: string }[]> {
  const supabase = await db();
  const userId = await getUserId();
  const { data } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId)
    .is("exercise_definition_id", null)
    .order("name");
  return (data ?? []) as { id: string; name: string }[];
}

/**
 * Try to link every unlinked user exercise with the current library + matching rules.
 * Run after library updates (Settings → Exercise library → Re-link).
 */
export async function relinkAllExercises(): Promise<{ linked: number; remaining: number }> {
  const supabase = await db();
  const userId = await getUserId();
  libraryCache = null; // pick up a just-applied migration
  const unlinked = await getUnlinkedExercises();

  let linked = 0;
  for (const ex of unlinked) {
    if (await linkExerciseToLibraryInternal(supabase, userId, ex.id, ex.name)) linked++;
  }
  return { linked, remaining: unlinked.length - linked };
}

/**
 * After creating or finding a user exercise, attempt to link it to the library.
 * Updates exercise_definition_id and is_bodyweight if a match is found.
 */
export async function linkExerciseToLibrary(exerciseId: string, exerciseName: string): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();
  await linkExerciseToLibraryInternal(supabase, userId, exerciseId, exerciseName);
}

/** Fetch pre-defined alternatives for a program exercise slot */
export async function getExerciseAlternatives(
  programExerciseId: string
): Promise<ProgramExerciseAlternative[]> {
  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("program_exercise_alternatives")
    .select("*, exercise:exercises(id, name)")
    .eq("program_exercise_id", programExerciseId)
    .eq("user_id", userId)
    .order("sort_order");

  return (data ?? []) as ProgramExerciseAlternative[];
}

/**
 * Creates a user exercise with no library link — a fully custom movement.
 * Returns the new exercise id, or null on failure.
 */
export async function createCustomExercise(name: string): Promise<string | null> {
  const supabase = await db();
  const userId = await getUserId();
  const normalized = name.toLowerCase().trim().replace(/\s+/g, " ");

  // Return existing if name already used
  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("user_id", userId)
    .eq("normalized_name", normalized)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  // Try to auto-link to library before creating
  const { data: def } = await supabase
    .from("exercise_definitions")
    .select("id, is_bodyweight, is_main_lift, equipment_type")
    .or(`normalized_name.eq.${normalized},aliases.cs.{${normalized}}`)
    .limit(1)
    .maybeSingle();

  const { data: created } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name,
      normalized_name: normalized,
      ...(def
        ? {
            exercise_definition_id: def.id,
            is_bodyweight: def.is_bodyweight,
            is_main_lift: def.is_main_lift,
            category: def.equipment_type,
          }
        : {}),
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

/** Add an alternative exercise to a program slot */
export async function addProgramExerciseAlternative(
  programExerciseId: string,
  exerciseId: string
): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("program_exercise_alternatives")
    .upsert(
      { program_exercise_id: programExerciseId, exercise_id: exerciseId, user_id: userId },
      { onConflict: "program_exercise_id,exercise_id", ignoreDuplicates: true }
    );
}

/** Remove an alternative exercise from a program slot */
export async function removeProgramExerciseAlternative(
  programExerciseId: string,
  exerciseId: string
): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("program_exercise_alternatives")
    .delete()
    .eq("program_exercise_id", programExerciseId)
    .eq("exercise_id", exerciseId)
    .eq("user_id", userId);
}
