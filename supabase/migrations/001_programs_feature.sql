-- ============================================
-- Phase 1 Migration: Program Builder Feature
-- ============================================

-- ──────────────────────────────────────────
-- ALTER Programs table
-- ──────────────────────────────────────────

alter table programs add column if not exists description text;
alter table programs add column if not exists mode text default 'weekday' check (mode in ('weekday', 'session'));
alter table programs add column if not exists is_active boolean default true;
alter table programs add column if not exists updated_at timestamptz default now();

-- ──────────────────────────────────────────
-- Update WorkoutDays to support new structure
-- ──────────────────────────────────────────

alter table workout_days add column if not exists kind text default 'legacy' check (kind in ('weekday', 'session', 'legacy'));
alter table workout_days add column if not exists day_order int;
alter table workout_days add column if not exists weekday_label text;
alter table workout_days add column if not exists session_label text;
alter table workout_days add column if not exists updated_at timestamptz default now();

-- For existing rows, set day_order based on day_of_week
update workout_days set day_order = day_of_week where day_order is null;

-- ──────────────────────────────────────────
-- New ProgramExercise table (separate from legacy WorkoutDayExercise)
-- ──────────────────────────────────────────

create table if not exists program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  program_day_id uuid not null references workout_days(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name_snapshot text not null,
  scheme_text text,
  target_sets int,
  target_reps_text text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table program_exercises enable row level security;
create policy "Users can view own program_exercises" on program_exercises for select using (auth.uid() = user_id);
create policy "Users can manage own program_exercises" on program_exercises for all using (auth.uid() = user_id);
create index if not exists idx_program_exercises_program on program_exercises(program_id);
create index if not exists idx_program_exercises_day on program_exercises(program_day_id);

-- ──────────────────────────────────────────
-- Enhance Exercises table
-- ──────────────────────────────────────────

alter table exercises add column if not exists normalized_name text;
alter table exercises add column if not exists category text;
alter table exercises add column if not exists is_main_lift boolean default false;
alter table exercises add column if not exists updated_at timestamptz default now();

-- Update existing exercises with normalized names
update exercises set normalized_name = lower(trim(name)) where normalized_name is null;

-- ──────────────────────────────────────────
-- Update indexes for performance
-- ──────────────────────────────────────────

create index if not exists idx_programs_user_active on programs(user_id, is_active);
create index if not exists idx_exercises_user_normalized on exercises(user_id, normalized_name);
create index if not exists idx_workout_days_program on workout_days(program_id);

-- ──────────────────────────────────────────
-- Update trigger for new tables
-- ──────────────────────────────────────────

create or replace function public.update_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_programs_updated_at before update on programs
  for each row execute procedure public.update_updated_at_timestamp();

create trigger update_exercises_updated_at before update on exercises
  for each row execute procedure public.update_updated_at_timestamp();

create trigger update_workout_days_updated_at before update on workout_days
  for each row execute procedure public.update_updated_at_timestamp();

create trigger update_program_exercises_updated_at before update on program_exercises
  for each row execute procedure public.update_updated_at_timestamp();
