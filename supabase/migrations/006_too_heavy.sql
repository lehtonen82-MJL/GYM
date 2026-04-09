-- Add too_heavy flag to workout_exercise_entries
-- When a user marks an exercise as "too heavy", the next workout shows a warning pill
alter table workout_exercise_entries add column if not exists too_heavy boolean default false;
