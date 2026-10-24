-- Checks the workout RPCs (021) and write ownership (022) for verify-migrations.sh, run after fixture.sql.
-- Runs as the `authenticated` role so row-level security applies, like on Supabase.
-- Every check RAISEs on failure (psql runs with ON_ERROR_STOP).

-- Supabase grants these to `authenticated`; the plain local Postgres doesn't.
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;

-- A second user, for the checks that one user can't write into another's rows
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'other@example.com');

-- A program slot whose target_sets the save should update (owned by the fixture user)
INSERT INTO programs (id, user_id, name) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'RPC test program');
INSERT INTO workout_days (id, program_id, user_id, name) VALUES
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'Day A');
INSERT INTO workout_day_exercises (id, workout_day_id, exercise_id, user_id, target_sets) VALUES
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', 3);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

CREATE TEMP TABLE started AS
SELECT start_workout(
  '{"workout_day_id": "00000000-0000-0000-0000-0000000000f2", "is_deload": false}',
  '[{"exercise_id": "00000000-0000-0000-0000-0000000000e1",
     "workout_day_exercise_id": "00000000-0000-0000-0000-0000000000f3",
     "sets": [{"set_number": 1, "weight_kg": 60, "reps": 8, "is_warmup": true},
              {"set_number": 2, "weight_kg": 100, "reps": 5, "is_warmup": false}]},
    {"exercise_id": "00000000-0000-0000-0000-0000000000e2", "workout_day_exercise_id": null, "sets": []}]'
) AS r;

DO $$
DECLARE r jsonb := (SELECT r FROM started);
BEGIN
  IF jsonb_array_length(r->'entries') <> 2
     OR r->'entries'->0->>'exercise_id' <> '00000000-0000-0000-0000-0000000000e1'
     OR jsonb_array_length(r->'entries'->0->'set_entries') <> 2
     OR (r->'entries'->0->'set_entries'->0->>'is_warmup')::boolean IS NOT TRUE
     OR (r->'entries'->1->'set_entries') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'start_workout returned %', r;
  END IF;
  IF (SELECT array_agg(exercise_id ORDER BY created_at) FROM workout_exercise_entries
      WHERE workout_id = (r->'workout'->>'id')::uuid)
     <> ARRAY['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2']::uuid[] THEN
    RAISE EXCEPTION 'start_workout lost the entry order';
  END IF;
END $$;

-- An interrupted start (second entry fails) leaves nothing behind
DO $$
DECLARE before bigint := (SELECT count(*) FROM workouts);
BEGIN
  BEGIN
    PERFORM start_workout('{"is_deload": false}',
      '[{"exercise_id": "00000000-0000-0000-0000-0000000000e1", "sets": [{"set_number": 1}]},
        {"exercise_id": "00000000-0000-0000-0000-00000000dead", "sets": []}]');
    RAISE EXCEPTION 'start_workout accepted an unknown exercise';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM workouts) <> before THEN
    RAISE EXCEPTION 'interrupted start_workout left a workout behind';
  END IF;
END $$;

-- Finish: change the warmup, drop the work set, add two new work sets
DO $$
DECLARE
  r       jsonb := (SELECT r FROM started);
  entry   uuid  := (r->'entries'->0->>'id')::uuid;
  warmup  uuid  := (r->'entries'->0->'set_entries'->0->>'id')::uuid;
  dropped uuid  := (r->'entries'->0->'set_entries'->1->>'id')::uuid;
BEGIN
  PERFORM save_workout_sets(
    jsonb_build_array(jsonb_build_object(
      'entryId', entry,
      'workoutDayExerciseId', '00000000-0000-0000-0000-0000000000f3',
      'sets', jsonb_build_array(
        jsonb_build_object('id', warmup, 'set_number', 1, 'weight_kg', 62.5, 'reps', 8, 'completed', true, 'is_warmup', true),
        jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c1', 'set_number', 2, 'weight_kg', 105, 'reps', 5, 'completed', true),
        jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c2', 'set_number', 3, 'weight_kg', 105, 'reps', 4, 'completed', true,
                           'too_heavy', true, 'too_heavy_reps', 4)))),
    ARRAY[warmup, dropped]);

  IF EXISTS (SELECT 1 FROM set_entries WHERE id = dropped) THEN RAISE EXCEPTION 'removed set was kept'; END IF;
  IF (SELECT weight_kg FROM set_entries WHERE id = warmup) <> 62.5 THEN RAISE EXCEPTION 'set was not updated'; END IF;
  IF (SELECT count(*) FROM set_entries WHERE workout_exercise_entry_id = entry) <> 3 THEN RAISE EXCEPTION 'new sets missing'; END IF;
  IF (SELECT too_heavy_reps FROM set_entries WHERE id = '00000000-0000-0000-0000-0000000000c2') <> 4 THEN RAISE EXCEPTION 'too_heavy_reps lost'; END IF;
  IF (SELECT target_sets FROM workout_day_exercises WHERE id = '00000000-0000-0000-0000-0000000000f3') <> 2 THEN
    RAISE EXCEPTION 'target_sets not set to the work-set count';
  END IF;
END $$;

-- Another user can neither change nor delete these sets (row-level security). Whether the
-- attempt errors or is silently skipped doesn't matter; the check below is that nothing changed.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $$
BEGIN
  PERFORM save_workout_sets(
    '[{"entryId": "00000000-0000-0000-0000-0000000000b1", "workoutDayExerciseId": null,
       "sets": [{"id": "00000000-0000-0000-0000-0000000000c1", "set_number": 9, "weight_kg": 1, "reps": 1}]}]',
    ARRAY['00000000-0000-0000-0000-0000000000c2']::uuid[]);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Nor attach rows of their own to the first user's rows (migration 022)
DO $$
BEGIN
  BEGIN
    INSERT INTO set_entries (workout_exercise_entry_id, user_id, set_number)
    VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002', 1);
    RAISE EXCEPTION 'a set went into another user''s exercise entry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO workout_exercise_entries (workout_id, exercise_id, user_id)
    VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'an entry went into another user''s workout';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET request.jwt.claim.sub;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT weight_kg FROM set_entries WHERE id = '00000000-0000-0000-0000-0000000000c1') <> 105
     OR NOT EXISTS (SELECT 1 FROM set_entries WHERE id = '00000000-0000-0000-0000-0000000000c2') THEN
    RAISE EXCEPTION 'another user changed the sets';
  END IF;
END $$;

-- Leave the fixture as it was for the rest of verify-migrations.sh
DELETE FROM workouts WHERE id = (SELECT (r->'workout'->>'id')::uuid FROM started);
DELETE FROM programs WHERE id = '00000000-0000-0000-0000-0000000000f1';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000002';
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth FROM authenticated;
REVOKE USAGE ON SCHEMA public, auth FROM authenticated;
