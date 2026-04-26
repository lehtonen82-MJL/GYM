-- Exercise alternatives: allow users to define alternative exercises for a program
-- slot, and track when a mid-workout swap occurred.

-- Pre-defined alternatives for a program exercise slot
CREATE TABLE IF NOT EXISTS program_exercise_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_exercise_id uuid NOT NULL REFERENCES program_exercises(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_exercise_id, exercise_id)
);

ALTER TABLE program_exercise_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own program_exercise_alternatives"
  ON program_exercise_alternatives FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pea_program_exercise
  ON program_exercise_alternatives(program_exercise_id);

-- Track the original (programmed) exercise when a mid-workout swap happens.
-- NULL = no swap occurred; non-NULL = exercise_id holds the alternative used.
ALTER TABLE workout_exercise_entries
  ADD COLUMN IF NOT EXISTS original_exercise_id uuid
    REFERENCES exercises(id) ON DELETE SET NULL;
