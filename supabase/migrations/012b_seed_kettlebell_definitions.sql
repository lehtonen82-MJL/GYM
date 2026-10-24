-- ============================================================
-- Migration 012b: Kettlebell definitions
--
-- These 32 rows were added to the production database directly (not via a
-- migration). Captured from production on 2026-10-24 so a fresh database matches it.
-- Already applied on production: ON CONFLICT DO NOTHING leaves those rows untouched.
-- ============================================================

INSERT INTO exercise_definitions
  (name, normalized_name, aliases, equipment_type, primary_muscle, secondary_muscles, movement_pattern, is_bodyweight, is_cardio, is_bilateral, is_main_lift)
VALUES
('Double Kettlebell Clean', 'double kettlebell clean', ARRAY['double kb clean', 'kb double clean']::text[], 'kettlebell', 'back_upper', ARRAY['glutes', 'hamstrings']::text[], 'olympic', false, false, true, false),
('Double Kettlebell Deadlift', 'double kettlebell deadlift', ARRAY['double kb deadlift']::text[], 'kettlebell', 'glutes', ARRAY['hamstrings', 'back_upper']::text[], 'hinge', false, false, true, false),
('Double Kettlebell Front Squat', 'double kettlebell front squat', ARRAY['double kb front squat', 'kb front squat', 'kb rack squat']::text[], 'kettlebell', 'quads', ARRAY['glutes', 'core']::text[], 'squat', false, false, true, false),
('Double Kettlebell Press', 'double kettlebell press', ARRAY['double kb press', 'kb double overhead press', 'double kb overhead press']::text[], 'kettlebell', 'shoulders', ARRAY['triceps']::text[], 'vertical_push', false, false, true, false),
('Double Kettlebell Push Press', 'double kettlebell push press', ARRAY['double kb push press']::text[], 'kettlebell', 'shoulders', ARRAY['triceps', 'glutes', 'quads']::text[], 'vertical_push', false, false, true, false),
('Double Kettlebell Row', 'double kettlebell row', ARRAY['double kb row']::text[], 'kettlebell', 'back_lats', ARRAY['biceps', 'back_upper']::text[], 'horizontal_pull', false, false, true, false),
('Double Kettlebell Snatch', 'double kettlebell snatch', ARRAY['double kb snatch', 'kb double snatch']::text[], 'kettlebell', 'shoulders', ARRAY['glutes', 'back_upper']::text[], 'olympic', false, false, true, false),
('Double Kettlebell Swing', 'double kettlebell swing', ARRAY['double kb swing', 'kb double swing']::text[], 'kettlebell', 'glutes', ARRAY['hamstrings', 'back_upper']::text[], 'hinge', false, false, true, false),
('Kettlebell Bulgarian Split Squat', 'kettlebell bulgarian split squat', ARRAY['kb bulgarian split squat', 'kb bss', 'kb rear foot elevated split squat']::text[], 'kettlebell', 'quads', ARRAY['glutes', 'hamstrings']::text[], 'lunge', false, false, false, false),
('Kettlebell Clean', 'kettlebell clean', ARRAY['kb clean', 'single arm kb clean', 'kb power clean']::text[], 'kettlebell', 'back_upper', ARRAY['glutes', 'hamstrings', 'forearms']::text[], 'olympic', false, false, false, true),
('Kettlebell Deadlift', 'kettlebell deadlift', ARRAY['kb deadlift', 'two hand kb deadlift']::text[], 'kettlebell', 'glutes', ARRAY['hamstrings', 'back_upper']::text[], 'hinge', false, false, true, false),
('Kettlebell Farmer Walk', 'kettlebell farmer walk', ARRAY['kb farmers carry', 'kb farmers walk', 'kettlebell farmers carry', 'double kb farmers carry']::text[], 'kettlebell', 'core', ARRAY['forearms', 'shoulders', 'quads']::text[], 'carry', false, false, true, false),
('Kettlebell Figure 8', 'kettlebell figure 8', ARRAY['kb figure 8', 'kb figure eight']::text[], 'kettlebell', 'core', ARRAY['glutes', 'back_upper']::text[], 'core', false, false, true, false),
('Kettlebell Floor Press', 'kettlebell floor press', ARRAY['kb floor press', 'single arm kb floor press']::text[], 'kettlebell', 'chest', ARRAY['triceps', 'shoulders']::text[], 'horizontal_push', false, false, false, false),
('Kettlebell Halo', 'kettlebell halo', ARRAY['kb halo']::text[], 'kettlebell', 'shoulders', ARRAY['core']::text[], 'core', false, false, true, false),
('Kettlebell High Pull', 'kettlebell high pull', ARRAY['kb high pull', 'kb sumo deadlift high pull', 'kb sdlhp']::text[], 'kettlebell', 'back_upper', ARRAY['glutes', 'shoulders', 'hamstrings']::text[], 'olympic', false, false, true, false),
('Kettlebell Jerk', 'kettlebell jerk', ARRAY['kb jerk', 'single arm kb jerk']::text[], 'kettlebell', 'shoulders', ARRAY['triceps', 'glutes', 'quads']::text[], 'vertical_push', false, false, false, false),
('Kettlebell Lunge', 'kettlebell lunge', ARRAY['kb lunge', 'kb walking lunge', 'kettlebell walking lunge']::text[], 'kettlebell', 'quads', ARRAY['glutes', 'hamstrings']::text[], 'lunge', false, false, false, false),
('Kettlebell Overhead Carry', 'kettlebell overhead carry', ARRAY['kb overhead carry', 'kb overhead walk', 'waiter carry']::text[], 'kettlebell', 'shoulders', ARRAY['core', 'triceps']::text[], 'carry', false, false, false, false),
('Kettlebell Press', 'kettlebell press', ARRAY['kb press', 'kb overhead press', 'single arm kb press', 'kb military press', 'kettlebell overhead press']::text[], 'kettlebell', 'shoulders', ARRAY['triceps', 'core']::text[], 'vertical_push', false, false, false, true),
('Kettlebell Push Press', 'kettlebell push press', ARRAY['kb push press', 'single arm kb push press']::text[], 'kettlebell', 'shoulders', ARRAY['triceps', 'glutes', 'quads']::text[], 'vertical_push', false, false, false, false),
('Kettlebell Rack Carry', 'kettlebell rack carry', ARRAY['kb rack carry', 'kb rack walk', 'single arm kb rack carry']::text[], 'kettlebell', 'core', ARRAY['shoulders']::text[], 'carry', false, false, false, false),
('Kettlebell Romanian Deadlift', 'kettlebell romanian deadlift', ARRAY['kb rdl', 'kb romanian deadlift', 'kb stiff leg deadlift']::text[], 'kettlebell', 'hamstrings', ARRAY['glutes', 'back_upper']::text[], 'hinge', false, false, true, false),
('Kettlebell Row', 'kettlebell row', ARRAY['kb row', 'kb bent over row', 'single arm kb row']::text[], 'kettlebell', 'back_lats', ARRAY['biceps', 'back_upper']::text[], 'horizontal_pull', false, false, false, false),
('Kettlebell Snatch', 'kettlebell snatch', ARRAY['kb snatch', 'single arm kb snatch', 'kb power snatch']::text[], 'kettlebell', 'shoulders', ARRAY['glutes', 'back_upper', 'hamstrings']::text[], 'olympic', false, false, false, true),
('Kettlebell Suitcase Carry', 'kettlebell suitcase carry', ARRAY['kb suitcase carry', 'kb suitcase walk']::text[], 'kettlebell', 'core', ARRAY['forearms']::text[], 'carry', false, false, false, false),
('Kettlebell Sumo Squat', 'kettlebell sumo squat', ARRAY['kb sumo squat', 'kb plie squat']::text[], 'kettlebell', 'glutes', ARRAY['quads', 'hamstrings']::text[], 'squat', false, false, true, false),
('Kettlebell Swing Clean', 'kettlebell swing clean', ARRAY['kb swing clean', 'swing to clean']::text[], 'kettlebell', 'glutes', ARRAY['back_upper', 'hamstrings']::text[], 'olympic', false, false, false, false),
('Kettlebell Thruster', 'kettlebell thruster', ARRAY['kb thruster', 'kb squat press']::text[], 'kettlebell', 'shoulders', ARRAY['quads', 'glutes', 'triceps']::text[], 'squat', false, false, true, false),
('Kettlebell Windmill', 'kettlebell windmill', ARRAY['kb windmill']::text[], 'kettlebell', 'core', ARRAY['shoulders', 'hamstrings']::text[], 'core', false, false, false, false),
('Single-Arm Kettlebell Swing', 'single-arm kettlebell swing', ARRAY['single arm kb swing', 'one arm kb swing', 'kb one arm swing']::text[], 'kettlebell', 'glutes', ARRAY['hamstrings', 'back_upper']::text[], 'hinge', false, false, false, false),
('Single-Leg Kettlebell Deadlift', 'single-leg kettlebell deadlift', ARRAY['single leg kb deadlift', 'kb single leg rdl', 'kb pistol deadlift']::text[], 'kettlebell', 'glutes', ARRAY['hamstrings', 'core']::text[], 'hinge', false, false, false, false)
ON CONFLICT (normalized_name) DO NOTHING;
