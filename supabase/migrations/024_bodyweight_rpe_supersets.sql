-- ============================================================
-- Migration 024: body weight, RPE, supersets (IMPROVEMENT_PLAN Phase 8)
--
-- - body_weights: one measurement per user per day (a new one replaces it)
-- - set_entries.rpe: optional rate of perceived exertion, 6–10 in half steps
-- - superset_group (one letter, "A1/A2" in program text → "A") on program_exercises
--   and workout_exercise_entries
-- - start_workout passes superset_group through; save_workout_sets saves rpe
--   (through workout_set_rows: like 021's workout_sets_payload plus rpe; a new name, because
--   re-running 021 recreates the old one and a function's return type can't change in place)
-- Re-runnable.
-- ============================================================

CREATE TABLE IF NOT EXISTS body_weights (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_on date        NOT NULL,
  weight_kg   numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, measured_on)
);
ALTER TABLE body_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own body_weights" ON body_weights;
CREATE POLICY "Users can manage own body_weights" ON body_weights
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE set_entries ADD COLUMN IF NOT EXISTS rpe numeric(3,1);
ALTER TABLE set_entries DROP CONSTRAINT IF EXISTS set_entries_rpe_check;
ALTER TABLE set_entries ADD CONSTRAINT set_entries_rpe_check
  CHECK (rpe IS NULL OR (rpe >= 6 AND rpe <= 10 AND rpe * 2 = round(rpe * 2)));

ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS superset_group text;
ALTER TABLE program_exercises DROP CONSTRAINT IF EXISTS program_exercises_superset_group_check;
ALTER TABLE program_exercises ADD CONSTRAINT program_exercises_superset_group_check
  CHECK (superset_group IS NULL OR superset_group ~ '^[A-Z]$');
ALTER TABLE workout_exercise_entries ADD COLUMN IF NOT EXISTS superset_group text;
ALTER TABLE workout_exercise_entries DROP CONSTRAINT IF EXISTS workout_exercise_entries_superset_group_check;
ALTER TABLE workout_exercise_entries ADD CONSTRAINT workout_exercise_entries_superset_group_check
  CHECK (superset_group IS NULL OR superset_group ~ '^[A-Z]$');

-- p_entries: [{ exercise_id, workout_day_exercise_id, superset_group, sets: [...] }]; otherwise as 023
CREATE OR REPLACE FUNCTION start_workout(p_workout jsonb, p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_workout workouts;
  v_entry   workout_exercise_entries;
  v_sets    jsonb;
  v_entries jsonb := '[]'::jsonb;
  e         jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'start_workout: not authenticated';
  END IF;

  INSERT INTO workouts (user_id, workout_day_id, is_deload, notes, import_session_name)
  VALUES (
    v_user,
    (p_workout->>'workout_day_id')::uuid,
    coalesce((p_workout->>'is_deload')::boolean, false),
    p_workout->>'notes',
    p_workout->>'import_session_name'
  )
  RETURNING * INTO v_workout;

  FOR e IN SELECT value FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS t(value, ord) ORDER BY ord LOOP
    -- clock_timestamp(): entries are listed by created_at, and now() is the same for the whole transaction
    INSERT INTO workout_exercise_entries (workout_id, exercise_id, workout_day_exercise_id, user_id, superset_group, created_at)
    VALUES (v_workout.id, (e->>'exercise_id')::uuid, (e->>'workout_day_exercise_id')::uuid, v_user, e->>'superset_group', clock_timestamp())
    RETURNING * INTO v_entry;

    WITH inserted AS (
      INSERT INTO set_entries (workout_exercise_entry_id, user_id, set_number, weight_kg, reps, completed, is_warmup)
      SELECT v_entry.id, v_user, (s->>'set_number')::int, (s->>'weight_kg')::numeric, (s->>'reps')::int,
             false, coalesce((s->>'is_warmup')::boolean, false)
      FROM jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) AS s
      RETURNING *
    )
    SELECT coalesce(jsonb_agg(to_jsonb(inserted) ORDER BY set_number), '[]'::jsonb) INTO v_sets FROM inserted;

    v_entries := v_entries || jsonb_build_array(to_jsonb(v_entry) || jsonb_build_object('set_entries', v_sets));
  END LOOP;

  RETURN jsonb_build_object('workout', to_jsonb(v_workout), 'entries', v_entries);
END;
$$;

-- The sets of a save_workout_sets payload as rows (021's workout_sets_payload + rpe).
CREATE OR REPLACE FUNCTION workout_set_rows(p_entries jsonb)
RETURNS TABLE (
  entry_id uuid, wde_id uuid, id uuid, set_number int, weight_kg numeric, reps int,
  completed boolean, is_warmup boolean, too_heavy boolean, too_heavy_reps int, rpe numeric
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (e->>'entryId')::uuid,
         (e->>'workoutDayExerciseId')::uuid,
         (s->>'id')::uuid,
         (s->>'set_number')::int,
         (s->>'weight_kg')::numeric,
         (s->>'reps')::int,
         coalesce((s->>'completed')::boolean, false),
         coalesce((s->>'is_warmup')::boolean, false),
         coalesce((s->>'too_heavy')::boolean, false),
         (s->>'too_heavy_reps')::int,
         (s->>'rpe')::numeric
  FROM jsonb_array_elements(p_entries) AS e,
       jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) AS s
$$;

-- As 021, also saving each set's rpe
CREATE OR REPLACE FUNCTION save_workout_sets(p_entries jsonb, p_original_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'save_workout_sets: not authenticated';
  END IF;

  DELETE FROM set_entries
  WHERE id = ANY (p_original_ids)
    AND user_id = v_user
    AND id NOT IN (SELECT p.id FROM workout_set_rows(p_entries) AS p);

  INSERT INTO set_entries (id, workout_exercise_entry_id, user_id, set_number, weight_kg, reps,
                           completed, is_warmup, too_heavy, too_heavy_reps, rpe)
  SELECT p.id, p.entry_id, v_user, p.set_number, p.weight_kg, p.reps, p.completed, p.is_warmup, p.too_heavy, p.too_heavy_reps, p.rpe
  FROM workout_set_rows(p_entries) AS p
  ON CONFLICT (id) DO UPDATE SET
    set_number     = EXCLUDED.set_number,
    weight_kg      = EXCLUDED.weight_kg,
    reps           = EXCLUDED.reps,
    completed      = EXCLUDED.completed,
    is_warmup      = EXCLUDED.is_warmup,
    too_heavy      = EXCLUDED.too_heavy,
    too_heavy_reps = EXCLUDED.too_heavy_reps,
    rpe            = EXCLUDED.rpe
  WHERE set_entries.user_id = v_user;

  UPDATE workout_day_exercises AS wde
  SET target_sets = c.work_sets
  FROM (
    SELECT p.wde_id, count(*) FILTER (WHERE NOT p.is_warmup) AS work_sets
    FROM workout_set_rows(p_entries) AS p
    WHERE p.wde_id IS NOT NULL
    GROUP BY p.wde_id
  ) AS c
  WHERE wde.id = c.wde_id
    AND c.work_sets > 0
    AND wde.user_id = v_user;
END;
$$;
