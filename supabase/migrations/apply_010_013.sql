-- ============================================================
-- APPLY: Exercise Library + PR System (Migrations 010–013)
-- Safe to run on a live database with existing data.
--
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and run it
--   3. All existing exercises, workouts, and set history are
--      fully preserved. Two backfills run automatically:
--        a) existing exercises → linked to library by name
--        b) existing completed workouts → PRs computed
--
-- WHAT CHANGES:
--   • Adds exercise_definitions table (global, read-only)
--   • Adds exercise_prs table (per-user PRs)
--   • Adds exercise_definition_id + is_bodyweight columns to exercises
--   • Expands workout_bonus_cardio.machine_type allowed values
--   • Backfills library links for existing exercises (by name match)
--   • Backfills PRs from all historical completed workout data
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────
-- MIGRATION 010: Global exercise definitions library
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_definitions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL UNIQUE,
  normalized_name    text        NOT NULL UNIQUE,
  aliases            text[]      NOT NULL DEFAULT '{}',
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
  secondary_muscles  text[]      NOT NULL DEFAULT '{}',
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

ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exercise_definitions'
    AND policyname = 'exercise_definitions are publicly readable'
  ) THEN
    CREATE POLICY "exercise_definitions are publicly readable"
      ON exercise_definitions FOR SELECT USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exdef_normalized     ON exercise_definitions(normalized_name);
CREATE INDEX IF NOT EXISTS idx_exdef_primary_muscle ON exercise_definitions(primary_muscle);
CREATE INDEX IF NOT EXISTS idx_exdef_equipment      ON exercise_definitions(equipment_type);

-- Add new columns to exercises (safe: IF NOT EXISTS, no data loss)
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS exercise_definition_id uuid
    REFERENCES exercise_definitions(id) ON DELETE SET NULL;

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS is_bodyweight boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_exercises_definition
  ON exercises(exercise_definition_id)
  WHERE exercise_definition_id IS NOT NULL;


-- ──────────────────────────────────────────────────────────
-- MIGRATION 011: Exercise PRs table + upsert function
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_prs (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id  uuid          NOT NULL REFERENCES exercises(id)  ON DELETE CASCADE,
  pr_type      text          NOT NULL CHECK (pr_type IN (
                 'max_weight',
                 '1rm_estimate',
                 'max_volume'
               )),
  value        numeric(10,2) NOT NULL,
  achieved_at  timestamptz   NOT NULL,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id, pr_type)
);

ALTER TABLE exercise_prs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exercise_prs'
    AND policyname = 'Users can manage own exercise_prs'
  ) THEN
    CREATE POLICY "Users can manage own exercise_prs"
      ON exercise_prs FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prs_user_exercise ON exercise_prs(user_id, exercise_id);

-- Upsert function — called from app code after workout completion
CREATE OR REPLACE FUNCTION upsert_exercise_prs(
  p_user_id            uuid,
  p_exercise_id        uuid,
  p_workout_started_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_weight   numeric(10,2);
  v_1rm_estimate numeric(10,2);
  v_session_vol  numeric(10,2);
BEGIN
  SELECT
    MAX(se.weight_kg),
    MAX(se.weight_kg * (1.0 + se.reps::numeric / 30.0)),
    SUM(se.weight_kg * se.reps)
  INTO v_max_weight, v_1rm_estimate, v_session_vol
  FROM set_entries se
  JOIN workout_exercise_entries wee ON wee.id = se.workout_exercise_entry_id
  JOIN workouts w                   ON w.id   = wee.workout_id
  WHERE wee.exercise_id = p_exercise_id
    AND wee.user_id     = p_user_id
    AND se.completed    = true
    AND se.is_warmup    = false
    AND se.weight_kg    IS NOT NULL
    AND se.reps         IS NOT NULL
    AND se.reps         > 0
    AND w.started_at    = p_workout_started_at;

  IF v_max_weight IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_weight', v_max_weight, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type) DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value THEN EXCLUDED.achieved_at ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

  IF v_1rm_estimate IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, '1rm_estimate', v_1rm_estimate, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type) DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value THEN EXCLUDED.achieved_at ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;

  IF v_session_vol IS NOT NULL THEN
    INSERT INTO exercise_prs (user_id, exercise_id, pr_type, value, achieved_at)
    VALUES (p_user_id, p_exercise_id, 'max_volume', v_session_vol, p_workout_started_at)
    ON CONFLICT (user_id, exercise_id, pr_type) DO UPDATE SET
      value       = GREATEST(exercise_prs.value, EXCLUDED.value),
      achieved_at = CASE WHEN EXCLUDED.value > exercise_prs.value THEN EXCLUDED.achieved_at ELSE exercise_prs.achieved_at END,
      updated_at  = now();
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- MIGRATION 012: Seed global exercise definitions
-- ON CONFLICT DO NOTHING = safe to re-run, never overwrites
-- ──────────────────────────────────────────────────────────

INSERT INTO exercise_definitions
  (name, normalized_name, aliases, equipment_type, primary_muscle, secondary_muscles, movement_pattern, is_bodyweight, is_cardio, is_bilateral, is_main_lift)
VALUES

-- CHEST
('Bench Press',            'bench press',            ARRAY['flat bench press','barbell bench press'], 'barbell',       'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', false, false, true,  true),
('Incline Bench Press',    'incline bench press',    ARRAY['incline barbell press'],                  'barbell',       'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', false, false, true,  false),
('Decline Bench Press',    'decline bench press',    ARRAY[]::text[],                                         'barbell',       'chest',     ARRAY['triceps'],                        'horizontal_push', false, false, true,  false),
('Close Grip Bench Press', 'close grip bench press', ARRAY['cgbp'],                                   'barbell',       'triceps',   ARRAY['chest','shoulders'],              'horizontal_push', false, false, true,  false),
('DB Bench Press',         'db bench press',         ARRAY['dumbbell bench press','dumbbell press'],  'dumbbell',      'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', false, false, true,  false),
('DB Incline Bench Press', 'db incline bench press', ARRAY['incline dumbbell press'],                 'dumbbell',      'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', false, false, true,  false),
('DB Decline Bench Press', 'db decline bench press', ARRAY[]::text[],                                         'dumbbell',      'chest',     ARRAY['triceps'],                        'horizontal_push', false, false, true,  false),
('DB Fly',                 'db fly',                 ARRAY['dumbbell fly','dumbbell flye'],            'dumbbell',      'chest',     ARRAY['shoulders'],                      'isolation',       false, false, true,  false),
('DB Incline Fly',         'db incline fly',         ARRAY['incline dumbbell fly'],                   'dumbbell',      'chest',     ARRAY['shoulders'],                      'isolation',       false, false, true,  false),
('DB Pullover',            'db pullover',            ARRAY['dumbbell pullover'],                      'dumbbell',      'chest',     ARRAY['back_lats','triceps'],            'isolation',       false, false, true,  false),
('Cable Crossover',        'cable crossover',        ARRAY['cable fly'],                              'cable',         'chest',     ARRAY['shoulders'],                      'isolation',       false, false, true,  false),
('Machine Chest Press',    'machine chest press',    ARRAY['chest press machine'],                    'machine_stack', 'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', false, false, true,  false),
('Pec Deck Fly',           'pec deck fly',           ARRAY['pec deck','butterfly machine'],           'machine_stack', 'chest',     ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Push-up',                'push-up',                ARRAY['pushup','press-up'],                      'bodyweight',    'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', true,  false, true,  false),
('Decline Push-up',        'decline push-up',        ARRAY['decline pushup'],                         'bodyweight',    'chest',     ARRAY['triceps','shoulders'],            'horizontal_push', true,  false, true,  false),
('Incline Push-up',        'incline push-up',        ARRAY['incline pushup'],                         'bodyweight',    'chest',     ARRAY['triceps'],                        'horizontal_push', true,  false, true,  false),
('Diamond Push-up',        'diamond push-up',        ARRAY['diamond pushup','close grip push-up'],    'bodyweight',    'triceps',   ARRAY['chest','shoulders'],              'horizontal_push', true,  false, true,  false),
('Chest Dip',              'chest dip',              ARRAY['dips','parallel bar dip'],                'bodyweight',    'chest',     ARRAY['triceps','shoulders'],            'vertical_push',   true,  false, true,  false),

-- BACK
('Conventional Deadlift',  'conventional deadlift',  ARRAY['deadlift'],                               'barbell',       'back_upper',ARRAY['hamstrings','glutes','core'],     'hinge',           false, false, true,  true),
('Sumo Deadlift',          'sumo deadlift',          ARRAY[]::text[],                                         'barbell',       'back_upper',ARRAY['quads','glutes','hamstrings'],     'hinge',           false, false, true,  true),
('Rack Pull',              'rack pull',              ARRAY['rack pulls'],                             'barbell',       'back_upper',ARRAY['hamstrings','glutes'],             'hinge',           false, false, true,  false),
('Bent-over Row',          'bent-over row',          ARRAY['barbell row','bb row'],                   'barbell',       'back_upper',ARRAY['back_lats','biceps'],              'horizontal_pull', false, false, true,  true),
('Pendlay Row',            'pendlay row',            ARRAY[]::text[],                                         'barbell',       'back_upper',ARRAY['back_lats','biceps'],              'horizontal_pull', false, false, true,  false),
('T-bar Row',              't-bar row',              ARRAY['tbar row'],                               'barbell',       'back_upper',ARRAY['back_lats','biceps'],              'horizontal_pull', false, false, true,  false),
('Good Morning',           'good morning',           ARRAY['goodmorning'],                            'barbell',       'hamstrings',ARRAY['back_upper','glutes'],             'hinge',           false, false, true,  false),
('Barbell Shrug',          'barbell shrug',          ARRAY['shrug'],                                  'barbell',       'back_upper',ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('One-Arm DB Row',         'one-arm db row',         ARRAY['single arm dumbbell row','db row'],       'dumbbell',      'back_lats', ARRAY['back_upper','biceps'],             'horizontal_pull', false, false, false, false),
('Lat Pulldown',           'lat pulldown',           ARRAY['pulldown','cable pulldown'],              'cable',         'back_lats', ARRAY['biceps'],                          'vertical_pull',   false, false, true,  false),
('Wide Grip Lat Pulldown', 'wide grip lat pulldown', ARRAY['wide pulldown'],                          'cable',         'back_lats', ARRAY['biceps'],                          'vertical_pull',   false, false, true,  false),
('Seated Cable Row',       'seated cable row',       ARRAY['cable row','seated row'],                 'cable',         'back_upper',ARRAY['back_lats','biceps'],              'horizontal_pull', false, false, true,  false),
('Machine Row',            'machine row',            ARRAY['chest supported row machine'],            'machine_stack', 'back_upper',ARRAY['back_lats','biceps'],              'horizontal_pull', false, false, true,  false),
('Machine Pulldown',       'machine pulldown',       ARRAY['machine lat pulldown'],                   'machine_stack', 'back_lats', ARRAY['biceps'],                          'vertical_pull',   false, false, true,  false),
('Pull-up',                'pull-up',                ARRAY['pullup','overhand pull-up'],              'bodyweight',    'back_lats', ARRAY['biceps','core'],                   'vertical_pull',   true,  false, true,  true),
('Chin-up',                'chin-up',                ARRAY['chinup','underhand pull-up'],             'bodyweight',    'back_lats', ARRAY['biceps'],                          'vertical_pull',   true,  false, true,  true),
('Inverted Row',           'inverted row',           ARRAY['body row','supine row'],                  'bodyweight',    'back_upper',ARRAY['back_lats','biceps'],              'horizontal_pull', true,  false, true,  false),

-- SHOULDERS
('Overhead Press',         'overhead press',         ARRAY['ohp','military press','barbell overhead press'], 'barbell', 'shoulders', ARRAY['triceps','core'],           'vertical_push',   false, false, true,  true),
('Push Press',             'push press',             ARRAY[]::text[],                                         'barbell',       'shoulders', ARRAY['triceps','quads'],                'vertical_push',   false, false, true,  false),
('DB Shoulder Press',      'db shoulder press',      ARRAY['dumbbell shoulder press','db ohp'],       'dumbbell',      'shoulders', ARRAY['triceps'],                        'vertical_push',   false, false, true,  false),
('Arnold Press',           'arnold press',           ARRAY[]::text[],                                         'dumbbell',      'shoulders', ARRAY['triceps'],                        'vertical_push',   false, false, true,  false),
('Lateral Raise',          'lateral raise',          ARRAY['side lateral raise','db lateral raise'],  'dumbbell',      'shoulders', ARRAY[]::text[],                                 'isolation',       false, false, false, false),
('Front Raise',            'front raise',            ARRAY['db front raise'],                         'dumbbell',      'shoulders', ARRAY['chest'],                          'isolation',       false, false, false, false),
('Rear Delt Fly',          'rear delt fly',          ARRAY['rear delt raise','reverse fly'],          'dumbbell',      'shoulders', ARRAY['back_upper'],                     'isolation',       false, false, false, false),
('Face Pull',              'face pull',              ARRAY['cable face pull'],                        'cable',         'shoulders', ARRAY['back_upper'],                     'isolation',       false, false, true,  false),
('Cable Lateral Raise',    'cable lateral raise',    ARRAY[]::text[],                                         'cable',         'shoulders', ARRAY[]::text[],                                 'isolation',       false, false, false, false),
('Cable Rear Delt Fly',    'cable rear delt fly',    ARRAY['cable reverse fly'],                      'cable',         'shoulders', ARRAY['back_upper'],                     'isolation',       false, false, false, false),
('Machine Shoulder Press', 'machine shoulder press', ARRAY['shoulder press machine'],                 'machine_stack', 'shoulders', ARRAY['triceps'],                        'vertical_push',   false, false, true,  false),

-- BICEPS
('Barbell Curl',           'barbell curl',           ARRAY['bb curl','straight bar curl'],            'barbell',       'biceps',    ARRAY['forearms'],                       'isolation',       false, false, true,  false),
('EZ-bar Curl',            'ez-bar curl',            ARRAY['ez bar curl','ez curl'],                  'barbell',       'biceps',    ARRAY['forearms'],                       'isolation',       false, false, true,  false),
('DB Curl',                'db curl',                ARRAY['dumbbell curl','alternating db curl'],    'dumbbell',      'biceps',    ARRAY['forearms'],                       'isolation',       false, false, false, false),
('Hammer Curl',            'hammer curl',            ARRAY['db hammer curl'],                         'dumbbell',      'biceps',    ARRAY['forearms'],                       'isolation',       false, false, false, false),
('Incline DB Curl',        'incline db curl',        ARRAY['incline dumbbell curl'],                  'dumbbell',      'biceps',    ARRAY[]::text[],                                 'isolation',       false, false, false, false),
('Concentration Curl',     'concentration curl',     ARRAY[]::text[],                                         'dumbbell',      'biceps',    ARRAY[]::text[],                                 'isolation',       false, false, false, false),
('Cable Curl',             'cable curl',             ARRAY['cable bicep curl'],                       'cable',         'biceps',    ARRAY['forearms'],                       'isolation',       false, false, true,  false),
('Preacher Curl',          'preacher curl',          ARRAY['preacher curl machine','scott curl'],     'machine_stack', 'biceps',    ARRAY[]::text[],                                 'isolation',       false, false, true,  false),

-- TRICEPS
('Skull Crusher',          'skull crusher',          ARRAY['lying triceps extension','ez skull crusher'], 'barbell', 'triceps',   ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Overhead DB Extension',  'overhead db extension',  ARRAY['dumbbell overhead extension'],            'dumbbell',      'triceps',   ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('DB Kickback',            'db kickback',            ARRAY['triceps kickback'],                       'dumbbell',      'triceps',   ARRAY[]::text[],                                 'isolation',       false, false, false, false),
('Triceps Pushdown (rope)','triceps pushdown (rope)',ARRAY['rope pushdown','cable rope pushdown'],    'cable',         'triceps',   ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Triceps Pushdown (bar)', 'triceps pushdown (bar)', ARRAY['bar pushdown','cable pushdown'],          'cable',         'triceps',   ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Overhead Cable Extension','overhead cable extension',ARRAY['cable overhead extension'],             'cable',         'triceps',   ARRAY[]::text[],                                 'isolation',       false, false, true,  false),

-- LEGS
('Back Squat',             'back squat',             ARRAY['barbell squat','squat'],                  'barbell',       'quads',     ARRAY['glutes','hamstrings','core'],      'squat',           false, false, true,  true),
('Front Squat',            'front squat',            ARRAY['barbell front squat'],                    'barbell',       'quads',     ARRAY['glutes','core'],                  'squat',           false, false, true,  true),
('Bulgarian Split Squat',  'bulgarian split squat',  ARRAY['bss','rear foot elevated split squat'],   'barbell',       'quads',     ARRAY['glutes','hamstrings'],            'lunge',           false, false, false, false),
('Barbell Hip Thrust',     'barbell hip thrust',     ARRAY['hip thrust'],                             'barbell',       'glutes',    ARRAY['hamstrings','quads'],             'hinge',           false, false, true,  false),
('Barbell Lunge',          'barbell lunge',          ARRAY['lunge'],                                  'barbell',       'quads',     ARRAY['glutes','hamstrings'],            'lunge',           false, false, false, false),
('Romanian Deadlift',      'romanian deadlift',      ARRAY['rdl','barbell rdl'],                      'barbell',       'hamstrings',ARRAY['glutes','back_upper'],            'hinge',           false, false, true,  false),
('DB Romanian Deadlift',   'db romanian deadlift',   ARRAY['db rdl','dumbbell rdl'],                  'dumbbell',      'hamstrings',ARRAY['glutes'],                         'hinge',           false, false, true,  false),
('DB Lunge',               'db lunge',               ARRAY['dumbbell lunge'],                         'dumbbell',      'quads',     ARRAY['glutes','hamstrings'],            'lunge',           false, false, false, false),
('DB Bulgarian Split Squat','db bulgarian split squat',ARRAY['db bss'],                               'dumbbell',      'quads',     ARRAY['glutes','hamstrings'],            'lunge',           false, false, false, false),
('Leg Press',              'leg press',              ARRAY[]::text[],                                         'machine_plate', 'quads',     ARRAY['glutes','hamstrings'],            'squat',           false, false, true,  false),
('Leg Extension',          'leg extension',          ARRAY['leg extension machine'],                  'machine_stack', 'quads',     ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Seated Leg Curl',        'seated leg curl',        ARRAY['leg curl','hamstring curl'],              'machine_stack', 'hamstrings',ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Lying Leg Curl',         'lying leg curl',         ARRAY[]::text[],                                         'machine_stack', 'hamstrings',ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Hip Thrust Machine',     'hip thrust machine',     ARRAY['machine hip thrust'],                     'machine_stack', 'glutes',    ARRAY['hamstrings'],                     'hinge',           false, false, true,  false),
('Hip Abductor Machine',   'hip abductor machine',   ARRAY['abductor machine','hip abduction'],       'machine_stack', 'glutes',    ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Hip Adductor Machine',   'hip adductor machine',   ARRAY['adductor machine','hip adduction'],       'machine_stack', 'quads',     ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Calf Raise',             'calf raise',             ARRAY['standing calf raise'],                    'machine_plate', 'calves',    ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Seated Calf Raise',      'seated calf raise',      ARRAY['donkey calf raise'],                      'machine_stack', 'calves',    ARRAY[]::text[],                                 'isolation',       false, false, true,  false),
('Bodyweight Squat',       'bodyweight squat',       ARRAY['air squat','bw squat'],                   'bodyweight',    'quads',     ARRAY['glutes'],                         'squat',           true,  false, true,  false),
('Bodyweight Lunge',       'bodyweight lunge',       ARRAY['walking lunge'],                          'bodyweight',    'quads',     ARRAY['glutes','hamstrings'],            'lunge',           true,  false, false, false),
('Glute Bridge',           'glute bridge',           ARRAY['hip bridge'],                             'bodyweight',    'glutes',    ARRAY['hamstrings'],                     'hinge',           true,  false, true,  false),
('Nordic Curl',            'nordic curl',            ARRAY['nordic hamstring curl','natural leg curl'],'bodyweight',   'hamstrings',ARRAY['glutes'],                         'hinge',           true,  false, true,  false),
('Step-up',                'step-up',                ARRAY['box step-up'],                            'bodyweight',    'quads',     ARRAY['glutes'],                         'lunge',           true,  false, false, false),

-- CORE
('Plank',                  'plank',                  ARRAY['forearm plank'],                          'bodyweight',    'core',      ARRAY['shoulders'],                      'core',            true,  false, true,  false),
('Crunch',                 'crunch',                 ARRAY['abs crunch'],                             'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),
('Sit-up',                 'sit-up',                 ARRAY['situp'],                                  'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),
('Leg Raise',              'leg raise',              ARRAY['hanging leg raise','lying leg raise'],    'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),
('Bicycle Crunch',         'bicycle crunch',         ARRAY[]::text[],                                         'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),
('Russian Twist',          'russian twist',          ARRAY[]::text[],                                         'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),
('Hollow Body Hold',       'hollow body hold',       ARRAY['hollow hold'],                            'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),
('Ab Wheel Rollout',       'ab wheel rollout',       ARRAY['wheel rollout','ab rollout'],             'bodyweight',    'core',      ARRAY['back_lats','shoulders'],           'core',            false, false, true,  false),
('Cable Crunch',           'cable crunch',           ARRAY[]::text[],                                         'cable',         'core',      ARRAY[]::text[],                                 'core',            false, false, true,  false),
('Dragon Flag',            'dragon flag',            ARRAY[]::text[],                                         'bodyweight',    'core',      ARRAY[]::text[],                                 'core',            true,  false, true,  false),

-- OLYMPIC LIFTS
('Snatch',                 'snatch',                 ARRAY['barbell snatch'],                         'barbell',       'shoulders', ARRAY['quads','glutes','back_upper','core'],'olympic',       false, false, true,  true),
('Clean & Jerk',           'clean & jerk',           ARRAY['clean and jerk'],                         'barbell',       'shoulders', ARRAY['quads','glutes','back_upper','core'],'olympic',       false, false, true,  true),
('Power Snatch',           'power snatch',           ARRAY[]::text[],                                         'barbell',       'shoulders', ARRAY['quads','glutes','back_upper'],     'olympic',         false, false, true,  false),
('Power Clean',            'power clean',            ARRAY[]::text[],                                         'barbell',       'quads',     ARRAY['glutes','back_upper','shoulders'], 'olympic',         false, false, true,  false),
('Hang Clean',             'hang clean',             ARRAY[]::text[],                                         'barbell',       'quads',     ARRAY['glutes','back_upper'],             'olympic',         false, false, true,  false),
('Hang Snatch',            'hang snatch',            ARRAY[]::text[],                                         'barbell',       'shoulders', ARRAY['quads','glutes'],                  'olympic',         false, false, true,  false),
('Clean Pull',             'clean pull',             ARRAY[]::text[],                                         'barbell',       'quads',     ARRAY['glutes','back_upper'],             'olympic',         false, false, true,  false),
('Snatch Pull',            'snatch pull',            ARRAY[]::text[],                                         'barbell',       'quads',     ARRAY['glutes','back_upper'],             'olympic',         false, false, true,  false),
('Push Jerk',              'push jerk',              ARRAY[]::text[],                                         'barbell',       'shoulders', ARRAY['quads','triceps'],                 'olympic',         false, false, true,  false),
('Split Jerk',             'split jerk',             ARRAY[]::text[],                                         'barbell',       'shoulders', ARRAY['quads','triceps','core'],          'olympic',         false, false, true,  false),

-- KETTLEBELL
('Kettlebell Swing',       'kettlebell swing',       ARRAY['kb swing'],                               'kettlebell',    'glutes',    ARRAY['hamstrings','back_upper','core'],  'hinge',           false, false, true,  false),
('Kettlebell Goblet Squat','kettlebell goblet squat',ARRAY['kb goblet squat','goblet squat'],         'kettlebell',    'quads',     ARRAY['glutes','core'],                   'squat',           false, false, true,  false),
('Turkish Get-up',         'turkish get-up',         ARRAY['tgu'],                                    'kettlebell',    'shoulders', ARRAY['core','glutes'],                   'carry',           false, false, false, false),
('Kettlebell Clean and Press','kettlebell clean and press',ARRAY['kb clean and press'],               'kettlebell',    'shoulders', ARRAY['quads','glutes','triceps'],        'olympic',         false, false, false, false),

-- CARDIO MACHINES
('Rowing Machine',         'rowing machine',         ARRAY['rower','erg','concept2'],                 'cardio_machine','back_lats', ARRAY['quads','glutes','core'],           'cardio',          false, true,  true,  false),
('Stationary Bike',        'stationary bike',        ARRAY['bike','spin bike','cycling'],             'cardio_machine','quads',     ARRAY['glutes','hamstrings'],             'cardio',          false, true,  true,  false),
('Ski Erg',                'ski erg',                ARRAY['skierg'],                                 'cardio_machine','back_lats', ARRAY['core','shoulders'],                'cardio',          false, true,  true,  false),
('Assault Bike',           'assault bike',           ARRAY['air bike','echo bike'],                   'cardio_machine','quads',     ARRAY['shoulders','chest'],               'cardio',          false, true,  true,  false),
('Treadmill',              'treadmill',              ARRAY['running'],                                'cardio_machine','quads',     ARRAY['glutes','hamstrings'],             'cardio',          false, true,  true,  false),
('Elliptical',             'elliptical',             ARRAY['cross trainer'],                          'cardio_machine','quads',     ARRAY['glutes','hamstrings'],             'cardio',          false, true,  true,  false),
('Stair Climber',          'stair climber',          ARRAY['stairmaster','step mill'],                'cardio_machine','quads',     ARRAY['glutes','calves'],                 'cardio',          false, true,  true,  false),
('Jump Rope',              'jump rope',              ARRAY['skipping rope'],                          'other',         'calves',    ARRAY['core','shoulders'],                'cardio',          false, true,  true,  false)

ON CONFLICT (normalized_name) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- MIGRATION 013: Expand cardio machine_type constraint
-- Keeps 'rower' valid so existing rows are never violated
-- ──────────────────────────────────────────────────────────

ALTER TABLE workout_bonus_cardio
  DROP CONSTRAINT IF EXISTS workout_bonus_cardio_machine_type_check;

ALTER TABLE workout_bonus_cardio
  ADD CONSTRAINT workout_bonus_cardio_machine_type_check
  CHECK (machine_type IN (
    'rower',           -- legacy value — all existing rows use this
    'rowing_machine',
    'bike',
    'skierg',
    'assault_bike',
    'elliptical',
    'treadmill',
    'stair_climber',
    'other'
  ));


-- ──────────────────────────────────────────────────────────
-- BACKFILL 1: Link existing user exercises to the library
--
-- Matches each unlinked exercise by normalized_name (exact)
-- or aliases. Updates category + is_bodyweight + is_main_lift
-- from the definition. Custom/unrecognized exercises stay
-- untouched (exercise_definition_id remains NULL).
-- ──────────────────────────────────────────────────────────

DO $$
DECLARE
  r       RECORD;
  v_def   RECORD;
BEGIN
  FOR r IN
    SELECT id, name, normalized_name
    FROM exercises
    WHERE exercise_definition_id IS NULL
  LOOP
    -- Exact normalized_name match
    SELECT id, is_bodyweight, is_main_lift, equipment_type
    INTO v_def
    FROM exercise_definitions
    WHERE normalized_name = COALESCE(r.normalized_name, lower(trim(r.name)))
    LIMIT 1;

    -- Alias fallback
    IF v_def.id IS NULL THEN
      SELECT id, is_bodyweight, is_main_lift, equipment_type
      INTO v_def
      FROM exercise_definitions
      WHERE aliases @> ARRAY[COALESCE(r.normalized_name, lower(trim(r.name)))]
      LIMIT 1;
    END IF;

    IF v_def.id IS NOT NULL THEN
      UPDATE exercises SET
        exercise_definition_id = v_def.id,
        is_bodyweight          = v_def.is_bodyweight,
        is_main_lift           = v_def.is_main_lift,
        category               = v_def.equipment_type
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- BACKFILL 2: Compute PRs from all historical completed workouts
--
-- Iterates every (user, exercise, workout) combination that has
-- at least one completed non-warmup set with weight logged.
-- Uses the same upsert_exercise_prs function the app calls live,
-- so logic is identical. Safe to re-run (ON CONFLICT GREATEST).
-- ──────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      wee.user_id,
      wee.exercise_id,
      w.started_at
    FROM workout_exercise_entries wee
    JOIN workouts w     ON w.id  = wee.workout_id
    JOIN set_entries se ON se.workout_exercise_entry_id = wee.id
    WHERE w.completed_at  IS NOT NULL
      AND se.completed    = true
      AND se.is_warmup    = false
      AND se.weight_kg    IS NOT NULL
      AND se.reps         IS NOT NULL
      AND se.reps         > 0
    ORDER BY w.started_at  -- oldest first so GREATEST logic is correct
  LOOP
    PERFORM upsert_exercise_prs(r.user_id, r.exercise_id, r.started_at);
  END LOOP;
END;
$$;

COMMIT;

-- ──────────────────────────────────────────────────────────
-- Verify: quick summary of what was applied
-- ──────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM exercise_definitions)       AS library_exercises_seeded,
  (SELECT count(*) FROM exercises
   WHERE exercise_definition_id IS NOT NULL)         AS user_exercises_linked,
  (SELECT count(*) FROM exercises
   WHERE exercise_definition_id IS NULL)             AS user_exercises_unlinked_custom,
  (SELECT count(*) FROM exercise_prs)               AS pr_records_backfilled;
