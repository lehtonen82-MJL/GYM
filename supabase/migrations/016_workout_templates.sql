-- ============================================================
-- Migration 016: Workout Templates (Freestyle / Custom Workouts)
--
-- Stores user-created workout templates that can be started
-- pre-filled. Templates are created by saving a freestyle
-- (blank) workout at finish time.
-- ============================================================

CREATE TABLE IF NOT EXISTS workout_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_templates"
  ON workout_templates FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workout_templates_user
  ON workout_templates(user_id, last_used_at DESC NULLS LAST);

-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id                      uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id             uuid  NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  user_id                 uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id             uuid  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  exercise_name_snapshot  text  NOT NULL,
  target_sets             int   NOT NULL DEFAULT 3,
  target_reps             int   NOT NULL DEFAULT 8,
  sort_order              int   NOT NULL DEFAULT 0
);

ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout_template_exercises"
  ON workout_template_exercises FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wte_template
  ON workout_template_exercises(template_id, sort_order);
