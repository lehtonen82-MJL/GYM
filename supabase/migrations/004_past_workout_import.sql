-- ============================================
-- Migration 004: Past Workout Import
-- Allows importing historical workouts that have no associated workout_day or
-- workout_day_exercise (i.e. they come from free-text entry, not a program slot).
-- ============================================

-- Make workout_day_id nullable so imported workouts don't need a program slot
ALTER TABLE workouts
  ALTER COLUMN workout_day_id DROP NOT NULL;

-- Store a display name for imported workouts (e.g. "Chest", "Morning Session")
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS import_session_name TEXT;

-- Make workout_day_exercise_id nullable so imported exercise entries
-- don't need to be linked to a program exercise
ALTER TABLE workout_exercise_entries
  ALTER COLUMN workout_day_exercise_id DROP NOT NULL;
