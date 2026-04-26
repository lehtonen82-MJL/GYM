-- ============================================================
-- Migration 013: Expand cardio machine types
--
-- Replaces the narrow CHECK constraint on workout_bonus_cardio.machine_type
-- that only allowed 'rower', with a broader set of cardio machine types.
-- The existing 'rower' value maps to 'rowing_machine' in the new vocabulary
-- via a data migration step. Old 'rower' value is kept as an alias by
-- including it in the new constraint so existing rows remain valid during
-- a gradual rollout; application code should prefer the new canonical names.
-- ============================================================

-- Step 1: Drop the old check constraint (Postgres requires this to change it)
ALTER TABLE workout_bonus_cardio
  DROP CONSTRAINT IF EXISTS workout_bonus_cardio_machine_type_check;

-- Step 2: Add the expanded check constraint
ALTER TABLE workout_bonus_cardio
  ADD CONSTRAINT workout_bonus_cardio_machine_type_check
  CHECK (machine_type IN (
    'rower',          -- legacy alias kept for backward compatibility
    'rowing_machine',
    'bike',
    'skierg',
    'assault_bike',
    'elliptical',
    'treadmill',
    'stair_climber',
    'other'
  ));
