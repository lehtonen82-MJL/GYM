-- ============================================
-- Program Builder Feature Migration
-- Adds program builder support while maintaining backward compatibility
-- ============================================

-- ────────────────────────────────────────────
-- 1. Extend programs table
-- ────────────────────────────────────────────

alter table programs add column if not exists description text;
alter table programs add column if not exists mode text not null default 'weekday' check (mode in ('weekday', 'session'));
alter table programs add column if not exists is_active boolean default false;
alter table programs add column if not exists updated_at timestamptz default now();

-- ────────────────────────────────────────────
-- 2. Extend workout_days table
-- ────────────────────────────────────────────

alter table workout_days add column if not exists day_order int default 0;
alter table workout_days add column if not exists kind text default 'legacy' check (kind in ('legacy', 'weekday', 'session'));
alter table workout_days add column if not exists weekday_label text;
alter table workout_days add column if not exists session_label text;
alter table workout_days add column if not exists updated_at timestamptz default now();

-- ────────────────────────────────────────────
-- 3. Create program_day_exercises table (new model for program builder)
-- ────────────────────────────────────────────

create table if not exists program_day_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name_snapshot text not null, -- name as it appeared in import or manual entry
  scheme_text text, -- e.g. "4x2", "1x5 + 2x5"
  target_sets int,
  target_reps_text text, -- e.g. "5", "5,5,5", "8-10"
  notes text,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table program_day_exercises enable row level security;
create policy "Users can manage own program_day_exercises" on program_day_exercises 
  for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- 4. Extend exercises table (optional, for later use)
-- ────────────────────────────────────────────

alter table exercises add column if not exists normalized_name text;
alter table exercises add column if not exists category text;
alter table exercises add column if not exists is_main_lift boolean default false;
alter table exercises add column if not exists updated_at timestamptz default now();

-- ────────────────────────────────────────────
-- 5. Add indexes for common queries
-- ────────────────────────────────────────────

create index if not exists idx_programs_user_active on programs(user_id, is_active);
create index if not exists idx_programs_user on programs(user_id);
create index if not exists idx_workout_days_program on workout_days(program_id);
create index if not exists idx_program_day_exercises_program on program_day_exercises(program_id);
create index if not exists idx_program_day_exercises_day on program_day_exercises(workout_day_id);
create index if not exists idx_program_day_exercises_sort on program_day_exercises(workout_day_id, sort_order);

-- ────────────────────────────────────────────
-- 6. Helper function: set active program (only one per user)
-- ────────────────────────────────────────────

create or replace function public.set_active_program(
  p_program_id uuid,
  p_user_id uuid
) returns boolean as $$
begin
  -- Deactivate all other programs for this user
  update programs 
  set is_active = false, updated_at = now()
  where user_id = p_user_id and id != p_program_id;
  
  -- Activate the new program
  update programs 
  set is_active = true, updated_at = now()
  where id = p_program_id and user_id = p_user_id;
  
  return true;
end;
$$ language plpgsql security definer;

-- ────────────────────────────────────────────
-- 7. Trigger to update updated_at on programs
-- ────────────────────────────────────────────

create or replace function public.update_programs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger programs_updated_at before update on programs
  for each row execute procedure public.update_programs_updated_at();

create or replace function public.update_program_day_exercises_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger program_day_exercises_updated_at before update on program_day_exercises
  for each row execute procedure public.update_program_day_exercises_updated_at();
