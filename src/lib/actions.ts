"use server";

import type {
  Workout,
  WorkoutDay,
  WorkoutExerciseEntry,
} from "@/lib/types";

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
  { id: "day-0", program_id: "prog-1", user_id: "mock-user", name: "Chest", day_of_week: 0, day_label: "SU", created_at: "" },
  { id: "day-2", program_id: "prog-1", user_id: "mock-user", name: "Oly",   day_of_week: 2, day_label: "TI", created_at: "" },
  { id: "day-4", program_id: "prog-1", user_id: "mock-user", name: "Back",  day_of_week: 4, day_label: "TO", created_at: "" },
  { id: "day-6", program_id: "prog-1", user_id: "mock-user", name: "Legs",  day_of_week: 6, day_label: "LA", created_at: "" },
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
declare const globalThis: typeof global & { __ws?: Map<string, MockStore>; __nid?: number };
if (!globalThis.__ws) globalThis.__ws = new Map();
if (!globalThis.__nid) globalThis.__nid = 1;
const mockStore = globalThis.__ws;
function uid() { return `mock-${globalThis.__nid!++}`; }

// ════════════════════════════════════════════════════════
// TODAY
// ════════════════════════════════════════════════════════

export async function getTodayWorkoutDay(): Promise<WorkoutDay | null> {
  if (DEMO_MODE) {
    const dow = new Date().getDay();
    return MOCK_DAYS.find((d) => d.day_of_week === dow) ?? null;
  }

  const supabase = await db();
  const userId = await getUserId();
  const dow = new Date().getDay();

  const { data } = await supabase
    .from("workout_days")
    .select("*")
    .eq("user_id", userId)
    .eq("day_of_week", dow)
    .limit(1)
    .single();

  return data ?? null;
}

export async function getWorkoutDaysForProgram(): Promise<WorkoutDay[]> {
  if (DEMO_MODE) return MOCK_DAYS;

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workout_days")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_week");

  return data ?? [];
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

  // 2. Create workout row
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, workout_day_id: workoutDayId })
    .select("*")
    .single();
  if (wErr || !workout) return null;
  workout.workout_day = day;

  // 3. Get exercises for this day
  const { data: wdes } = await supabase
    .from("workout_day_exercises")
    .select("*, exercise:exercises(*)")
    .eq("workout_day_id", workoutDayId)
    .eq("user_id", userId)
    .order("order_index");

  if (!wdes || wdes.length === 0) return null;

  // 4. Create exercise entries + empty sets
  const entries: WorkoutExerciseEntry[] = [];
  const suggestions: Record<string, number | null> = {};

  for (const wde of wdes) {
    const { data: entry } = await supabase
      .from("workout_exercise_entries")
      .insert({
        workout_id: workout.id,
        exercise_id: wde.exercise_id,
        workout_day_exercise_id: wde.id,
        user_id: userId,
      })
      .select("*")
      .single();
    if (!entry) continue;

    // Create empty sets
    const setsToInsert = Array.from({ length: wde.target_sets }, (_, i) => ({
      workout_exercise_entry_id: entry.id,
      user_id: userId,
      set_number: i + 1,
      weight_kg: null,
      reps: null,
      completed: false,
    }));

    const { data: sets } = await supabase
      .from("set_entries")
      .insert(setsToInsert)
      .select("*")
      .order("set_number");

    entries.push({
      ...entry,
      exercise: wde.exercise,
      workout_day_exercise: wde,
      set_entries: sets ?? [],
    });

    suggestions[wde.exercise_id] = await getSuggestedWeight(
      wde.exercise_id,
      wde.target_sets
    );
  }

  return { id: workout.id, workout, entries, suggestions };
}

function startWorkoutMock(workoutDayId: string): StartWorkoutResult | null {
  const day = MOCK_DAYS.find((d) => d.id === workoutDayId);
  if (!day) return null;

  const workoutId = uid();
  const exercises = MOCK_EXERCISES[workoutDayId] ?? [];

  const entries: WorkoutExerciseEntry[] = exercises.map((ex) => {
    const entryId = uid();
    const wdeId = uid();
    const sets = Array.from({ length: ex.target_sets }, (_, i) => ({
      id: uid(),
      workout_exercise_entry_id: entryId,
      user_id: "mock-user",
      set_number: i + 1,
      weight_kg: null as number | null,
      reps: null as number | null,
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
    created_at: new Date().toISOString(), workout_day: day,
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

export async function getPreviousResults(
  exerciseId: string
): Promise<{ weight_kg: number; reps: number }[]> {
  if (DEMO_MODE) return MOCK_PREV[exerciseId] ?? [];

  const supabase = await db();
  const userId = await getUserId();

  // Find the most recent completed workout that included this exercise
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
