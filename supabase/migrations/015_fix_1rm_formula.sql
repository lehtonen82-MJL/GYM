-- ============================================================
-- Migration 015: Fix 1RM Estimation Formula
--
-- The Epley (1985) formula is: 1RM = w × (1 + r/30)
-- It is the most widely cited and is scientifically validated
-- for compound lifts (squat, bench, deadlift) in the 2–12 rep range.
--
-- Fixes applied:
--
-- 1. r=1 edge case: Epley gives w×1.033 which is incorrect — if the
--    athlete lifted w for exactly 1 rep, that IS their 1RM.
--    Fix: CASE WHEN reps = 1 THEN weight ELSE Epley(w,r) END
--
-- 2. High-rep unreliability: Epley becomes increasingly inaccurate
--    above 12 reps. Neural efficiency, endurance, and metabolic factors
--    diverge from pure strength at high rep ranges. Research consensus
--    (Brzycki 1993, Reynolds 2006, Mayhew 1992) is to cap at 10–12 reps.
--    Fix: only consider sets with reps BETWEEN 1 AND 12.
--
-- Reference comparisons (w=100 kg):
--   reps | Epley  | Brzycki | Lander
--      1 | 103.3  | 100.0   | 100.0   <- Epley overestimates
--      3 | 110.0  | 109.5   | 109.0
--      5 | 116.7  | 116.7   | 115.5
--      8 | 126.7  | 128.6   | 125.3
--     10 | 133.3  | 136.4   | 131.8
--     12 | 140.0  | 144.0   | 138.0   <- cap here
--     15 | 150.0  | 163.6   | 148.2   <- unreliable territory
-- ============================================================

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
  -- Gather max_weight and session volume from ALL completed non-warmup sets
  SELECT
    MAX(se.weight_kg),
    SUM(se.weight_kg * se.reps)
  INTO v_max_weight, v_session_vol
  FROM set_entries se
  JOIN workout_exercise_entries wee ON wee.id = se.workout_exercise_entry_id
  JOIN workouts w ON w.id = wee.workout_id
  WHERE wee.exercise_id    = p_exercise_id
    AND wee.user_id        = p_user_id
    AND se.completed       = true
    AND se.is_warmup       = false
    AND se.weight_kg       IS NOT NULL
    AND se.reps            IS NOT NULL
    AND se.reps            > 0
    AND w.started_at       = p_workout_started_at;

  -- 1RM estimate: Epley formula restricted to 1–12 reps
  --   r=1  → return weight directly (you cannot exceed 1RM on a max single)
  --   r=2–12 → Epley: w × (1 + r/30)
  --   r>12 → excluded (unreliable estimation range)
  SELECT
    MAX(
      CASE
        WHEN se.reps = 1 THEN se.weight_kg
        ELSE se.weight_kg * (1.0 + se.reps::numeric / 30.0)
      END
    )
  INTO v_1rm_estimate
  FROM set_entries se
  JOIN workout_exercise_entries wee ON wee.id = se.workout_exercise_entry_id
  JOIN workouts w ON w.id = wee.workout_id
  WHERE wee.exercise_id    = p_exercise_id
    AND wee.user_id        = p_user_id
    AND se.completed       = true
    AND se.is_warmup       = false
    AND se.weight_kg       IS NOT NULL
    AND se.reps            IS NOT NULL
    AND se.reps            BETWEEN 1 AND 12
    AND w.started_at       = p_workout_started_at;

  -- max_weight PR
  IF v_max_weight IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_weight', v_max_weight, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type)
    DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

  -- 1rm_estimate PR
  IF v_1rm_estimate IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, '1rm_estimate', v_1rm_estimate, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type)
    DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

  -- max_volume PR
  IF v_session_vol IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_volume', v_session_vol, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type)
    DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

END;
$$;
