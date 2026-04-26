-- ============================================================
-- Migration 010: Global Exercise Definitions Library
--
-- Adds a read-only reference table of well-known exercises with
-- equipment type, primary muscle, and movement pattern metadata.
-- User exercises gain a nullable FK to this table for enrichment.
-- ============================================================

-- ----------------------------------------------------------
-- exercise_definitions: global, seeded, no per-user rows
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercise_definitions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL UNIQUE,
  normalized_name    text        NOT NULL UNIQUE,
  aliases            text[]      DEFAULT '{}',
  equipment_type     text        NOT NULL CHECK (equipment_type IN (
                       'barbell', 'dumbbell', 'cable', 'machine_plate',
                       'machine_stack', 'smith', 'bodyweight', 'kettlebell',
                       'trap_bar', 'band', 'suspension', 'cardio_machine', 'other'
                     )),
  primary_muscle     text        NOT NULL CHECK (primary_muscle IN (
                       'chest', 'back_lats', 'back_upper', 'shoulders',
                       'biceps', 'triceps', 'forearms', 'core',
                       'glutes', 'quads', 'hamstrings', 'calves'
                     )),
  secondary_muscles  text[]      DEFAULT '{}',
  movement_pattern   text        CHECK (movement_pattern IN (
                       'horizontal_push', 'vertical_push',
                       'horizontal_pull', 'vertical_pull',
                       'squat', 'hinge', 'lunge', 'carry',
                       'olympic', 'isolation', 'core', 'cardio'
                     )),
  is_bodyweight      boolean     NOT NULL DEFAULT false,
  is_cardio          boolean     NOT NULL DEFAULT false,
  is_bilateral       boolean     NOT NULL DEFAULT true,
  is_main_lift       boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Anyone can read definitions; no writes from client
ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise_definitions are publicly readable"
  ON exercise_definitions FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_exdef_normalized  ON exercise_definitions(normalized_name);
CREATE INDEX IF NOT EXISTS idx_exdef_primary_muscle ON exercise_definitions(primary_muscle);
CREATE INDEX IF NOT EXISTS idx_exdef_equipment   ON exercise_definitions(equipment_type);

-- ----------------------------------------------------------
-- Link user exercises to the library
-- ----------------------------------------------------------
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS exercise_definition_id uuid
    REFERENCES exercise_definitions(id) ON DELETE SET NULL;

-- Also add explicit is_bodyweight flag (replaces dynamic weight_kg=0 detection)
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS is_bodyweight boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_exercises_definition
  ON exercises(exercise_definition_id)
  WHERE exercise_definition_id IS NOT NULL;
