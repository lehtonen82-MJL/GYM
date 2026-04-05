"use server";

import type {
  Program,
  ProgramDay,
  ProgramExercise,
  ProgramMode,
  Workout,
  WorkoutBonusCardio,
  WorkoutDay,
  WorkoutExerciseEntry,
} from "@/lib/types";
import { parseSchemePrescription } from "@/lib/programParser";

// ── Mode detection ──────────────────────────────────────

const DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "your-supabase-url";

// ── Supabase helpers (only used in production) ──────────

async function db() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

async function getUserId(): Promise<string> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── Mock data (demo mode only) ──────────────────────────

const MOCK_DAYS: WorkoutDay[] = [
  { id: "day-0", program_id: "prog-demo-1", user_id: "mock-user", name: "Chest", day_of_week: 0, day_label: "SU", created_at: "" },
  { id: "day-2", program_id: "prog-demo-1", user_id: "mock-user", name: "Oly",   day_of_week: 2, day_label: "TI", created_at: "" },
  { id: "day-4", program_id: "prog-demo-1", user_id: "mock-user", name: "Back",  day_of_week: 4, day_label: "TO", created_at: "" },
  { id: "day-6", program_id: "prog-demo-1", user_id: "mock-user", name: "Legs",  day_of_week: 6, day_label: "LA", created_at: "" },
];

const MOCK_EXERCISES: Record<
  string,
  { id: string; name: string; target_sets: number; target_reps: number }[]
> = {
  "day-0": [
    { id: "ex-bench",    name: "Bench Press",    target_sets: 3, target_reps: 5  },
    { id: "ex-incline",  name: "Incline Bench",  target_sets: 3, target_reps: 8  },
    { id: "ex-dips",     name: "Dips",           target_sets: 3, target_reps: 10 },
    { id: "ex-fly",      name: "Fly",            target_sets: 3, target_reps: 12 },
    { id: "ex-triceps",  name: "Triceps",        target_sets: 3, target_reps: 12 },
    { id: "ex-lightrow", name: "Light Row",      target_sets: 3, target_reps: 12 },
  ],
  "day-2": [
    { id: "ex-snatch", name: "Snatch",       target_sets: 5, target_reps: 2  },
    { id: "ex-cj",     name: "Clean & Jerk", target_sets: 5, target_reps: 2  },
    { id: "ex-calves", name: "Calves",       target_sets: 4, target_reps: 15 },
  ],
  "day-4": [
    { id: "ex-pullups",  name: "Pull-ups / Lat Pulldown", target_sets: 4, target_reps: 8  },
    { id: "ex-row",      name: "Row",       target_sets: 4, target_reps: 8  },
    { id: "ex-facepull", name: "Face Pull", target_sets: 3, target_reps: 15 },
    { id: "ex-rdl",      name: "RDL",       target_sets: 3, target_reps: 8  },
  ],
  "day-6": [
    { id: "ex-bsquat",  name: "Back Squat",  target_sets: 5, target_reps: 5  },
    { id: "ex-fsquat",  name: "Front Squat", target_sets: 3, target_reps: 5  },
    { id: "ex-legcurl", name: "Leg Curl",    target_sets: 3, target_reps: 10 },
    { id: "ex-calves2", name: "Calves",      target_sets: 4, target_reps: 15 },
  ],
};

const MOCK_PREV: Record<string, { weight_kg: number; reps: number }[]> = {
  "ex-bench":   [{ weight_kg: 100, reps: 5 }, { weight_kg: 100, reps: 5 }, { weight_kg: 100, reps: 4 }],
  "ex-snatch":  [{ weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }],
  "ex-cj":      [{ weight_kg: 85, reps: 2 }, { weight_kg: 85, reps: 2 }, { weight_kg: 85, reps: 2 }],
  "ex-bsquat":  [{ weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }],
  "ex-pullups": [{ weight_kg: 0, reps: 8 }, { weight_kg: 0, reps: 8 }, { weight_kg: 0, reps: 7 }],
  "ex-rdl":     [{ weight_kg: 80, reps: 8 }, { weight_kg: 80, reps: 8 }],
};

type MockStore = { workout: Workout; entries: WorkoutExerciseEntry[] };
type ValidationExerciseRow = {
  exercise_name_snapshot?: string | null;
  target_sets?: number | null;
};
declare const globalThis: typeof global & {
  __ws?: Map<string, MockStore>;
  __nid?: number;
  __bonusCardio?: Map<string, WorkoutBonusCardio>;
  __mockPrograms?: Program[];
  __mockProgramDays?: ProgramDay[];
  __mockProgramExercises?: ProgramExercise[];
};
if (!globalThis.__ws) globalThis.__ws = new Map();
if (!globalThis.__nid) globalThis.__nid = 1;
if (!globalThis.__bonusCardio) globalThis.__bonusCardio = new Map();
const mockStore = globalThis.__ws;
const mockBonusCardio = globalThis.__bonusCardio;
function uid() { return `mock-${globalThis.__nid!++}`; }

// ════════════════════════════════════════════════════════
// TODAY
// ════════════════════════════════════════════════════════

export async function getTodayWorkoutDay(): Promise<WorkoutDay | null> {
  if (DEMO_MODE) {
    const preferredProgramId = getDemoPreferredProgramId();
    if (!preferredProgramId) return null;
    const dow = new Date().getDay();
    return (
      getDemoProgramDays(preferredProgramId)
        .map(demoDayToWorkoutDay)
        .find((d) => d.day_of_week === dow) ?? null
    );
  }

  const supabase = await db();
  const userId = await getUserId();
  const dow = new Date().getDay();

  // Get active program first
  const activeProgram = await getActiveProgram();
  if (!activeProgram) return null;

  const { data } = await supabase
    .from("workout_days")
    .select("*")
    .eq("user_id", userId)
    .eq("program_id", activeProgram.id)
    .eq("day_of_week", dow)
    .limit(1)
    .single();

  return data ?? null;
}

export async function getWorkoutDaysForProgram(): Promise<WorkoutDay[]> {
  if (DEMO_MODE) {
    const preferredProgramId = getDemoPreferredProgramId();
    if (!preferredProgramId) return [];
    return getDemoProgramDays(preferredProgramId).map(demoDayToWorkoutDay);
  }

  const supabase = await db();
  const userId = await getUserId();

  // Get active program first
  const activeProgram = await getActiveProgram();
  if (activeProgram) {
    const { data: activeDays } = await supabase
      .from("workout_days")
      .select("*")
      .eq("user_id", userId)
      .eq("program_id", activeProgram.id)
      .order("day_order");

    if (activeDays && activeDays.length > 0) {
      return activeDays;
    }
  }

  // Fallback: if no active program has days, choose one program (newest with days).
  const { data: programs } = await supabase
    .from("programs")
    .select("id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  for (const program of programs ?? []) {
    const { data: candidateDays } = await supabase
      .from("workout_days")
      .select("*")
      .eq("user_id", userId)
      .eq("program_id", program.id)
      .order("day_order");

    if (candidateDays && candidateDays.length > 0) {
      return candidateDays;
    }
  }

  return [];
}

export async function getLatestUnfinishedWorkout(): Promise<Workout | null> {
  if (DEMO_MODE) {
    const unfinished = Array.from(mockStore.values())
      .map((stored) => stored.workout)
      .filter((workout) => !workout.completed_at)
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
    return unfinished[0] ?? null;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Workout | null) ?? null;
}

// ════════════════════════════════════════════════════════
// START WORKOUT
// ════════════════════════════════════════════════════════

export type StartWorkoutResult = {
  id: string;
  workout: Workout;
  entries: WorkoutExerciseEntry[];
  suggestions: Record<string, number | null>;
};

async function buildStartWorkoutResultFromExisting(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  workout: Workout
): Promise<StartWorkoutResult | null> {
  const { data: entriesData } = await supabase
    .from("workout_exercise_entries")
    .select(
      "*, exercise:exercises(*), workout_day_exercise:workout_day_exercises(*, exercise:exercises(*)), set_entries:set_entries(*)"
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
      const weight = await getSuggestedWeightInternal(supabase, userId, entry.exercise_id, targetSets);
      return [entry.exercise_id, weight] as [string, number | null];
    })
  );
  for (const [exerciseId, weight] of suggestionPairs) {
    suggestions[exerciseId] = weight;
  }

  return {
    id: workout.id,
    workout,
    entries,
    suggestions,
  };
}

export async function startWorkout(
  workoutDayId: string
): Promise<StartWorkoutResult | null> {
  if (DEMO_MODE) return startWorkoutMock(workoutDayId);

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
    .insert({ user_id: userId, workout_day_id: workoutDayId })
    .select("*")
    .single();
  if (wErr || !workout) return null;
  workout.workout_day = day;

  // 3. Get exercises — try legacy workout_day_exercises first, fall back to program_exercises.
  // This handles both old data (wde table) and programs built/imported via the program builder
  // (which stores exercises in program_exercises, not workout_day_exercises).
  type WdeRow = {
    id: string;
    exercise_id: string;
    target_sets: number;
    target_reps?: number;
    scheme_text?: string;
    exercise: unknown;
  };
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

  // 4. Create all exercise entries in parallel
  const entryResults = await Promise.all(
    resolvedWdes.map((wde) =>
      supabase
        .from("workout_exercise_entries")
        .insert({
          workout_id: workout.id,
          exercise_id: wde.exercise_id,
          workout_day_exercise_id: wde.id,
          user_id: userId,
        })
        .select("*")
        .single()
    )
  );

  // 5. Collect all set rows and batch-insert in a single query
  type SetRow = {
    workout_exercise_entry_id: string;
    user_id: string;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    completed: boolean;
  };
  const allSetRows: SetRow[] = [];
  const entryWdeMap: Array<{ entry: Record<string, unknown>; wde: WdeRow }> = [];

  for (let i = 0; i < resolvedWdes.length; i++) {
    const { data: entry } = entryResults[i];
    if (!entry) continue;
    const wde = resolvedWdes[i];
    const prescription = parseSchemePrescription(wde.scheme_text);
    const setCount = prescription.length > 0 ? prescription.length : wde.target_sets;
    for (let j = 0; j < setCount; j++) {
      allSetRows.push({
        workout_exercise_entry_id: entry.id as string,
        user_id: userId,
        set_number: j + 1,
        weight_kg: prescription[j]?.weightKg ?? null,
        reps: prescription[j]?.reps ?? null,
        completed: false,
      });
    }
    entryWdeMap.push({ entry: entry as Record<string, unknown>, wde });
  }

  // Single round-trip for all sets
  const { data: allSets } = await supabase
    .from("set_entries")
    .insert(allSetRows)
    .select("*")
    .order("set_number");

  // Group sets by entry id
  const setsByEntryId: Record<string, unknown[]> = {};
  for (const s of allSets ?? []) {
    const eid = (s as { workout_exercise_entry_id: string }).workout_exercise_entry_id;
    if (!setsByEntryId[eid]) setsByEntryId[eid] = [];
    setsByEntryId[eid].push(s);
  }

  // 6. Fetch all suggestions in parallel — single client, no re-auth per exercise
  const suggestionResults = await Promise.all(
    entryWdeMap.map(({ wde }) =>
      getSuggestedWeightInternal(supabase, userId, wde.exercise_id, wde.target_sets)
    )
  );

  const entries: WorkoutExerciseEntry[] = [];
  const suggestions: Record<string, number | null> = {};

  for (let i = 0; i < entryWdeMap.length; i++) {
    const { entry, wde } = entryWdeMap[i];
    entries.push({
      ...(entry as WorkoutExerciseEntry),
      exercise: wde.exercise as WorkoutExerciseEntry["exercise"],
      workout_day_exercise: wde as WorkoutExerciseEntry["workout_day_exercise"],
      set_entries: (setsByEntryId[entry.id as string] ?? []) as WorkoutExerciseEntry["set_entries"],
    });
    suggestions[wde.exercise_id] = suggestionResults[i];
  }

  return { id: workout.id, workout, entries, suggestions };
}

function startWorkoutMock(workoutDayId: string): StartWorkoutResult | null {
  const day = MOCK_PROGRAM_DAYS.find((d) => d.id === workoutDayId);
  if (!day) return null;

  const existing = Array.from(mockStore.values()).find(
    (stored) =>
      stored.workout.workout_day_id === workoutDayId &&
      !stored.workout.completed_at
  );

  if (existing) {
    const suggestions: Record<string, number | null> = {};
    for (const entry of existing.entries) {
      const targetSets =
        entry.workout_day_exercise?.target_sets ?? entry.set_entries?.length ?? 1;
      const prev = MOCK_PREV[entry.exercise_id];
      if (!prev) {
        suggestions[entry.exercise_id] = null;
        continue;
      }
      const maxW = Math.max(...prev.map((s) => s.weight_kg));
      suggestions[entry.exercise_id] =
        prev.length >= targetSets ? maxW + 2.5 : maxW;
    }

    return {
      id: existing.workout.id,
      workout: existing.workout,
      entries: existing.entries,
      suggestions,
    };
  }

  const workoutId = uid();
  const exercises = MOCK_PROGRAM_EXERCISES
    .filter((ex) => ex.workout_day_id === workoutDayId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ex) => ({
      id: ex.id,
      name: ex.exercise_name_snapshot,
      target_sets: ex.target_sets ?? 3,
      target_reps: parseInt(ex.target_reps_text ?? "5", 10) || 5,
      scheme_text: ex.scheme_text,
    }));

  const entries: WorkoutExerciseEntry[] = exercises.map((ex) => {
    const entryId = uid();
    const wdeId = uid();
    const prescription = parseSchemePrescription(ex.scheme_text);
    const setCount = prescription.length > 0 ? prescription.length : ex.target_sets;
    const sets = Array.from({ length: setCount }, (_, i) => ({
      id: uid(),
      workout_exercise_entry_id: entryId,
      user_id: "mock-user",
      set_number: i + 1,
      weight_kg: prescription[i]?.weightKg ?? null,
      reps: prescription[i]?.reps ?? null,
      completed: false,
      created_at: new Date().toISOString(),
    }));
    return {
      id: entryId,
      workout_id: workoutId,
      exercise_id: ex.id,
      workout_day_exercise_id: wdeId,
      user_id: "mock-user",
      created_at: new Date().toISOString(),
      exercise: { id: ex.id, user_id: "mock-user", name: ex.name, created_at: "" },
      workout_day_exercise: {
        id: wdeId, workout_day_id: workoutDayId, exercise_id: ex.id,
        user_id: "mock-user", order_index: 0,
        target_sets: ex.target_sets, target_reps: ex.target_reps,
        created_at: "",
        exercise: { id: ex.id, user_id: "mock-user", name: ex.name, created_at: "" },
      },
      set_entries: sets,
    };
  });

  const workout: Workout = {
    id: workoutId, user_id: "mock-user", workout_day_id: workoutDayId,
    started_at: new Date().toISOString(), completed_at: null, notes: null,
    created_at: new Date().toISOString(), workout_day: demoDayToWorkoutDay(day),
  };

  const suggestions: Record<string, number | null> = {};
  for (const ex of exercises) {
    const prev = MOCK_PREV[ex.id];
    if (!prev) { suggestions[ex.id] = null; continue; }
    const maxW = Math.max(...prev.map((s) => s.weight_kg));
    suggestions[ex.id] = prev.length >= ex.target_sets ? maxW + 2.5 : maxW;
  }

  mockStore.set(workoutId, { workout, entries });
  return { id: workoutId, workout, entries, suggestions };
}

// ════════════════════════════════════════════════════════
// GET WORKOUT (for history view)
// ════════════════════════════════════════════════════════

export async function getWorkout(
  workoutId: string
): Promise<{ workout: Workout; entries: WorkoutExerciseEntry[] } | null> {
  if (DEMO_MODE) return mockStore.get(workoutId) ?? null;

  const supabase = await db();
  const userId = await getUserId();

  const { data: workout } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .single();
  if (!workout) return null;

  const { data: entries } = await supabase
    .from("workout_exercise_entries")
    .select(
      "*, exercise:exercises(*), workout_day_exercise:workout_day_exercises(*, exercise:exercises(*)), set_entries:set_entries(*)"
    )
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .order("created_at");

  // Sort set_entries by set_number within each entry
  for (const entry of entries ?? []) {
    entry.set_entries?.sort(
      (a: { set_number: number }, b: { set_number: number }) =>
        a.set_number - b.set_number
    );
  }

  return { workout, entries: entries ?? [] };
}

// ════════════════════════════════════════════════════════
// PREVIOUS RESULTS & SUGGESTIONS
// ════════════════════════════════════════════════════════

export async function getWorkoutBonusCardio(
  workoutId: string
): Promise<WorkoutBonusCardio | null> {
  if (DEMO_MODE) {
    return mockBonusCardio.get(workoutId) ?? null;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_bonus_cardio")
    .select("*")
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingBonusCardioTableError(error)) return null;
    throw new Error(`Failed to load bonus cardio: ${error.message}`);
  }

  return (data ?? null) as WorkoutBonusCardio | null;
}

export type SaveWorkoutBonusCardioInput = {
  machine_type?: "rower";
  distance_m?: number | null;
  duration_seconds?: number | null;
  pace_per_500_seconds?: number | null;
  calories?: number | null;
  stroke_rate?: number | null;
  avg_watts?: number | null;
  extra_metrics?: Record<string, number | null> | null;
};

export async function saveWorkoutBonusCardio(
  workoutId: string,
  input: SaveWorkoutBonusCardioInput
): Promise<WorkoutBonusCardio> {
  const payload = {
    machine_type: "rower" as const,
    distance_m: input.distance_m ?? null,
    duration_seconds: input.duration_seconds ?? null,
    pace_per_500_seconds: input.pace_per_500_seconds ?? null,
    calories: input.calories ?? null,
    stroke_rate: input.stroke_rate ?? null,
    avg_watts: input.avg_watts ?? null,
    extra_metrics: input.extra_metrics ?? {},
  };

  if (DEMO_MODE) {
    const existing = mockBonusCardio.get(workoutId);
    const next: WorkoutBonusCardio = {
      id: existing?.id ?? uid(),
      workout_id: workoutId,
      user_id: "mock-user",
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload,
    };
    mockBonusCardio.set(workoutId, next);
    return next;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_bonus_cardio")
    .upsert(
      {
        workout_id: workoutId,
        user_id: userId,
        ...payload,
      },
      { onConflict: "workout_id" }
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingBonusCardioTableError(error)) {
      console.warn(
        "[bonus-cardio] Table workout_bonus_cardio is missing in Supabase; skipping persistence."
      );
      return {
        id: uid(),
        workout_id: workoutId,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload,
      } as WorkoutBonusCardio;
    }
    throw new Error(`Failed to save bonus cardio: ${error.message}`);
  }
  return data as WorkoutBonusCardio;
}

function isMissingBonusCardioTableError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("workout_bonus_cardio") ||
    message.includes('relation "workout_bonus_cardio" does not exist')
  );
}
export async function getPreviousResults(
  exerciseId: string
): Promise<{ weight_kg: number; reps: number }[]> {
  if (DEMO_MODE) return MOCK_PREV[exerciseId] ?? [];

  const supabase = await db();
  const userId = await getUserId();
  return getPreviousResultsInternal(supabase, userId, exerciseId);
}

// Internal version that reuses an existing client — avoids repeated auth round-trips
async function getPreviousResultsInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string
): Promise<{ weight_kg: number; reps: number }[]> {
  const { data } = await supabase
    .from("workout_exercise_entries")
    .select(
      "workout_id, set_entries!inner(weight_kg, reps, completed, set_number)"
    )
    .eq("exercise_id", exerciseId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data?.set_entries) return [];

  return (data.set_entries as { weight_kg: number; reps: number; set_number: number }[])
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({ weight_kg: s.weight_kg ?? 0, reps: s.reps ?? 0 }));
}

export async function getSuggestedWeight(
  exerciseId: string,
  targetSets: number
): Promise<number | null> {
  const prev = await getPreviousResults(exerciseId);
  if (prev.length === 0) return null;
  const maxWeight = Math.max(...prev.map((s) => s.weight_kg ?? 0));
  const allCompleted = prev.length >= targetSets;
  return allCompleted ? maxWeight + 2.5 : maxWeight;
}

// Internal version that reuses an existing client — avoids repeated auth round-trips
async function getSuggestedWeightInternal(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseId: string,
  targetSets: number
): Promise<number | null> {
  const prev = await getPreviousResultsInternal(supabase, userId, exerciseId);
  if (prev.length === 0) return null;
  const maxWeight = Math.max(...prev.map((s) => s.weight_kg ?? 0));
  return prev.length >= targetSets ? maxWeight + 2.5 : maxWeight;
}

// ════════════════════════════════════════════════════════
// SET OPERATIONS
// ════════════════════════════════════════════════════════

export async function updateSet(
  setId: string,
  data: { weight_kg?: number; reps?: number; completed?: boolean }
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

// ════════════════════════════════════════════════════════
// COMPLETE WORKOUT
// ════════════════════════════════════════════════════════

export async function completeWorkout(
  workoutId: string,
  notes: string | null
) {
  if (DEMO_MODE) {
    const stored = mockStore.get(workoutId);
    if (stored) {
      stored.workout.completed_at = new Date().toISOString();
      stored.workout.notes = notes;
    }
    return;
  }

  const supabase = await db();
  await supabase
    .from("workouts")
    .update({ completed_at: new Date().toISOString(), notes })
    .eq("id", workoutId);
}

// ════════════════════════════════════════════════════════
// SAVE SETS (batch save from client when finishing)
// ════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════
// HISTORY
// ════════════════════════════════════════════════════════

const MOCK_HISTORY: Workout[] = [
  {
    id: "past-1", user_id: "mock-user", workout_day_id: "day-6",
    started_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 3 * 86400000 + 75 * 60000).toISOString(),
    notes: "Felt strong today", created_at: "",
    workout_day: MOCK_DAYS.find((d) => d.id === "day-6"),
  },
  {
    id: "past-2", user_id: "mock-user", workout_day_id: "day-4",
    started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 5 * 86400000 + 60 * 60000).toISOString(),
    notes: null, created_at: "",
    workout_day: MOCK_DAYS.find((d) => d.id === "day-4"),
  },
  {
    id: "past-3", user_id: "mock-user", workout_day_id: "day-2",
    started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 7 * 86400000 + 90 * 60000).toISOString(),
    notes: "PR on snatch", created_at: "",
    workout_day: MOCK_DAYS.find((d) => d.id === "day-2"),
  },
];

export async function getWorkoutHistory(): Promise<Workout[]> {
  if (DEMO_MODE) {
    const completed = Array.from(mockStore.values())
      .filter((s) => s.workout.completed_at)
      .map((s) => s.workout)
      .reverse();
    return [...completed, ...MOCK_HISTORY];
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(50);

  return data ?? [];
}
export async function deleteWorkoutFromHistory(workoutId: string): Promise<void> {
  if (DEMO_MODE) {
    mockStore.delete(workoutId);
    mockBonusCardio.delete(workoutId);
    const idx = MOCK_HISTORY.findIndex((w) => w.id === workoutId);
    if (idx >= 0) MOCK_HISTORY.splice(idx, 1);
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  // All child tables (workout_exercise_entries, set_entries, workout_bonus_cardio)
  // have ON DELETE CASCADE on their workout_id / workout_exercise_entry_id FKs,
  // so a single delete on the parent row handles everything at the DB level.
  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete workout: ${error.message}`);
  }
}


// ════════════════════════════════════════════════════════
// PROGRESS
// ════════════════════════════════════════════════════════

export async function getExerciseList() {
  if (DEMO_MODE) {
    const all = Object.values(MOCK_EXERCISES).flat();
    const seen = new Set<string>();
    return all
      .filter((ex) => { if (seen.has(ex.id)) return false; seen.add(ex.id); return true; })
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


export async function getExerciseProgress(exerciseId: string) {
  if (DEMO_MODE) return getExerciseProgressMock(exerciseId);

  const supabase = await db();
  const userId = await getUserId();

  // Get all completed sets for this exercise, grouped by workout date
  const { data } = await supabase
    .from("set_entries")
    .select(
      "weight_kg, reps, workout_exercise_entry:workout_exercise_entries!inner(exercise_id, workout:workouts!inner(started_at, completed_at))"
    )
    .eq("workout_exercise_entry.exercise_id", exerciseId)
    .eq("user_id", userId)
    .eq("completed", true)
    .not("weight_kg", "is", null);

  if (!data || data.length === 0) return [];

  // Group by date and pick top set (highest weight)
  const byDate = new Map<string, { weight_kg: number; reps: number }>();
  for (const row of data) {
    const we = row.workout_exercise_entry as unknown as {
      workout: { started_at: string; completed_at: string | null };
    };
    if (!we?.workout?.completed_at) continue;
    const date = we.workout.started_at.split("T")[0];
    const existing = byDate.get(date);
    const w = row.weight_kg ?? 0;
    if (!existing || w > existing.weight_kg) {
      byDate.set(date, { weight_kg: w, reps: row.reps ?? 0 });
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));
}

function getExerciseProgressMock(exerciseId: string) {
  const MOCK_PROGRESS: Record<string, { date: string; weight_kg: number; reps: number }[]> = {
    "ex-bench": [
      { date: "2026-01-05", weight_kg: 90,   reps: 5 },
      { date: "2026-01-12", weight_kg: 92.5, reps: 5 },
      { date: "2026-01-19", weight_kg: 95,   reps: 5 },
      { date: "2026-01-26", weight_kg: 97.5, reps: 4 },
      { date: "2026-02-02", weight_kg: 97.5, reps: 5 },
      { date: "2026-02-09", weight_kg: 100,  reps: 5 },
      { date: "2026-02-16", weight_kg: 100,  reps: 4 },
      { date: "2026-03-02", weight_kg: 100,  reps: 5 },
    ],
    "ex-bsquat": [
      { date: "2026-01-03", weight_kg: 100,  reps: 5 },
      { date: "2026-01-10", weight_kg: 105,  reps: 5 },
      { date: "2026-01-17", weight_kg: 110,  reps: 5 },
      { date: "2026-01-24", weight_kg: 112.5, reps: 5 },
      { date: "2026-01-31", weight_kg: 115,  reps: 4 },
      { date: "2026-02-07", weight_kg: 115,  reps: 5 },
      { date: "2026-02-21", weight_kg: 117.5, reps: 5 },
      { date: "2026-03-07", weight_kg: 120,  reps: 5 },
    ],
    "ex-snatch": [
      { date: "2026-01-06", weight_kg: 60,   reps: 2 },
      { date: "2026-01-13", weight_kg: 62.5, reps: 2 },
      { date: "2026-01-20", weight_kg: 65,   reps: 2 },
      { date: "2026-02-03", weight_kg: 67.5, reps: 2 },
      { date: "2026-02-17", weight_kg: 70,   reps: 2 },
    ],
    "ex-rdl": [
      { date: "2026-01-08", weight_kg: 70,   reps: 8 },
      { date: "2026-01-15", weight_kg: 75,   reps: 8 },
      { date: "2026-01-22", weight_kg: 77.5, reps: 8 },
      { date: "2026-02-05", weight_kg: 80,   reps: 8 },
    ],
  };
  return MOCK_PROGRESS[exerciseId] ?? [];
}

// ════════════════════════════════════════════════════════
// PROGRAM BUILDER
// ════════════════════════════════════════════════════════


// Mock programs for demo mode
const INITIAL_MOCK_PROGRAMS: Program[] = [
  {
    id: "prog-demo-1",
    user_id: "demo-user",
    name: "Strength A/B",
    description: "Classic strength split",
    mode: "weekday",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "prog-demo-2",
    user_id: "demo-user",
    name: "Powerlifting",
    description: "Linear periodization",
    mode: "weekday",
    is_active: false,
    created_at: new Date().toISOString(),
  },
];

if (!globalThis.__mockPrograms) {
  globalThis.__mockPrograms = INITIAL_MOCK_PROGRAMS.map((program) => ({ ...program }));
}
const MOCK_PROGRAMS = globalThis.__mockPrograms!;

const INITIAL_MOCK_PROGRAM_DAYS: ProgramDay[] = [
  {
    id: "day-0",
    program_id: "prog-demo-1",
    user_id: "demo-user",
    name: "Chest",
    day_order: 0,
    kind: "weekday",
    day_of_week: 0,
    day_label: "SU",
    weekday_label: "Sunday",
    created_at: new Date().toISOString(),
  },
  {
    id: "day-2",
    program_id: "prog-demo-1",
    user_id: "demo-user",
    name: "Oly",
    day_order: 1,
    kind: "weekday",
    day_of_week: 2,
    day_label: "TI",
    weekday_label: "Tuesday",
    created_at: new Date().toISOString(),
  },
  {
    id: "day-4",
    program_id: "prog-demo-1",
    user_id: "demo-user",
    name: "Back",
    day_order: 2,
    kind: "weekday",
    day_of_week: 4,
    day_label: "TO",
    weekday_label: "Thursday",
    created_at: new Date().toISOString(),
  },
  {
    id: "day-6",
    program_id: "prog-demo-1",
    user_id: "demo-user",
    name: "Legs",
    day_order: 3,
    kind: "weekday",
    day_of_week: 6,
    day_label: "LA",
    weekday_label: "Saturday",
    created_at: new Date().toISOString(),
  },
];

const INITIAL_MOCK_PROGRAM_EXERCISES: ProgramExercise[] = Object.entries(MOCK_EXERCISES).flatMap(
  ([dayId, exercises]) =>
    exercises.map((exercise, index) => ({
      id: exercise.id,
      program_id: "prog-demo-1",
      workout_day_id: dayId,
      user_id: "demo-user",
      exercise_name_snapshot: exercise.name,
      scheme_text: `${exercise.target_sets}x${exercise.target_reps}`,
      target_sets: exercise.target_sets,
      target_reps_text: `${exercise.target_reps}`,
      notes: undefined,
      sort_order: index,
      created_at: new Date().toISOString(),
    }))
);

if (!globalThis.__mockProgramDays) {
  globalThis.__mockProgramDays = INITIAL_MOCK_PROGRAM_DAYS.map((day) => ({ ...day }));
}
if (!globalThis.__mockProgramExercises) {
  globalThis.__mockProgramExercises = INITIAL_MOCK_PROGRAM_EXERCISES.map((exercise) => ({ ...exercise }));
}

const MOCK_PROGRAM_DAYS = globalThis.__mockProgramDays!;
const MOCK_PROGRAM_EXERCISES = globalThis.__mockProgramExercises!;

function dayLabelFromIndex(index: number): string {
  return ["SU", "MO", "TI", "WO", "TO", "FR", "LA"][((index % 7) + 7) % 7];
}

function demoDayToWorkoutDay(day: ProgramDay): WorkoutDay {
  const dayOfWeek = day.day_of_week ?? (day.day_order % 7);
  return {
    id: day.id,
    program_id: day.program_id,
    user_id: day.user_id,
    name: day.name,
    day_of_week: dayOfWeek,
    day_label: day.day_label || dayLabelFromIndex(dayOfWeek),
    created_at: day.created_at,
  };
}

function getDemoProgramDays(programId: string): ProgramDay[] {
  return MOCK_PROGRAM_DAYS
    .filter((d) => d.program_id === programId)
    .sort((a, b) => a.day_order - b.day_order);
}

function getDemoPreferredProgramId(): string | null {
  const activeProgram = MOCK_PROGRAMS.find((p) => p.is_active);
  if (activeProgram) {
    const activeDays = getDemoProgramDays(activeProgram.id);
    if (activeDays.length > 0) return activeProgram.id;
  }

  const newestWithDays = MOCK_PROGRAMS
    .map((program) => ({
      program,
      dayCount: getDemoProgramDays(program.id).length,
    }))
    .filter((x) => x.dayCount > 0)
    .sort(
      (a, b) =>
        new Date(b.program.created_at).getTime() -
        new Date(a.program.created_at).getTime()
    );

  return newestWithDays[0]?.program.id ?? null;
}

export async function getPrograms(): Promise<Program[]> {
  if (DEMO_MODE) return MOCK_PROGRAMS;

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  return data ?? [];
}


export async function getProgramsList() {
  const programs = await getPrograms();
  
  if (DEMO_MODE) {
    return programs.map((prog) => {
      const days = getDemoProgramDays(prog.id);
      const dayIds = new Set(days.map((d) => d.id));
      const exercisesCount = MOCK_PROGRAM_EXERCISES.filter((ex) =>
        dayIds.has(ex.workout_day_id)
      ).length;
      return {
        ...prog,
        days_count: days.length,
        exercises_count: exercisesCount,
      };
    });
  }

  const supabase = await db();
  const userId = await getUserId();

  // Fetch day and exercise counts for each program
  const result = await Promise.all(
    programs.map(async (prog) => {
      const [dayRes, exerciseRes] = await Promise.all([
        supabase
          .from("workout_days")
          .select("id", { count: "exact", head: true })
          .eq("program_id", prog.id)
          .eq("user_id", userId),
        supabase
          .from("program_exercises")
          .select("id", { count: "exact", head: true })
          .eq("program_id", prog.id)
          .eq("user_id", userId),
      ]);

      return {
        ...prog,
        days_count: dayRes.count ?? 0,
        exercises_count: exerciseRes.count ?? 0,
      };
    })
  );

  return result;
}

export async function getProgramById(id: string): Promise<Program | null> {
  if (DEMO_MODE) return MOCK_PROGRAMS.find((p) => p.id === id) ?? null;

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  return data ?? null;
}

export async function createProgram(
  name: string,
  description: string | null,
  mode: ProgramMode
): Promise<Program> {
  if (DEMO_MODE) {
    const prog: Program = {
      id: `prog-${Date.now()}`,
      user_id: "demo-user",
      name,
      description: description || undefined,
      mode,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAMS.push(prog);
    return prog;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name,
      description,
      mode,
      is_active: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create program: ${error.message}`);
  return data;
}

export async function updateProgram(
  id: string,
  updates: Partial<Program>
): Promise<Program> {
  if (DEMO_MODE) {
    const prog = MOCK_PROGRAMS.find((p) => p.id === id);
    if (!prog) throw new Error("Program not found");
    Object.assign(prog, updates);
    return prog;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("programs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update program: ${error.message}`);
  return data;
}

export async function setActiveProgram(id: string): Promise<void> {
  if (DEMO_MODE) {
    for (const p of MOCK_PROGRAMS) {
      p.is_active = p.id === id;
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Deactivate all programs for this user, then activate the selected one.
  // (Replaces the missing set_active_program RPC with direct SQL updates.)
  await supabase
    .from("programs")
    .update({ is_active: false })
    .eq("user_id", userId);

  await supabase
    .from("programs")
    .update({ is_active: true })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function getActiveProgram(): Promise<Program | null> {
  const programs = await getPrograms();
  return programs.find((p) => p.is_active) ?? null;
}

export async function deleteProgram(id: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = MOCK_PROGRAMS.findIndex((p) => p.id === id);
    if (idx >= 0) MOCK_PROGRAMS.splice(idx, 1);
    for (let i = MOCK_PROGRAM_DAYS.length - 1; i >= 0; i--) {
      if (MOCK_PROGRAM_DAYS[i].program_id === id) {
        const dayId = MOCK_PROGRAM_DAYS[i].id;
        MOCK_PROGRAM_DAYS.splice(i, 1);
        for (let j = MOCK_PROGRAM_EXERCISES.length - 1; j >= 0; j--) {
          if (MOCK_PROGRAM_EXERCISES[j].workout_day_id === dayId) {
            MOCK_PROGRAM_EXERCISES.splice(j, 1);
          }
        }
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  await supabase.from("programs").delete().eq("id", id).eq("user_id", userId);
}

// ────────────────────────────────────────────
// PROGRAM DAYS
// ────────────────────────────────────────────

export async function getProgramDays(programId: string): Promise<ProgramDay[]> {
  if (DEMO_MODE) {
    return getDemoProgramDays(programId);
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workout_days")
    .select("*")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .order("day_order");

  return (data ?? []) as ProgramDay[];
}

export async function createProgramDay(
  programId: string,
  name: string,
  dayOrder: number,
  weekdayLabel?: string,
  sessionLabel?: string
): Promise<ProgramDay> {
  const kind: ProgramDay["kind"] = sessionLabel ? "session" : "weekday";
  const normalizedDayOfWeek = ((dayOrder % 7) + 7) % 7;
  const normalizedDayLabel = dayLabelFromIndex(normalizedDayOfWeek);

  if (DEMO_MODE) {
    const day: ProgramDay = {
      id: `day-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      program_id: programId,
      user_id: "demo-user",
      name,
      day_order: dayOrder,
      kind,
      day_of_week: normalizedDayOfWeek,
      day_label: normalizedDayLabel,
      weekday_label: weekdayLabel,
      session_label: sessionLabel,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAM_DAYS.push(day);
    return day;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_days")
    .insert({
      program_id: programId,
      user_id: userId,
      name,
      day_order: dayOrder,
      kind,
      weekday_label: weekdayLabel,
      session_label: sessionLabel,
      day_of_week: normalizedDayOfWeek,
      day_label: normalizedDayLabel,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create day: ${error.message}`);
  return data as ProgramDay;
}

export async function updateProgramDay(
  dayId: string,
  updates: Partial<ProgramDay>
): Promise<ProgramDay> {
  if (DEMO_MODE) {
    const day = MOCK_PROGRAM_DAYS.find((d) => d.id === dayId);
    if (!day) throw new Error("Day not found");
    Object.assign(day, updates);
    return day;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_days")
    .update(updates)
    .eq("id", dayId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update day: ${error.message}`);
  return data as ProgramDay;
}

export async function deleteProgramDay(dayId: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = MOCK_PROGRAM_DAYS.findIndex((d) => d.id === dayId);
    if (idx >= 0) MOCK_PROGRAM_DAYS.splice(idx, 1);
    for (let i = MOCK_PROGRAM_EXERCISES.length - 1; i >= 0; i--) {
      if (MOCK_PROGRAM_EXERCISES[i].workout_day_id === dayId) {
        MOCK_PROGRAM_EXERCISES.splice(i, 1);
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("workout_days")
    .delete()
    .eq("id", dayId)
    .eq("user_id", userId);
}

export async function reorderProgramDays(
  programId: string,
  dayOrders: Array<{ id: string; day_order: number }>
): Promise<void> {
  if (DEMO_MODE) {
    for (const { id, day_order } of dayOrders) {
      const day = MOCK_PROGRAM_DAYS.find((d) => d.id === id && d.program_id === programId);
      if (day) {
        day.day_order = day_order;
        day.day_of_week = ((day_order % 7) + 7) % 7;
        day.day_label = dayLabelFromIndex(day.day_of_week);
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  for (const { id, day_order } of dayOrders) {
    await supabase
      .from("workout_days")
      .update({ day_order, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
  }
}

// ────────────────────────────────────────────
// PROGRAM EXERCISES
// ────────────────────────────────────────────

export async function getProgramExercises(dayId: string): Promise<ProgramExercise[]> {
  if (DEMO_MODE) {
    return MOCK_PROGRAM_EXERCISES
      .filter((ex) => ex.workout_day_id === dayId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("program_exercises")
    .select("*")
    .eq("program_day_id", dayId)
    .eq("user_id", userId)
    .order("sort_order");

  return (data ?? []) as ProgramExercise[];
}

export async function createProgramExercise(
  dayId: string,
  programId: string,
  exerciseName: string,
  schemeText?: string,
  targetSets?: number,
  targetRepsText?: string,
  notes?: string
): Promise<ProgramExercise> {
  if (DEMO_MODE) {
    const existing = MOCK_PROGRAM_EXERCISES
      .filter((ex) => ex.workout_day_id === dayId)
      .sort((a, b) => b.sort_order - a.sort_order);
    const maxSort = (existing[0]?.sort_order ?? -1) + 1;
    const ex: ProgramExercise = {
      id: `ex-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      program_id: programId,
      workout_day_id: dayId,
      user_id: "demo-user",
      exercise_name_snapshot: exerciseName,
      scheme_text: schemeText,
      target_sets: targetSets,
      target_reps_text: targetRepsText,
      notes,
      sort_order: maxSort,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAM_EXERCISES.push(ex);
    return ex;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Get max sort_order for this day
  const { data: existing } = await supabase
    .from("program_exercises")
    .select("sort_order")
    .eq("program_day_id", dayId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSort = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("program_exercises")
    .insert({
      program_id: programId,
      program_day_id: dayId,
      user_id: userId,
      exercise_name_snapshot: exerciseName,
      scheme_text: schemeText,
      target_sets: targetSets,
      target_reps_text: targetRepsText,
      notes,
      sort_order: maxSort,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create exercise: ${error.message}`);
  return data as ProgramExercise;
}

export async function updateProgramExercise(
  exerciseId: string,
  updates: Partial<ProgramExercise>
): Promise<ProgramExercise> {
  if (DEMO_MODE) {
    const ex = MOCK_PROGRAM_EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) throw new Error("Exercise not found");
    Object.assign(ex, updates);
    return ex;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("program_exercises")
    .update(updates)
    .eq("id", exerciseId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update exercise: ${error.message}`);
  return data as ProgramExercise;
}

export async function deleteProgramExercise(exerciseId: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = MOCK_PROGRAM_EXERCISES.findIndex((e) => e.id === exerciseId);
    if (idx >= 0) MOCK_PROGRAM_EXERCISES.splice(idx, 1);
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("program_exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("user_id", userId);
}

export async function reorderProgramExercises(
  dayId: string,
  exerciseOrders: Array<{ id: string; sort_order: number }>
): Promise<void> {
  if (DEMO_MODE) {
    for (const { id, sort_order } of exerciseOrders) {
      const ex = MOCK_PROGRAM_EXERCISES.find(
        (e) => e.id === id && e.workout_day_id === dayId
      );
      if (ex) ex.sort_order = sort_order;
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  for (const { id, sort_order } of exerciseOrders) {
    await supabase
      .from("program_exercises")
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
  }
}

// ────────────────────────────────────────────
// DUPLICATE PROGRAM
// ────────────────────────────────────────────

export async function duplicateProgram(
  sourceId: string,
  newName: string
): Promise<Program> {
  if (DEMO_MODE) {
    const source = MOCK_PROGRAMS.find((p) => p.id === sourceId);
    if (!source) throw new Error("Program not found");
    const dup: Program = {
      ...source,
      id: `prog-${Date.now()}`,
      name: newName,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAMS.push(dup);

    const sourceDays = getDemoProgramDays(sourceId);
    for (const sourceDay of sourceDays) {
      const newDay: ProgramDay = {
        ...sourceDay,
        id: `day-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        program_id: dup.id,
        created_at: new Date().toISOString(),
      };
      MOCK_PROGRAM_DAYS.push(newDay);

      const sourceExercises = MOCK_PROGRAM_EXERCISES.filter(
        (e) => e.workout_day_id === sourceDay.id
      );
      for (const sourceEx of sourceExercises) {
        MOCK_PROGRAM_EXERCISES.push({
          ...sourceEx,
          id: `ex-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          program_id: dup.id,
          workout_day_id: newDay.id,
          created_at: new Date().toISOString(),
        });
      }
    }

    return dup;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Get source program
  const { data: source, error: sourceError } = await supabase
    .from("programs")
    .select("*")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .single();

  if (sourceError || !source)
    throw new Error("Source program not found");

  // Create new program
  const { data: newProg, error: createError } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name: newName,
      description: source.description,
      mode: source.mode,
      is_active: false,
    })
    .select()
    .single();

  if (createError || !newProg) throw new Error("Failed to create duplicate");

  // Get source days
  const { data: sourceDays } = await supabase
    .from("workout_days")
    .select("*")
    .eq("program_id", sourceId)
    .eq("user_id", userId)
    .order("day_order");

  // Duplicate days and exercises
  if (sourceDays && sourceDays.length > 0) {
    for (const sourceDay of sourceDays) {
      // Create new day
      const { data: newDay, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          program_id: newProg.id,
          user_id: userId,
          name: sourceDay.name,
          day_order: sourceDay.day_order,
          kind: sourceDay.kind,
          day_of_week: sourceDay.day_of_week,
          day_label: sourceDay.day_label,
          weekday_label: sourceDay.weekday_label,
          session_label: sourceDay.session_label,
        })
        .select()
        .single();

      if (dayError || !newDay) continue;

      // Get source exercises for this day
      const { data: sourceExercises } = await supabase
        .from("program_exercises")
        .select("*")
        .eq("program_day_id", sourceDay.id)
        .order("sort_order");

      // Duplicate exercises
      if (sourceExercises && sourceExercises.length > 0) {
        for (const sourceEx of sourceExercises) {
          await supabase.from("program_exercises").insert({
            program_id: newProg.id,
            program_day_id: newDay.id,
            user_id: userId,
            exercise_id: sourceEx.exercise_id,
            exercise_name_snapshot: sourceEx.exercise_name_snapshot,
            scheme_text: sourceEx.scheme_text,
            target_sets: sourceEx.target_sets,
            target_reps_text: sourceEx.target_reps_text,
            notes: sourceEx.notes,
            sort_order: sourceEx.sort_order,
          });
        }
      }
    }
  }

  return newProg as Program;
}

// ────────────────────────────────────────────
// SAVE IMPORTED PROGRAM
// ────────────────────────────────────────────

export async function saveImportedProgram(
  name: string,
  description: string | null,
  mode: ProgramMode,
  days: Array<{
    name: string;
    label?: string;
    exercises: Array<{
      name: string;
      schemeText?: string;
      targetSets?: number;
      targetRepsText?: string;
      notes?: string;
    }>;
  }>
): Promise<Program> {
  if (DEMO_MODE) {
    const prog: Program = {
      id: `prog-${Date.now()}`,
      user_id: "demo-user",
      name,
      description: description || undefined,
      mode,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAMS.push(prog);

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const sourceDay = days[dayIdx];
      const createdDay = await createProgramDay(
        prog.id,
        sourceDay.name,
        dayIdx,
        mode === "weekday" ? sourceDay.label : undefined,
        mode === "session" ? sourceDay.label ?? `Workout ${dayIdx + 1}` : undefined
      );

      for (let exIdx = 0; exIdx < sourceDay.exercises.length; exIdx++) {
        const ex = sourceDay.exercises[exIdx];
        await createProgramExercise(
          createdDay.id,
          prog.id,
          ex.name,
          ex.schemeText,
          ex.targetSets,
          ex.targetRepsText,
          ex.notes
        );
      }
    }

    return prog;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Create program
  const { data: newProg, error: progError } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name,
      description,
      mode,
      is_active: false,
    })
    .select()
    .single();

  if (progError || !newProg) throw new Error("Failed to create program");

  // Create days and exercises
  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const sourceDay = days[dayIdx];
    const normalizedDayOfWeek = ((dayIdx % 7) + 7) % 7;
    const normalizedDayLabel = dayLabelFromIndex(normalizedDayOfWeek);

    const { data: newDay, error: dayError } = await supabase
      .from("workout_days")
      .insert({
        program_id: newProg.id,
        user_id: userId,
        name: sourceDay.name,
        day_order: dayIdx,
        kind: mode,
        day_of_week: normalizedDayOfWeek,
        day_label: normalizedDayLabel,
        weekday_label: sourceDay.label,
        session_label: sourceDay.label,
      })
      .select()
      .single();

    if (dayError || !newDay) continue;

    // Create exercises for this day
    for (let exIdx = 0; exIdx < sourceDay.exercises.length; exIdx++) {
      const ex = sourceDay.exercises[exIdx];

      await supabase.from("program_exercises").insert({
        program_id: newProg.id,
        program_day_id: newDay.id,
        user_id: userId,
        exercise_name_snapshot: ex.name,
        scheme_text: ex.schemeText,
        target_sets: ex.targetSets,
        target_reps_text: ex.targetRepsText,
        notes: ex.notes,
        sort_order: exIdx,
      });
    }
  }

  return newProg as Program;
}

export type ValidationWarning = {
  type:
    | "missing_program"
    | "missing_days"
    | "missing_exercises"
    | "count_mismatch"
    | "missing_target_sets"
    | "duplicate_day"
    | "duplicate_exercise"
    | "mismatch_exercise_name";
  message: string;
  dayName?: string;
  exerciseName?: string;
};

/**
 * Validate a program was materialized correctly.
 * If `expectedDays` is provided (parser output), validate counts and names against it.
 */
export async function validateProgram(
  programId: string,
  expectedDays?: Array<{
    name: string;
    label?: string;
    exercises: Array<{
      name: string;
      schemeText?: string;
      targetSets?: number;
      targetRepsText?: string;
      notes?: string;
    }>;
  }>
): Promise<{ valid: boolean; warnings: ValidationWarning[] }> {
  if (DEMO_MODE) {
    const warnings: ValidationWarning[] = [];
    const prog = MOCK_PROGRAMS.find((p) => p.id === programId);
    if (!prog) {
      warnings.push({ type: "missing_program", message: "Program not found (demo mode)" });
      return { valid: warnings.length === 0, warnings };
    }

    // In demo mode we can't validate days/exercises reliably; return success
    return { valid: true, warnings };
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("user_id", userId)
    .maybeSingle();

  const warnings: ValidationWarning[] = [];
  if (!program) {
    warnings.push({ type: "missing_program", message: "Program not found or not owned by user" });
    return { valid: false, warnings };
  }

  const { data: days } = await supabase
    .from("workout_days")
    .select("*")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .order("day_order");

  if (!days || days.length === 0) {
    warnings.push({ type: "missing_days", message: "Program has no days" });
    return { valid: false, warnings };
  }

  if (expectedDays && expectedDays.length !== days.length) {
    warnings.push({ type: "count_mismatch", message: `Expected ${expectedDays.length} days but found ${days.length}` });
  }

  // Check duplicate day names
  const seenDays = new Set<string>();
  for (const d of days) {
    const lower = (d.name || "").toLowerCase();
    if (seenDays.has(lower)) {
      warnings.push({ type: "duplicate_day", message: `Duplicate day name: ${d.name}`, dayName: d.name });
    }
    seenDays.add(lower);
  }

  // For each day, validate exercises
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const { data: exercises } = await supabase
      .from("program_exercises")
      .select("*")
      .eq("program_day_id", day.id)
      .eq("user_id", userId)
      .order("sort_order");

    const expectedDay = expectedDays ? expectedDays[i] : undefined;
    if ((!exercises || exercises.length === 0) && expectedDay && expectedDay.exercises.length > 0) {
      warnings.push({ type: "missing_exercises", message: `Day '${day.name}' has no exercises`, dayName: day.name });
      continue;
    }

    if (expectedDay && exercises && exercises.length !== expectedDay.exercises.length) {
      warnings.push({ type: "count_mismatch", message: `Day '${day.name}': expected ${expectedDay.exercises.length} exercises but found ${exercises.length}`, dayName: day.name });
    }

    // Check duplicate exercise names within day and some field validations
    const seenEx = new Set<string>();
    for (let j = 0; exercises && j < exercises.length; j++) {
      const ex = exercises[j] as ValidationExerciseRow;
      const lower = (ex.exercise_name_snapshot || "").toLowerCase();
      const exName = ex.exercise_name_snapshot ?? undefined;
      if (seenEx.has(lower)) {
        warnings.push({ type: "duplicate_exercise", message: `Duplicate exercise '${ex.exercise_name_snapshot}' in day '${day.name}'`, dayName: day.name, exerciseName: exName });
      }
      seenEx.add(lower);

      const expectedEx = expectedDay?.exercises?.[j];
      if (expectedEx && lower !== (expectedEx.name || "").toLowerCase()) {
        warnings.push({ type: "mismatch_exercise_name", message: `Exercise name mismatch in day '${day.name}': expected '${expectedEx.name}' but got '${ex.exercise_name_snapshot}'`, dayName: day.name, exerciseName: exName });
      }

      if ((expectedEx?.targetSets ?? null) !== null && (ex.target_sets === null || ex.target_sets === undefined)) {
        warnings.push({ type: "missing_target_sets", message: `Exercise '${ex.exercise_name_snapshot}' in day '${day.name}' missing target sets`, dayName: day.name, exerciseName: exName });
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}




