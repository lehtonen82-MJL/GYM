export type Profile = {
  id: string;
  email: string;
  created_at: string;
};

export type Program = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type WorkoutDay = {
  id: string;
  program_id: string;
  user_id: string;
  name: string; // e.g. "Oly", "Back", "Legs", "Chest"
  day_of_week: number; // 0=Sun, 1=Mon, 2=Tue, etc.
  day_label: string; // "TI", "TO", "LA", "SU"
  created_at: string;
};

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
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
  workout_day_id: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  workout_day?: WorkoutDay;
};

export type WorkoutExerciseEntry = {
  id: string;
  workout_id: string;
  exercise_id: string;
  workout_day_exercise_id: string;
  user_id: string;
  created_at: string;
  exercise?: Exercise;
  workout_day_exercise?: WorkoutDayExercise;
  set_entries?: SetEntry[];
};

export type SetEntry = {
  id: string;
  workout_exercise_entry_id: string;
  user_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  created_at: string;
};
