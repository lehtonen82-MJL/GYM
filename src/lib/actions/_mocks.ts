import type { WorkoutDay, Program, ProgramDay, ProgramExercise } from "@/lib/types";
import { mockStore, mockBonusCardio, uid, type MockStore } from "./_shared";

export { mockStore, mockBonusCardio, uid };
export type { MockStore };

export const MOCK_DAYS: WorkoutDay[] = [
  { id: "day-0", program_id: "prog-demo-1", user_id: "mock-user", name: "Chest", day_of_week: 0, day_label: "SU", created_at: "" },
  { id: "day-2", program_id: "prog-demo-1", user_id: "mock-user", name: "Oly",   day_of_week: 2, day_label: "TI", created_at: "" },
  { id: "day-4", program_id: "prog-demo-1", user_id: "mock-user", name: "Back",  day_of_week: 4, day_label: "TO", created_at: "" },
  { id: "day-6", program_id: "prog-demo-1", user_id: "mock-user", name: "Legs",  day_of_week: 6, day_label: "LA", created_at: "" },
];

export const MOCK_EXERCISES: Record<
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

export const MOCK_PREV: Record<string, { weight_kg: number; reps: number }[]> = {
  "ex-bench":   [{ weight_kg: 100, reps: 5 }, { weight_kg: 100, reps: 5 }, { weight_kg: 100, reps: 4 }],
  "ex-snatch":  [{ weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }, { weight_kg: 70, reps: 2 }],
  "ex-cj":      [{ weight_kg: 85, reps: 2 }, { weight_kg: 85, reps: 2 }, { weight_kg: 85, reps: 2 }],
  "ex-bsquat":  [{ weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }, { weight_kg: 120, reps: 5 }],
  "ex-pullups": [{ weight_kg: 0, reps: 8 }, { weight_kg: 0, reps: 8 }, { weight_kg: 0, reps: 7 }],
  "ex-rdl":     [{ weight_kg: 80, reps: 8 }, { weight_kg: 80, reps: 8 }],
};

export const INITIAL_MOCK_PROGRAMS: Program[] = [
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

declare const globalThis: typeof global & {
  __mockPrograms?: Program[];
  __mockProgramDays?: ProgramDay[];
  __mockProgramExercises?: ProgramExercise[];
};

if (!globalThis.__mockPrograms) {
  globalThis.__mockPrograms = INITIAL_MOCK_PROGRAMS.map((program) => ({ ...program }));
}
export const MOCK_PROGRAMS = globalThis.__mockPrograms!;

export const INITIAL_MOCK_PROGRAM_DAYS: ProgramDay[] = [
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

export const INITIAL_MOCK_PROGRAM_EXERCISES: ProgramExercise[] = Object.entries(MOCK_EXERCISES).flatMap(
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

export const MOCK_PROGRAM_DAYS = globalThis.__mockProgramDays!;
export const MOCK_PROGRAM_EXERCISES = globalThis.__mockProgramExercises!;

export function dayLabelFromIndex(index: number): string {
  return ["SU", "MO", "TI", "WO", "TO", "FR", "LA"][((index % 7) + 7) % 7];
}

export function getDemoProgramDays(programId: string): ProgramDay[] {
  return MOCK_PROGRAM_DAYS
    .filter((d) => d.program_id === programId)
    .sort((a, b) => a.day_order - b.day_order);
}

export function getDemoPreferredProgramId(): string | null {
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

export function demoDayToWorkoutDay(day: ProgramDay): import("@/lib/types").WorkoutDay {
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
