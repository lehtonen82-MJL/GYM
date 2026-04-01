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
  created_at timestamptz default now()
);

alter table programs enable row level security;
create policy "Users can manage own programs" on programs for all using (auth.uid() = user_id);

-- Workout Days
create table if not exists workout_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  day_of_week int not null, -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  day_label text not null,  -- "TI", "TO", "LA", "SU"
  created_at timestamptz default now()
);

alter table workout_days enable row level security;
create policy "Users can manage own workout_days" on workout_days for all using (auth.uid() = user_id);

-- Exercises
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table exercises enable row level security;
create policy "Users can manage own exercises" on exercises for all using (auth.uid() = user_id);

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
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table workouts enable row level security;
create policy "Users can manage own workouts" on workouts for all using (auth.uid() = user_id);

-- Workout Exercise Entries (exercises within a workout session)
create table if not exists workout_exercise_entries (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  workout_day_exercise_id uuid not null references workout_day_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table workout_exercise_entries enable row level security;
create policy "Users can manage own workout_exercise_entries" on workout_exercise_entries for all using (auth.uid() = user_id);

-- Set Entries (individual sets within an exercise)
create table if not exists set_entries (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_entry_id uuid not null references workout_exercise_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2),
  reps int,
  completed boolean default false,
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
