-- ============================================
-- Phase 2 Migration: Bonus Cardio OCR Metrics
-- ============================================

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
  raw_ocr_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table workout_bonus_cardio
  add column if not exists extra_metrics jsonb default '{}'::jsonb;

alter table workout_bonus_cardio enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_bonus_cardio'
      and policyname = 'Users can manage own workout_bonus_cardio'
  ) then
    create policy "Users can manage own workout_bonus_cardio"
      on workout_bonus_cardio for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_workout_bonus_cardio_user on workout_bonus_cardio(user_id);

create or replace function public.update_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_workout_bonus_cardio_updated_at on workout_bonus_cardio;
create trigger update_workout_bonus_cardio_updated_at before update on workout_bonus_cardio
  for each row execute procedure public.update_updated_at_timestamp();
