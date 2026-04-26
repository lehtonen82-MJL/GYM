-- ============================================
-- GYM Tracker Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Profiles (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Programs
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  mode text default 'weekday' check (mode in ('weekday', 'session')),
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table programs enable row level security;
create policy "Users can manage own programs" on programs for all using (auth.uid() = user_id);
create index if not exists idx_programs_user_active on programs(user_id, is_active);

-- Workout Days
create table if not exists workout_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  day_of_week int, -- 0=Sun, 1=Mon, 2=Tue, etc. (if weekday mode)
  day_label text, -- "TI", "TO", "LA", "SU" (if weekday mode)
  kind text default 'legacy' check (kind in ('weekday', 'session', 'legacy')),
  day_order int,
  weekday_label text, -- e.g., "Monday"
  session_label text, -- e.g., "Workout 1"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table workout_days enable row level security;
create policy "Users can manage own workout_days" on workout_days for all using (auth.uid() = user_id);
create index if not exists idx_workout_days_program on workout_days(program_id);

-- Exercises (with Phase 1 enhancements)
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text,
  category text,
  is_main_lift boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table exercises enable row level security;
create policy "Users can manage own exercises" on exercises for all using (auth.uid() = user_id);
create index if not exists idx_exercises_user_normalized on exercises(user_id, normalized_name);

-- Workout Day Exercises (which exercises belong to which day)
create table if not exists workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_index int not null default 0,
  target_sets int not null default 3,
  target_reps int not null default 5,
  created_at timestamptz default now()
);

alter table workout_day_exercises enable row level security;
create policy "Users can manage own workout_day_exercises" on workout_day_exercises for all using (auth.uid() = user_id);

-- Workouts (actual workout sessions)
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_day_id uuid references workout_days(id) on delete cascade, -- nullable: imported workouts have no day
  import_session_name text, -- display name for imported workouts
  started_at timestamptz default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table workouts enable row level security;
create policy "Users can manage own workouts" on workouts for all using (auth.uid() = user_id);

-- Workout Bonus Cardio (manual rower metrics)
create table if not exists workout_bonus_cardio (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null unique references workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  machine_type text not null default 'rower' check (machine_type in ('rower')),
  distance_m int,
  duration_seconds numeric(8,1),
  pace_per_500_seconds numeric(8,1),
  calories int,
  stroke_rate int,
  avg_watts int,
  extra_metrics jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table workout_bonus_cardio enable row level security;
create policy "Users can manage own workout_bonus_cardio" on workout_bonus_cardio for all using (auth.uid() = user_id);

-- Workout Exercise Entries (exercises within a workout session)
create table if not exists workout_exercise_entries (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  workout_day_exercise_id uuid references workout_day_exercises(id) on delete cascade, -- nullable: imported entries have no program slot
  user_id uuid not null references auth.users(id) on delete cascade,
  too_heavy boolean default false,
  created_at timestamptz default now()
);

alter table workout_exercise_entries enable row level security;
create policy "Users can manage own workout_exercise_entries" on workout_exercise_entries for all using (auth.uid() = user_id);

-- original_exercise_id: records the programmed exercise when a mid-workout swap happens (NULL = no swap)
-- (added via migration 009)

-- Set Entries (individual sets within an exercise)
create table if not exists set_entries (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_entry_id uuid not null references workout_exercise_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2),
  reps int,
  completed boolean default false,
  is_warmup boolean default false,
  too_heavy boolean default false,
  too_heavy_reps integer default null,
  created_at timestamptz default now()
);

alter table set_entries enable row level security;
create policy "Users can manage own set_entries" on set_entries for all using (auth.uid() = user_id);

-- Indexes for common queries
create index if not exists idx_workouts_user_day on workouts(user_id, workout_day_id);
create index if not exists idx_workouts_started on workouts(user_id, started_at desc);
create index if not exists idx_workout_exercise_entries_workout on workout_exercise_entries(workout_id);
create index if not exists idx_set_entries_entry on set_entries(workout_exercise_entry_id);
create index if not exists idx_workout_day_exercises_day on workout_day_exercises(workout_day_id);

-- Program Exercises (Phase 1 feature for program builder)
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

-- Program Exercise Alternatives (pre-defined swap options per program exercise slot)
create table if not exists program_exercise_alternatives (
  id uuid primary key default gen_random_uuid(),
  program_exercise_id uuid not null references program_exercises(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  sort_order integer not null default 0,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(program_exercise_id, exercise_id)
);

alter table program_exercise_alternatives enable row level security;
create policy "Users can manage own program_exercise_alternatives" on program_exercise_alternatives for all using (auth.uid() = user_id);
create index if not exists idx_pea_program_exercise on program_exercise_alternatives(program_exercise_id);

-- ============================================
-- Triggers for updated_at timestamps
-- ============================================

create or replace function public.update_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger if not exists update_programs_updated_at before update on programs
  for each row execute procedure public.update_updated_at_timestamp();

create trigger if not exists update_exercises_updated_at before update on exercises
  for each row execute procedure public.update_updated_at_timestamp();

create trigger if not exists update_workout_days_updated_at before update on workout_days
  for each row execute procedure public.update_updated_at_timestamp();

create trigger if not exists update_program_exercises_updated_at before update on program_exercises
  for each row execute procedure public.update_updated_at_timestamp();

create trigger if not exists update_workout_bonus_cardio_updated_at before update on workout_bonus_cardio
  for each row execute procedure public.update_updated_at_timestamp();

-- ============================================
-- Active program helper function
-- Used by setActiveProgram() to atomically deactivate all programs
-- and activate one. Also safe to call directly from SQL Editor.
-- ============================================

create or replace function public.set_active_program(p_program_id uuid, p_user_id uuid)
returns void as $$
begin
  update public.programs set is_active = false where user_id = p_user_id;
  update public.programs set is_active = true  where id = p_program_id and user_id = p_user_id;
end;
$$ language plpgsql security definer;
