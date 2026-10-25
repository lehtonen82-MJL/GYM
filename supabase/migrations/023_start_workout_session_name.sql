-- ============================================================
-- Migration 023: start_workout takes a session name
--
-- Template workouts (no program day) are named by workouts.import_session_name.
-- start_workout (021) now accepts it in p_workout, so starting from a template can
-- go through the same single transaction as a program start. Otherwise identical
-- to 021's function. Re-runnable (CREATE OR REPLACE).
-- ============================================================

-- p_workout: { workout_day_id, is_deload, notes, import_session_name }
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
