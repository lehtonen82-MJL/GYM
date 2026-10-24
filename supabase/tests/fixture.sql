-- Invented test data (no real people) for verify-migrations.sh.
-- One user, Bench Press done with barbell (untagged = default tool) and dumbbell;
-- OHP (library alias) and a custom exercise for the linking check.

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'test@example.com');

INSERT INTO exercises (id, user_id, name, normalized_name) VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', 'Bench Press', 'bench press'),
  -- linked by alias in 020 (link_unlinked_exercises)
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000001', 'OHP', 'ohp'),
  -- not in the library: must stay unlinked
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000001', 'My Custom Thing', 'my custom thing');

INSERT INTO workouts (id, user_id, started_at, completed_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', '2026-01-05 10:00+00', '2026-01-05 11:00+00'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', '2026-01-12 10:00+00', '2026-01-12 11:00+00');

INSERT INTO workout_exercise_entries (id, workout_id, exercise_id, user_id, equipment_type) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', NULL),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', 'dumbbell');

INSERT INTO set_entries (workout_exercise_entry_id, user_id, set_number, weight_kg, reps, completed) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 1, 100, 5, true),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 2, 100, 5, true),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000001', 1, 36, 8, true);
