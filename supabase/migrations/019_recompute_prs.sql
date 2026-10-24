-- ============================================================
-- Migration 019: Recompute PRs from workout history
--
-- PRs are derived data: they can always be rebuilt from set_entries.
-- Rows written before migration 018 mixed tools (a dumbbell set could
-- hold the barbell PR), so this wipes exercise_prs and replays every
-- completed workout through upsert_exercise_prs, per tool.
--
-- Replaces BACKFILL 2 of the old apply_010_013.sql.
-- Re-runnable: the result depends only on the workout history.
-- Requires migration 018 (4-arg upsert_exercise_prs).
-- ============================================================

DELETE FROM exercise_prs;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      wee.user_id,
      wee.exercise_id,
      wee.equipment_type,
      w.started_at
    FROM workout_exercise_entries wee
    JOIN workouts w     ON w.id = wee.workout_id
    JOIN set_entries se ON se.workout_exercise_entry_id = wee.id
    WHERE w.completed_at IS NOT NULL
      AND se.completed   = true
      AND se.is_warmup   = false
      AND se.weight_kg   IS NOT NULL
      AND se.reps        IS NOT NULL
      AND se.reps        > 0
    ORDER BY w.started_at  -- oldest first so achieved_at lands on the first time a PR was hit
  LOOP
    PERFORM upsert_exercise_prs(r.user_id, r.exercise_id, r.started_at, r.equipment_type);
  END LOOP;
END;
$$;
