-- ============================================================
-- Migration 022: row ownership on writes
--
-- Every policy so far was USING (auth.uid() = user_id), which also checks
-- writes — but only the row's own user_id. A user could still insert or
-- update a row of theirs that points at another user's parent row (a set
-- into someone else's workout entry, an entry into someone else's workout).
-- These policies keep USING as before and add WITH CHECK: the row is the
-- caller's AND every user-owned row it references is the caller's too.
-- Nullable references may stay NULL. Re-runnable.
-- Generated from the foreign keys to tables with a user_id column; when a
-- new such foreign key is added, extend the matching policy here.
-- ============================================================

DROP POLICY IF EXISTS "Users can manage own exercise_prs" ON exercise_prs;
CREATE POLICY "Users can manage own exercise_prs" ON exercise_prs
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = exercise_prs.exercise_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own program_exercise_alternatives" ON program_exercise_alternatives;
CREATE POLICY "Users can manage own program_exercise_alternatives" ON program_exercise_alternatives
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = program_exercise_alternatives.exercise_id AND parent.user_id = auth.uid()))
    AND (program_exercise_id IS NULL OR EXISTS (SELECT 1 FROM program_exercises AS parent WHERE parent.id = program_exercise_alternatives.program_exercise_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own program_exercises" ON program_exercises;
CREATE POLICY "Users can manage own program_exercises" ON program_exercises
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = program_exercises.exercise_id AND parent.user_id = auth.uid()))
    AND (program_day_id IS NULL OR EXISTS (SELECT 1 FROM workout_days AS parent WHERE parent.id = program_exercises.program_day_id AND parent.user_id = auth.uid()))
    AND (program_id IS NULL OR EXISTS (SELECT 1 FROM programs AS parent WHERE parent.id = program_exercises.program_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own set_entries" ON set_entries;
CREATE POLICY "Users can manage own set_entries" ON set_entries
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (workout_exercise_entry_id IS NULL OR EXISTS (SELECT 1 FROM workout_exercise_entries AS parent WHERE parent.id = set_entries.workout_exercise_entry_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own workout_bonus_cardio" ON workout_bonus_cardio;
CREATE POLICY "Users can manage own workout_bonus_cardio" ON workout_bonus_cardio
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (workout_id IS NULL OR EXISTS (SELECT 1 FROM workouts AS parent WHERE parent.id = workout_bonus_cardio.workout_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own workout_day_exercises" ON workout_day_exercises;
CREATE POLICY "Users can manage own workout_day_exercises" ON workout_day_exercises
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = workout_day_exercises.exercise_id AND parent.user_id = auth.uid()))
    AND (workout_day_id IS NULL OR EXISTS (SELECT 1 FROM workout_days AS parent WHERE parent.id = workout_day_exercises.workout_day_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own workout_days" ON workout_days;
CREATE POLICY "Users can manage own workout_days" ON workout_days
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (program_id IS NULL OR EXISTS (SELECT 1 FROM programs AS parent WHERE parent.id = workout_days.program_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own workout_exercise_entries" ON workout_exercise_entries;
CREATE POLICY "Users can manage own workout_exercise_entries" ON workout_exercise_entries
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = workout_exercise_entries.exercise_id AND parent.user_id = auth.uid()))
    AND (original_exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = workout_exercise_entries.original_exercise_id AND parent.user_id = auth.uid()))
    AND (workout_day_exercise_id IS NULL OR EXISTS (SELECT 1 FROM workout_day_exercises AS parent WHERE parent.id = workout_exercise_entries.workout_day_exercise_id AND parent.user_id = auth.uid()))
    AND (workout_id IS NULL OR EXISTS (SELECT 1 FROM workouts AS parent WHERE parent.id = workout_exercise_entries.workout_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own workout_template_exercises" ON workout_template_exercises;
CREATE POLICY "Users can manage own workout_template_exercises" ON workout_template_exercises
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (exercise_id IS NULL OR EXISTS (SELECT 1 FROM exercises AS parent WHERE parent.id = workout_template_exercises.exercise_id AND parent.user_id = auth.uid()))
    AND (template_id IS NULL OR EXISTS (SELECT 1 FROM workout_templates AS parent WHERE parent.id = workout_template_exercises.template_id AND parent.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own workouts" ON workouts;
CREATE POLICY "Users can manage own workouts" ON workouts
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (workout_day_id IS NULL OR EXISTS (SELECT 1 FROM workout_days AS parent WHERE parent.id = workouts.workout_day_id AND parent.user_id = auth.uid()))
  );
