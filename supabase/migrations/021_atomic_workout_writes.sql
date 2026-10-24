-- ============================================================
-- Migration 021: atomic workout writes (IMPROVEMENT_PLAN Phase 4)
--
-- Two RPCs so a workout is never left half-written:
--   start_workout     — a new workout with its exercise entries and planned sets
--   save_workout_sets — a finished workout's sets (deletes, upserts, target_sets)
-- Each runs in one transaction. SECURITY INVOKER: they run as the caller, so the
-- existing row-level security (auth.uid() = user_id) applies to every row touched.
-- Re-runnable (CREATE OR REPLACE).
-- ============================================================

-- p_workout: { workout_day_id, is_deload, notes }
-- p_entries: [{ exercise_id, workout_day_exercise_id, sets: [{ set_number, weight_kg, reps, is_warmup }] }]
-- Returns { workout, entries: [entry + set_entries] }, entries in the given order.
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

  INSERT INTO workouts (user_id, workout_day_id, is_deload, notes)
  VALUES (
    v_user,
    (p_workout->>'workout_day_id')::uuid,
    coalesce((p_workout->>'is_deload')::boolean, false),
    p_workout->>'notes'
  )
  RETURNING * INTO v_workout;

  FOR e IN SELECT value FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS t(value, ord) ORDER BY ord LOOP
    -- clock_timestamp(): entries are listed by created_at, and now() is the same for the whole transaction
    INSERT INTO workout_exercise_entries (workout_id, exercise_id, workout_day_exercise_id, user_id, created_at)
    VALUES (v_workout.id, (e->>'exercise_id')::uuid, (e->>'workout_day_exercise_id')::uuid, v_user, clock_timestamp())
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

-- The sets of a save_workout_sets payload as rows.
CREATE OR REPLACE FUNCTION workout_sets_payload(p_entries jsonb)
RETURNS TABLE (
  entry_id uuid, wde_id uuid, id uuid, set_number int, weight_kg numeric, reps int,
  completed boolean, is_warmup boolean, too_heavy boolean, too_heavy_reps int
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
         (s->>'too_heavy_reps')::int
  FROM jsonb_array_elements(p_entries) AS e,
       jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) AS s
$$;

-- p_entries: [{ entryId, workoutDayExerciseId, sets: [{ id, set_number, weight_kg, reps, completed,
--               is_warmup, too_heavy, too_heavy_reps }] }]
-- p_original_ids: the set ids that existed in the database when the workout was loaded.
-- Deletes original sets that are gone, upserts every current set, and sets each program
-- exercise's target_sets to its work-set count (when it has any).
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
    AND id NOT IN (SELECT p.id FROM workout_sets_payload(p_entries) AS p);

  INSERT INTO set_entries (id, workout_exercise_entry_id, user_id, set_number, weight_kg, reps,
                           completed, is_warmup, too_heavy, too_heavy_reps)
  SELECT p.id, p.entry_id, v_user, p.set_number, p.weight_kg, p.reps, p.completed, p.is_warmup, p.too_heavy, p.too_heavy_reps
  FROM workout_sets_payload(p_entries) AS p
  ON CONFLICT (id) DO UPDATE SET
    set_number     = EXCLUDED.set_number,
    weight_kg      = EXCLUDED.weight_kg,
    reps           = EXCLUDED.reps,
    completed      = EXCLUDED.completed,
    is_warmup      = EXCLUDED.is_warmup,
    too_heavy      = EXCLUDED.too_heavy,
    too_heavy_reps = EXCLUDED.too_heavy_reps
  WHERE set_entries.user_id = v_user;

  UPDATE workout_day_exercises AS wde
  SET target_sets = c.work_sets
  FROM (
    SELECT p.wde_id, count(*) FILTER (WHERE NOT p.is_warmup) AS work_sets
    FROM workout_sets_payload(p_entries) AS p
    WHERE p.wde_id IS NOT NULL
    GROUP BY p.wde_id
  ) AS c
  WHERE wde.id = c.wde_id
    AND c.work_sets > 0
    AND wde.user_id = v_user;
END;
$$;
