export type Profile = {
  id: string;
  email: string;
  created_at: string;
};

// ── Exercise Library Types ─────────────────────

export type ExerciseEquipmentType =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine_plate"
  | "machine_stack"
  | "smith"
  | "bodyweight"
  | "kettlebell"
  | "trap_bar"
  | "band"
  | "suspension"
  | "cardio_machine"
  | "other";

export type PrimaryMuscle =
  | "chest"
  | "back_lats"
  | "back_upper"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves";

export type MovementPattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "olympic"
  | "isolation"
  | "core"
  | "cardio";

export type ExerciseDefinition = {
  id: string;
  name: string;
  normalized_name: string;
  aliases: string[];
  equipment_type: ExerciseEquipmentType;
  primary_muscle: PrimaryMuscle;
  secondary_muscles: string[];
  movement_pattern: MovementPattern | null;
  is_bodyweight: boolean;
  is_cardio: boolean;
  is_bilateral: boolean;
  is_main_lift: boolean;
  created_at: string;
};

export type ExercisePRType = "max_weight" | "1rm_estimate" | "max_volume";

export type ExercisePR = {
  id: string;
  user_id: string;
  exercise_id: string;
  pr_type: ExercisePRType;
  value: number;
  achieved_at: string;
  created_at: string;
  updated_at: string;
};

// ── Program Builder Types ──────────────────────

export type ProgramMode = "weekday" | "session";

export type Program = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  mode: ProgramMode;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

export type ProgramDay = {
  id: string;
  program_id: string;
  user_id: string;
  name: string; // e.g. "Oly", "Back", "Legs", "Chest"
  day_order: number;
  kind: "weekday" | "session"; // "weekday" for program builder, "legacy" for old data
  day_of_week?: number; // 0=Sun, 1=Mon, 2=Tue, etc. (if weekday mode)
  day_label?: string; // "TI", "TO", "LA", "SU" (if weekday mode)
  weekday_label?: string; // e.g., "Monday"
  session_label?: string; // e.g., "Workout 1"
  created_at: string;
  updated_at?: string;
};

export type ProgramExercise = {
  id: string;
  program_id: string;
  workout_day_id: string;
  user_id: string;
  exercise_id?: string;
  exercise_name_snapshot: string; // name as it appears in the program
  scheme_text?: string; // e.g. "4x2", "1x5 + 2x5"
  target_sets?: number;
  target_reps_text?: string; // e.g. "5", "5,5,5", "8-10"
  notes?: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  exercise?: Exercise;
};

export type ParsedProgramPreview = {
  name: string;
  mode: ProgramMode;
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
  }>;
  warnings: Array<{
    line?: number;
    type: "unknown_exercise" | "malformed_line" | "empty_day" | "duplicate_day";
    message: string;
  }>;
};

export type WorkoutDay = {
  id: string;
  program_id: string;
  user_id: string;
  name: string; // e.g. "Oly", "Back", "Legs", "Chest"
  day_of_week: number; // 0=Sun, 1=Mon, 2=Tue, etc.
  day_label: string; // "TI", "TO", "LA", "SU"
  created_at: string;
  kind?: "legacy"; // for backward compatibility
};

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  normalized_name?: string;
  category?: string;
  is_main_lift?: boolean;
  exercise_definition_id?: string;
  is_bodyweight?: boolean;
  created_at: string;
  updated_at?: string;
  // Optional join from exercise_definitions
  definition?: ExerciseDefinition;
};

export type WorkoutDayExercise = {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  user_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number;
  created_at: string;
  exercise?: Exercise;
};

export type Workout = {
  id: string;
  user_id: string;
  workout_day_id: string | null;
  import_session_name?: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  is_deload?: boolean;
  created_at: string;
  workout_day?: WorkoutDay;
};

export type WorkoutBonusCardio = {
  id: string;
  workout_id: string;
  user_id: string;
  machine_type: "rower";
  distance_m: number | null;
  duration_seconds: number | null;
  pace_per_500_seconds: number | null;
  calories: number | null;
  stroke_rate: number | null;
  avg_watts: number | null;
  extra_metrics?: Record<string, number | null> | null;
  created_at: string;
  updated_at?: string;
};

export type WorkoutExerciseEntry = {
  id: string;
  workout_id: string;
  exercise_id: string;
  workout_day_exercise_id: string | null;
  user_id: string;
  too_heavy?: boolean;
  /** The tool used for this entry — drives per-equipment history & PRs */
  equipment_type?: string | null;
  /** Non-null when the user swapped this slot to a different exercise mid-workout */
  original_exercise_id?: string | null;
  original_exercise?: Exercise;
  created_at: string;
  exercise?: Exercise;
  workout_day_exercise?: WorkoutDayExercise;
  set_entries?: SetEntry[];
};

export type ProgramExerciseAlternative = {
  id: string;
  program_exercise_id: string;
  exercise_id: string;
  sort_order: number;
  user_id: string;
  created_at: string;
  exercise?: Exercise;
};

export type SetEntry = {
  id: string;
  workout_exercise_entry_id: string;
  user_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  is_warmup?: boolean;
  too_heavy?: boolean;
  too_heavy_reps?: number | null;
  created_at: string;
};

// ── Program Input Types (for mutations) ─────

export type CreateProgramInput = {
  name: string;
  description?: string;
  mode: ProgramMode;
};

export type UpdateProgramInput = {
  name?: string;
  description?: string;
  is_active?: boolean;
};

export type CreateProgramDayInput = {
  program_id: string;
  name: string;
  day_order: number;
  kind: "weekday" | "session";
  day_of_week?: number;
  day_label?: string;
  weekday_label?: string;
  session_label?: string;
};

export type CreateProgramExerciseInput = {
  program_id: string;
  program_day_id: string;
  exercise_id?: string;
  exercise_name_snapshot: string;
  scheme_text?: string;
  target_sets?: number;
  target_reps_text?: string;
  notes?: string;
  sort_order: number;
};

// ── Denormalized Types (for API responses) ─

export type ProgramWithDaysAndExercises = Program & {
  days: Array<
    ProgramDay & {
      exercises: ProgramExercise[];
    }
  >;
};

export type ProgramListItem = Program & {
  days_count: number;
  exercises_count: number;
};

// ── Freestyle / Custom Workout Templates ───────────────────

export type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

export type WorkoutTemplateExercise = {
  id: string;
  template_id: string;
  user_id: string;
  exercise_id: string;
  exercise_name_snapshot: string;
  target_sets: number;
  target_reps: number;
  sort_order: number;
  exercise?: Exercise;
};

export type WorkoutTemplateWithExercises = WorkoutTemplate & {
  exercises: WorkoutTemplateExercise[];
};

export type WorkoutTemplateListItem = WorkoutTemplate & {
  exercise_count: number;
  exercise_names: string[];
};
