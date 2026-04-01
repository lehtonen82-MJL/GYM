-- ============================================
-- Seed data: Default program
-- Run AFTER schema.sql
-- Replace YOUR_USER_ID with actual user UUID after signup
-- ============================================

-- This function creates the default program for a given user
-- Call it after the user signs up: SELECT create_default_program('user-uuid-here');

create or replace function create_default_program(p_user_id uuid)
returns void as $$
declare
  v_program_id uuid;
  v_day_oly uuid;
  v_day_back uuid;
  v_day_legs uuid;
  v_day_chest uuid;
  v_exercise_id uuid;
begin
  -- Create program
  insert into programs (user_id, name) values (p_user_id, 'Default Program')
  returning id into v_program_id;

  -- Create workout days (TI=Tue, TO=Thu, LA=Sat, SU=Sun)
  insert into workout_days (program_id, user_id, name, day_of_week, day_label)
  values (v_program_id, p_user_id, 'Oly', 2, 'TI') returning id into v_day_oly;

  insert into workout_days (program_id, user_id, name, day_of_week, day_label)
  values (v_program_id, p_user_id, 'Back', 4, 'TO') returning id into v_day_back;

  insert into workout_days (program_id, user_id, name, day_of_week, day_label)
  values (v_program_id, p_user_id, 'Legs', 6, 'LA') returning id into v_day_legs;

  insert into workout_days (program_id, user_id, name, day_of_week, day_label)
  values (v_program_id, p_user_id, 'Chest', 0, 'SU') returning id into v_day_chest;

  -- TI – Oly exercises
  insert into exercises (user_id, name) values (p_user_id, 'Snatch') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_oly, v_exercise_id, p_user_id, 0, 5, 3);

  insert into exercises (user_id, name) values (p_user_id, 'Clean & Jerk') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_oly, v_exercise_id, p_user_id, 1, 5, 2);

  insert into exercises (user_id, name) values (p_user_id, 'Calves') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_oly, v_exercise_id, p_user_id, 2, 3, 15);

  -- TO – Back exercises
  insert into exercises (user_id, name) values (p_user_id, 'Pull-ups / Lat Pulldown') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_back, v_exercise_id, p_user_id, 0, 3, 8);

  insert into exercises (user_id, name) values (p_user_id, 'Row') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_back, v_exercise_id, p_user_id, 1, 3, 8);

  insert into exercises (user_id, name) values (p_user_id, 'Face Pull') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_back, v_exercise_id, p_user_id, 2, 3, 15);

  insert into exercises (user_id, name) values (p_user_id, 'RDL') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_back, v_exercise_id, p_user_id, 3, 3, 8);

  -- LA – Legs exercises
  insert into exercises (user_id, name) values (p_user_id, 'Back Squat') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_legs, v_exercise_id, p_user_id, 0, 3, 5);

  insert into exercises (user_id, name) values (p_user_id, 'Front Squat') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_legs, v_exercise_id, p_user_id, 1, 3, 5);

  insert into exercises (user_id, name) values (p_user_id, 'Leg Curl') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_legs, v_exercise_id, p_user_id, 2, 3, 10);

  insert into exercises (user_id, name) values (p_user_id, 'Calves (Legs)') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_legs, v_exercise_id, p_user_id, 3, 3, 15);

  -- SU – Chest exercises
  insert into exercises (user_id, name) values (p_user_id, 'Bench Press') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_chest, v_exercise_id, p_user_id, 0, 3, 5);

  insert into exercises (user_id, name) values (p_user_id, 'Incline Bench') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_chest, v_exercise_id, p_user_id, 1, 3, 8);

  insert into exercises (user_id, name) values (p_user_id, 'Dips') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_chest, v_exercise_id, p_user_id, 2, 3, 10);

  insert into exercises (user_id, name) values (p_user_id, 'Fly') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_chest, v_exercise_id, p_user_id, 3, 3, 12);

  insert into exercises (user_id, name) values (p_user_id, 'Triceps') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_chest, v_exercise_id, p_user_id, 4, 3, 12);

  insert into exercises (user_id, name) values (p_user_id, 'Light Row') returning id into v_exercise_id;
  insert into workout_day_exercises (workout_day_id, exercise_id, user_id, order_index, target_sets, target_reps)
  values (v_day_chest, v_exercise_id, p_user_id, 5, 3, 15);
end;
$$ language plpgsql security definer;
