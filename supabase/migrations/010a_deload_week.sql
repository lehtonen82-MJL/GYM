-- Track whether a workout was performed as a recovery/deload week.
-- is_deload = true means lighter loads and fewer sets were applied at workout start.
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS is_deload boolean NOT NULL DEFAULT false;
