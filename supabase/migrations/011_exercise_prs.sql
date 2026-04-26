-- ============================================================
-- Migration 011: Exercise PRs
--
-- Tracks personal records per exercise per user.
-- A DB trigger updates this table after each set_entries insert/update.
-- ============================================================

CREATE TABLE IF NOT EXISTS exercise_prs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id  uuid        NOT NULL REFERENCES exercises(id)  ON DELETE CASCADE,
  pr_type      text        NOT NULL CHECK (pr_type IN (
                 'max_weight',     -- heaviest single set weight (any rep count)
                 '1rm_estimate',   -- Epley: weight × (1 + reps/30)
                 'max_volume'      -- highest total volume in one workout session
               )),
  value        numeric(10,2) NOT NULL,
  achieved_at  timestamptz NOT NULL,  -- started_at of the workout where PR was hit
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id, pr_type)
);

ALTER TABLE exercise_prs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own exercise_prs"
  ON exercise_prs FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prs_user_exercise ON exercise_prs(user_id, exercise_id);

-- ----------------------------------------------------------
-- Function: upsert PRs for a workout exercise entry after sets are logged.
-- Called from application code (actions.ts) after workout completion,
-- NOT via trigger, to avoid firing on every individual set update.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_exercise_prs(
  p_user_id     uuid,
  p_exercise_id uuid,
  p_workout_started_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_weight   numeric(10,2);
  v_1rm_estimate numeric(10,2);
  v_session_vol  numeric(10,2);
BEGIN
  -- Only look at completed, non-warmup sets
  SELECT
    MAX(weight_kg),
    MAX(weight_kg * (1.0 + reps::numeric / 30.0)),
    SUM(weight_kg * reps)
  INTO v_max_weight, v_1rm_estimate, v_session_vol
  FROM set_entries se
  JOIN workout_exercise_entries wee ON wee.id = se.workout_exercise_entry_id
  JOIN workouts w ON w.id = wee.workout_id
  WHERE wee.exercise_id = p_exercise_id
    AND wee.user_id      = p_user_id
    AND se.completed     = true
    AND se.is_warmup     = false
    AND se.weight_kg     IS NOT NULL
    AND se.reps          IS NOT NULL
    AND se.reps          > 0
    AND w.started_at     = p_workout_started_at;

  -- max_weight PR
  IF v_max_weight IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_weight', v_max_weight, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type)
    DO UPDATE SET
      value      = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at = now();
  END IF;

  -- 1rm_estimate PR
  IF v_1rm_estimate IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, '1rm_estimate', v_1rm_estimate, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type)
    DO UPDATE SET
      value      = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at = now();
  END IF;

  -- max_volume PR
  IF v_session_vol IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_volume', v_session_vol, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type)
    DO UPDATE SET
      value      = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at = now();
  END IF;
END;
$$;
