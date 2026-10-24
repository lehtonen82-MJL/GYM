-- ============================================================
-- Migration 018: Equipment-scoped PRs (Phase G3)
--
-- PRs are tracked separately per tool: a 30 kg dumbbell press PR
-- must not compete with a 60 kg barbell press PR.
--
-- 1. Uniqueness becomes (user_id, exercise_id, pr_type, equipment_type).
--    NULLS NOT DISTINCT keeps one row per PR type for unlinked exercises
--    that have no tool at all.
-- 2. upsert_exercise_prs gains p_equipment_type. An entry's tool is
--    COALESCE(entry.equipment_type, definition default) — the same rule
--    the app uses (src/lib/equipment.ts → effectiveEquipment).
--
-- Idempotent: safe to run more than once. Requires migration 017.
-- ============================================================

-- 1a. Normalise existing PR rows to the effective tool (017 backfilled only linked ones)
UPDATE exercise_prs ep
SET equipment_type = ed.equipment_type
FROM exercises ex
JOIN exercise_definitions ed ON ex.exercise_definition_id = ed.id
WHERE ep.exercise_id = ex.id
  AND ep.equipment_type IS NULL;

-- 1b. Swap the unique constraint
ALTER TABLE exercise_prs
  DROP CONSTRAINT IF EXISTS exercise_prs_user_id_exercise_id_pr_type_key;

ALTER TABLE exercise_prs
  DROP CONSTRAINT IF EXISTS exercise_prs_user_exercise_type_equipment_key;

ALTER TABLE exercise_prs
  ADD CONSTRAINT exercise_prs_user_exercise_type_equipment_key
  UNIQUE NULLS NOT DISTINCT (user_id, exercise_id, pr_type, equipment_type);

-- 2. Replace the PR function (drop the old 3-arg signature so calls are unambiguous)
DROP FUNCTION IF EXISTS upsert_exercise_prs(uuid, uuid, timestamptz);

CREATE OR REPLACE FUNCTION upsert_exercise_prs(
  p_user_id            uuid,
  p_exercise_id        uuid,
  p_workout_started_at timestamptz,
  p_equipment_type     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_default_eq   text;
  v_equipment    text;
  v_max_weight   numeric(10,2);
  v_1rm_estimate numeric(10,2);
  v_session_vol  numeric(10,2);
BEGIN
  -- Default tool of the exercise (NULL when not linked to the library)
  SELECT ed.equipment_type
  INTO v_default_eq
  FROM exercises ex
  JOIN exercise_definitions ed ON ed.id = ex.exercise_definition_id
  WHERE ex.id = p_exercise_id
    AND ex.user_id = p_user_id;

  v_equipment := COALESCE(p_equipment_type, v_default_eq);

  -- max_weight and session volume from completed non-warmup sets done with this tool
  SELECT
    MAX(se.weight_kg),
    SUM(se.weight_kg * se.reps)
  INTO v_max_weight, v_session_vol
  FROM set_entries se
  JOIN workout_exercise_entries wee ON wee.id = se.workout_exercise_entry_id
  JOIN workouts w ON w.id = wee.workout_id
  WHERE wee.exercise_id    = p_exercise_id
    AND wee.user_id        = p_user_id
    AND COALESCE(wee.equipment_type, v_default_eq) IS NOT DISTINCT FROM v_equipment
    AND se.completed       = true
    AND se.is_warmup       = false
    AND se.weight_kg       IS NOT NULL
    AND se.reps            IS NOT NULL
    AND se.reps            > 0
    AND w.started_at       = p_workout_started_at;

  -- 1RM estimate: Epley restricted to 1–12 reps (see migration 015)
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
    AND COALESCE(wee.equipment_type, v_default_eq) IS NOT DISTINCT FROM v_equipment
    AND se.completed       = true
    AND se.is_warmup       = false
    AND se.weight_kg       IS NOT NULL
    AND se.reps            IS NOT NULL
    AND se.reps            BETWEEN 1 AND 12
    AND w.started_at       = p_workout_started_at;

  IF v_max_weight IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, equipment_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_weight', v_equipment, v_max_weight, p_workout_started_at)
    ON CONFLICT ON CONSTRAINT exercise_prs_user_exercise_type_equipment_key
    DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

  IF v_1rm_estimate IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, equipment_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, '1rm_estimate', v_equipment, v_1rm_estimate, p_workout_started_at)
    ON CONFLICT ON CONSTRAINT exercise_prs_user_exercise_type_equipment_key
    DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

  IF v_session_vol IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, equipment_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_volume', v_equipment, v_session_vol, p_workout_started_at)
    ON CONFLICT ON CONSTRAINT exercise_prs_user_exercise_type_equipment_key
    DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value
                         THEN EXCLUDED.achieved_at
                         ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;
END;
$$;
