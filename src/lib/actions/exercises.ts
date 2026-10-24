"use server";

import type { ExerciseDefinition, ProgramExerciseAlternative } from "@/lib/types";
import { DEMO_MODE, db, getDefaultEquipment, getUserId } from "./_shared";
import { matchesEquipment, summarizeEquipmentUsage, type EquipmentUsage } from "@/lib/equipment";
import { buildLibraryIndex, findDefinitionMatch, type LibraryIndex } from "@/lib/exerciseMatching";
import { MOCK_EXERCISES } from "./_mocks";
import { exerciseSummary, type RuleSet } from "@/lib/setRules";

function dedupMockExercises() {
  const all = Object.values(MOCK_EXERCISES).flat();
  const seen = new Set<string>();
  return all.filter((ex) => { if (seen.has(ex.id)) return false; seen.add(ex.id); return true; });
}

// Demo: bench press has also been done with dumbbells, to exercise the tool picker
const MOCK_EQUIPMENT_USAGE: Record<string, EquipmentUsage[]> = {
  "ex-bench": [
    { equipment_type: "barbell", label: "Barbell", last_used: "2026-03-02" },
    { equipment_type: "dumbbell", label: "Dumbbell", last_used: "2026-02-23" },
  ],
};

const MOCK_PROGRESS_BY_EQUIPMENT: Record<string, { date: string; weight_kg: number; reps: number; sets: number; volume: number }[]> = {
  "ex-bench:dumbbell": [
    { date: "2026-01-29", weight_kg: 32, reps: 8, sets: 3, volume: 768 },
    { date: "2026-02-12", weight_kg: 34, reps: 8, sets: 3, volume: 816 },
    { date: "2026-02-23", weight_kg: 36, reps: 7, sets: 3, volume: 756 },
  ],
};

function getExerciseProgressMock(exerciseId: string, equipment?: string | null) {
  if (equipment && MOCK_PROGRESS_BY_EQUIPMENT[`${exerciseId}:${equipment}`]) {
    return MOCK_PROGRESS_BY_EQUIPMENT[`${exerciseId}:${equipment}`];
  }
  const MOCK_PROGRESS: Record<string, { date: string; weight_kg: number; reps: number; sets: number; volume: number }[]> = {
    "ex-bench": [
      { date: "2026-01-05", weight_kg: 90,   reps: 5, sets: 4, volume: 1800 },
      { date: "2026-01-12", weight_kg: 92.5, reps: 5, sets: 4, volume: 1850 },
      { date: "2026-01-19", weight_kg: 95,   reps: 5, sets: 4, volume: 1900 },
      { date: "2026-01-26", weight_kg: 97.5, reps: 4, sets: 4, volume: 1560 },
      { date: "2026-02-02", weight_kg: 97.5, reps: 5, sets: 4, volume: 1950 },
      { date: "2026-02-09", weight_kg: 100,  reps: 5, sets: 4, volume: 2000 },
      { date: "2026-02-16", weight_kg: 100,  reps: 4, sets: 4, volume: 1600 },
      { date: "2026-03-02", weight_kg: 100,  reps: 5, sets: 4, volume: 2000 },
    ],
    "ex-bsquat": [
      { date: "2026-01-03", weight_kg: 100,  reps: 5, sets: 5, volume: 2000 },
      { date: "2026-01-10", weight_kg: 105,  reps: 5, sets: 5, volume: 2100 },
      { date: "2026-01-17", weight_kg: 110,  reps: 5, sets: 5, volume: 2200 },
      { date: "2026-01-24", weight_kg: 112.5, reps: 5, sets: 5, volume: 2250 },
      { date: "2026-01-31", weight_kg: 115,  reps: 4, sets: 5, volume: 1840 },
      { date: "2026-02-07", weight_kg: 115,  reps: 5, sets: 5, volume: 2300 },
      { date: "2026-02-21", weight_kg: 117.5, reps: 5, sets: 5, volume: 2350 },
      { date: "2026-03-07", weight_kg: 120,  reps: 5, sets: 5, volume: 2400 },
    ],
    "ex-snatch": [
      { date: "2026-01-06", weight_kg: 60,   reps: 2, sets: 3, volume: 480 },
      { date: "2026-01-13", weight_kg: 62.5, reps: 2, sets: 3, volume: 500 },
      { date: "2026-01-20", weight_kg: 65,   reps: 2, sets: 3, volume: 520 },
      { date: "2026-02-03", weight_kg: 67.5, reps: 2, sets: 3, volume: 540 },
      { date: "2026-02-17", weight_kg: 70,   reps: 2, sets: 3, volume: 560 },
    ],
    "ex-rdl": [
      { date: "2026-01-08", weight_kg: 70,   reps: 8, sets: 3, volume: 1680 },
      { date: "2026-01-15", weight_kg: 75,   reps: 8, sets: 3, volume: 1800 },
      { date: "2026-01-22", weight_kg: 77.5, reps: 8, sets: 3, volume: 1860 },
      { date: "2026-02-05", weight_kg: 80,   reps: 8, sets: 3, volume: 1920 },
    ],
  };
  return MOCK_PROGRESS[exerciseId] ?? [];
}

export async function getExerciseList() {
  if (DEMO_MODE) {
    return dedupMockExercises()
      .map((ex) => ({ id: ex.id, name: ex.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

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
  if (DEMO_MODE) {
    return dedupMockExercises()
      .map((ex) => ({ id: ex.id, name: ex.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

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
  if (DEMO_MODE) {
    return dedupMockExercises()
      .map((ex) => ({ id: ex.id, name: ex.name, source: "user" as const }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

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
  if (DEMO_MODE) return null;

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
  if (DEMO_MODE) return MOCK_EQUIPMENT_USAGE[exerciseId] ?? [];

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
  if (DEMO_MODE) return getExerciseProgressMock(exerciseId, equipment);

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
  if (DEMO_MODE) return [];

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
  if (DEMO_MODE) return null;

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
  if (DEMO_MODE) return [];

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
  if (DEMO_MODE) return { linked: 0, remaining: 0 };

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
  if (DEMO_MODE) return;

  const supabase = await db();
  const userId = await getUserId();
  await linkExerciseToLibraryInternal(supabase, userId, exerciseId, exerciseName);
}

/** Fetch pre-defined alternatives for a program exercise slot */
export async function getExerciseAlternatives(
  programExerciseId: string
): Promise<ProgramExerciseAlternative[]> {
  if (DEMO_MODE) return [];

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
  if (DEMO_MODE) {
    const id = `custom-${Date.now()}`;
    return id;
  }

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
  if (DEMO_MODE) return;

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
  if (DEMO_MODE) return;

  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("program_exercise_alternatives")
    .delete()
    .eq("program_exercise_id", programExerciseId)
    .eq("exercise_id", exerciseId)
    .eq("user_id", userId);
}
