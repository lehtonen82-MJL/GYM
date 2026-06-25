-- ============================================================
-- Migration 017: Equipment Variant Tracking
--
-- Adds equipment_type to workout_exercise_entries and exercise_prs
-- so weight history and PRs are scoped per tool.
-- Backfills from each exercise's linked definition.
-- ============================================================

-- G1a: add column to entries (nullable — backfill below)
ALTER TABLE workout_exercise_entries
  ADD COLUMN IF NOT EXISTS equipment_type text;

-- G1b: add column to PRs
ALTER TABLE exercise_prs
  ADD COLUMN IF NOT EXISTS equipment_type text;

-- G1c: backfill entries from exercises → exercise_definitions
UPDATE workout_exercise_entries wee
SET equipment_type = ed.equipment_type
FROM exercises ex
JOIN exercise_definitions ed ON ex.exercise_definition_id = ed.id
WHERE wee.exercise_id = ex.id
  AND wee.equipment_type IS NULL;

-- G1d: backfill PRs from exercises → exercise_definitions
UPDATE exercise_prs ep
SET equipment_type = ed.equipment_type
FROM exercises ex
JOIN exercise_definitions ed ON ex.exercise_definition_id = ed.id
WHERE ep.exercise_id = ex.id
  AND ep.equipment_type IS NULL;

-- G1e: index for fast per-equipment history queries
CREATE INDEX IF NOT EXISTS idx_wee_exercise_equipment
  ON workout_exercise_entries(exercise_id, equipment_type);
