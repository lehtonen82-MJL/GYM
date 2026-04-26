-- ============================================================
-- Migration 012: Seed exercise_definitions library
--
-- ~100 practical exercises covering: chest, back, shoulders,
-- biceps, triceps, legs, core, olympic, kettlebell, cardio.
-- Canonical names match common gym parlance.
-- Normalized names are lowercase, trimmed, single-spaced.
-- ============================================================

INSERT INTO exercise_definitions
  (name, normalized_name, aliases, equipment_type, primary_muscle, secondary_muscles, movement_pattern, is_bodyweight, is_cardio, is_bilateral, is_main_lift)
VALUES

-- ── CHEST ──────────────────────────────────────────────────────────────

('Bench Press',            'bench press',            ARRAY['flat bench press', 'barbell bench press'],  'barbell',       'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', false, false, true,  true),
('Incline Bench Press',    'incline bench press',    ARRAY['incline barbell press'],                    'barbell',       'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', false, false, true,  false),
('Decline Bench Press',    'decline bench press',    ARRAY[],                                           'barbell',       'chest',     ARRAY['triceps'],                   'horizontal_push', false, false, true,  false),
('Close Grip Bench Press', 'close grip bench press', ARRAY['cgbp'],                                     'barbell',       'triceps',   ARRAY['chest','shoulders'],         'horizontal_push', false, false, true,  false),

('DB Bench Press',         'db bench press',         ARRAY['dumbbell bench press', 'dumbbell press'],   'dumbbell',      'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', false, false, true,  false),
('DB Incline Bench Press', 'db incline bench press', ARRAY['incline dumbbell press'],                   'dumbbell',      'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', false, false, true,  false),
('DB Decline Bench Press', 'db decline bench press', ARRAY[],                                           'dumbbell',      'chest',     ARRAY['triceps'],                   'horizontal_push', false, false, true,  false),
('DB Fly',                 'db fly',                 ARRAY['dumbbell fly', 'dumbbell flye'],             'dumbbell',      'chest',     ARRAY['shoulders'],                 'isolation',       false, false, true,  false),
('DB Incline Fly',         'db incline fly',         ARRAY['incline dumbbell fly'],                     'dumbbell',      'chest',     ARRAY['shoulders'],                 'isolation',       false, false, true,  false),
('DB Pullover',            'db pullover',            ARRAY['dumbbell pullover'],                        'dumbbell',      'chest',     ARRAY['back_lats','triceps'],        'isolation',       false, false, true,  false),

('Cable Crossover',        'cable crossover',        ARRAY['cable fly'],                                'cable',         'chest',     ARRAY['shoulders'],                 'isolation',       false, false, true,  false),
('Machine Chest Press',    'machine chest press',    ARRAY['chest press machine'],                      'machine_stack', 'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', false, false, true,  false),
('Pec Deck Fly',           'pec deck fly',           ARRAY['pec deck', 'butterfly machine'],            'machine_stack', 'chest',     ARRAY[],                            'isolation',       false, false, true,  false),

('Push-up',                'push-up',                ARRAY['pushup', 'press-up'],                       'bodyweight',    'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', true,  false, true,  false),
('Decline Push-up',        'decline push-up',        ARRAY['decline pushup'],                           'bodyweight',    'chest',     ARRAY['triceps','shoulders'],       'horizontal_push', true,  false, true,  false),
('Incline Push-up',        'incline push-up',        ARRAY['incline pushup'],                           'bodyweight',    'chest',     ARRAY['triceps'],                   'horizontal_push', true,  false, true,  false),
('Diamond Push-up',        'diamond push-up',        ARRAY['diamond pushup', 'close grip push-up'],     'bodyweight',    'triceps',   ARRAY['chest','shoulders'],         'horizontal_push', true,  false, true,  false),
('Chest Dip',              'chest dip',              ARRAY['dips', 'parallel bar dip'],                 'bodyweight',    'chest',     ARRAY['triceps','shoulders'],       'vertical_push',   true,  false, true,  false),

-- ── BACK ───────────────────────────────────────────────────────────────

('Conventional Deadlift',  'conventional deadlift',  ARRAY['deadlift'],                                 'barbell',       'back_upper',ARRAY['hamstrings','glutes','core'],'hinge',           false, false, true,  true),
('Sumo Deadlift',          'sumo deadlift',          ARRAY[],                                           'barbell',       'back_upper',ARRAY['quads','glutes','hamstrings'],'hinge',          false, false, true,  true),
('Rack Pull',              'rack pull',              ARRAY['rack pulls'],                               'barbell',       'back_upper',ARRAY['hamstrings','glutes'],        'hinge',           false, false, true,  false),
('Bent-over Row',          'bent-over row',          ARRAY['barbell row', 'bb row'],                    'barbell',       'back_upper',ARRAY['back_lats','biceps'],         'horizontal_pull', false, false, true,  true),
('Pendlay Row',            'pendlay row',            ARRAY[],                                           'barbell',       'back_upper',ARRAY['back_lats','biceps'],         'horizontal_pull', false, false, true,  false),
('T-bar Row',              't-bar row',              ARRAY['tbar row'],                                 'barbell',       'back_upper',ARRAY['back_lats','biceps'],         'horizontal_pull', false, false, true,  false),
('Good Morning',           'good morning',           ARRAY['goodmorning'],                              'barbell',       'hamstrings',ARRAY['back_upper','glutes'],        'hinge',           false, false, true,  false),
('Barbell Shrug',          'barbell shrug',          ARRAY['shrug'],                                    'barbell',       'back_upper',ARRAY[],                            'isolation',       false, false, true,  false),

('One-Arm DB Row',         'one-arm db row',         ARRAY['single arm dumbbell row', 'db row'],        'dumbbell',      'back_lats', ARRAY['back_upper','biceps'],        'horizontal_pull', false, false, false, false),

('Lat Pulldown',           'lat pulldown',           ARRAY['pulldown', 'cable pulldown'],               'cable',         'back_lats', ARRAY['biceps'],                    'vertical_pull',   false, false, true,  false),
('Wide Grip Lat Pulldown', 'wide grip lat pulldown', ARRAY['wide pulldown'],                            'cable',         'back_lats', ARRAY['biceps'],                    'vertical_pull',   false, false, true,  false),
('Seated Cable Row',       'seated cable row',       ARRAY['cable row', 'seated row'],                  'cable',         'back_upper',ARRAY['back_lats','biceps'],         'horizontal_pull', false, false, true,  false),

('Machine Row',            'machine row',            ARRAY['chest supported row machine'],              'machine_stack', 'back_upper',ARRAY['back_lats','biceps'],         'horizontal_pull', false, false, true,  false),
('Machine Pulldown',       'machine pulldown',       ARRAY['machine lat pulldown'],                     'machine_stack', 'back_lats', ARRAY['biceps'],                    'vertical_pull',   false, false, true,  false),

('Pull-up',                'pull-up',                ARRAY['pullup', 'overhand pull-up'],               'bodyweight',    'back_lats', ARRAY['biceps','core'],             'vertical_pull',   true,  false, true,  true),
('Chin-up',                'chin-up',                ARRAY['chinup', 'underhand pull-up'],              'bodyweight',    'back_lats', ARRAY['biceps'],                    'vertical_pull',   true,  false, true,  true),
('Inverted Row',           'inverted row',           ARRAY['body row', 'supine row'],                   'bodyweight',    'back_upper',ARRAY['back_lats','biceps'],         'horizontal_pull', true,  false, true,  false),

-- ── SHOULDERS ──────────────────────────────────────────────────────────

('Overhead Press',         'overhead press',         ARRAY['ohp', 'military press', 'barbell overhead press'], 'barbell', 'shoulders', ARRAY['triceps','core'],           'vertical_push',   false, false, true,  true),
('Push Press',             'push press',             ARRAY[],                                           'barbell',       'shoulders', ARRAY['triceps','quads'],           'vertical_push',   false, false, true,  false),

('DB Shoulder Press',      'db shoulder press',      ARRAY['dumbbell shoulder press', 'db ohp'],        'dumbbell',      'shoulders', ARRAY['triceps'],                   'vertical_push',   false, false, true,  false),
('Arnold Press',           'arnold press',           ARRAY[],                                           'dumbbell',      'shoulders', ARRAY['triceps'],                   'vertical_push',   false, false, true,  false),
('Lateral Raise',          'lateral raise',          ARRAY['side lateral raise', 'db lateral raise'],   'dumbbell',      'shoulders', ARRAY[],                            'isolation',       false, false, false, false),
('Front Raise',            'front raise',            ARRAY['db front raise'],                           'dumbbell',      'shoulders', ARRAY['chest'],                     'isolation',       false, false, false, false),
('Rear Delt Fly',          'rear delt fly',          ARRAY['rear delt raise', 'reverse fly'],           'dumbbell',      'shoulders', ARRAY['back_upper'],                'isolation',       false, false, false, false),
('Face Pull',              'face pull',              ARRAY['cable face pull'],                          'cable',         'shoulders', ARRAY['back_upper'],                'isolation',       false, false, true,  false),
('Cable Lateral Raise',    'cable lateral raise',    ARRAY[],                                           'cable',         'shoulders', ARRAY[],                            'isolation',       false, false, false, false),
('Cable Rear Delt Fly',    'cable rear delt fly',    ARRAY['cable reverse fly'],                        'cable',         'shoulders', ARRAY['back_upper'],                'isolation',       false, false, false, false),
('Machine Shoulder Press', 'machine shoulder press', ARRAY['shoulder press machine'],                   'machine_stack', 'shoulders', ARRAY['triceps'],                   'vertical_push',   false, false, true,  false),

-- ── BICEPS ─────────────────────────────────────────────────────────────

('Barbell Curl',           'barbell curl',           ARRAY['bb curl', 'straight bar curl'],             'barbell',       'biceps',    ARRAY['forearms'],                  'isolation',       false, false, true,  false),
('EZ-bar Curl',            'ez-bar curl',            ARRAY['ez bar curl', 'ez curl'],                   'barbell',       'biceps',    ARRAY['forearms'],                  'isolation',       false, false, true,  false),

('DB Curl',                'db curl',                ARRAY['dumbbell curl', 'alternating db curl'],     'dumbbell',      'biceps',    ARRAY['forearms'],                  'isolation',       false, false, false, false),
('Hammer Curl',            'hammer curl',            ARRAY['db hammer curl'],                           'dumbbell',      'biceps',    ARRAY['forearms'],                  'isolation',       false, false, false, false),
('Incline DB Curl',        'incline db curl',        ARRAY['incline dumbbell curl'],                    'dumbbell',      'biceps',    ARRAY[],                            'isolation',       false, false, false, false),
('Concentration Curl',     'concentration curl',     ARRAY[],                                           'dumbbell',      'biceps',    ARRAY[],                            'isolation',       false, false, false, false),

('Cable Curl',             'cable curl',             ARRAY['cable bicep curl'],                         'cable',         'biceps',    ARRAY['forearms'],                  'isolation',       false, false, true,  false),
('Preacher Curl',          'preacher curl',          ARRAY['preacher curl machine', 'scott curl'],      'machine_stack', 'biceps',    ARRAY[],                            'isolation',       false, false, true,  false),

-- ── TRICEPS ────────────────────────────────────────────────────────────

('Skull Crusher',          'skull crusher',          ARRAY['lying triceps extension', 'ez skull crusher'], 'barbell',   'triceps',   ARRAY[],                            'isolation',       false, false, true,  false),
('Overhead DB Extension',  'overhead db extension',  ARRAY['dumbbell overhead extension'],              'dumbbell',    'triceps',   ARRAY[],                            'isolation',       false, false, true,  false),
('DB Kickback',            'db kickback',            ARRAY['triceps kickback'],                         'dumbbell',    'triceps',   ARRAY[],                            'isolation',       false, false, false, false),
('Triceps Pushdown (rope)','triceps pushdown (rope)',ARRAY['rope pushdown', 'cable rope pushdown'],     'cable',       'triceps',   ARRAY[],                            'isolation',       false, false, true,  false),
('Triceps Pushdown (bar)', 'triceps pushdown (bar)', ARRAY['bar pushdown', 'cable pushdown'],           'cable',       'triceps',   ARRAY[],                            'isolation',       false, false, true,  false),
('Overhead Cable Extension','overhead cable extension',ARRAY['cable overhead extension'],               'cable',       'triceps',   ARRAY[],                            'isolation',       false, false, true,  false),

-- ── LEGS ───────────────────────────────────────────────────────────────

('Back Squat',             'back squat',             ARRAY['barbell squat', 'squat'],                   'barbell',       'quads',     ARRAY['glutes','hamstrings','core'], 'squat',           false, false, true,  true),
('Front Squat',            'front squat',            ARRAY['barbell front squat'],                      'barbell',       'quads',     ARRAY['glutes','core'],             'squat',           false, false, true,  true),
('Bulgarian Split Squat',  'bulgarian split squat',  ARRAY['bss', 'rear foot elevated split squat'],    'barbell',       'quads',     ARRAY['glutes','hamstrings'],        'lunge',           false, false, false, false),
('Barbell Hip Thrust',     'barbell hip thrust',     ARRAY['hip thrust'],                               'barbell',       'glutes',    ARRAY['hamstrings','quads'],         'hinge',           false, false, true,  false),
('Barbell Lunge',          'barbell lunge',          ARRAY['lunge'],                                    'barbell',       'quads',     ARRAY['glutes','hamstrings'],        'lunge',           false, false, false, false),
('Romanian Deadlift',      'romanian deadlift',      ARRAY['rdl', 'barbell rdl'],                       'barbell',       'hamstrings',ARRAY['glutes','back_upper'],        'hinge',           false, false, true,  false),

('DB Romanian Deadlift',   'db romanian deadlift',   ARRAY['db rdl', 'dumbbell rdl'],                   'dumbbell',      'hamstrings',ARRAY['glutes'],                    'hinge',           false, false, true,  false),
('DB Lunge',               'db lunge',               ARRAY['dumbbell lunge'],                           'dumbbell',      'quads',     ARRAY['glutes','hamstrings'],        'lunge',           false, false, false, false),
('DB Bulgarian Split Squat','db bulgarian split squat',ARRAY['db bss'],                                 'dumbbell',      'quads',     ARRAY['glutes','hamstrings'],        'lunge',           false, false, false, false),

('Leg Press',              'leg press',              ARRAY[],                                           'machine_plate', 'quads',     ARRAY['glutes','hamstrings'],        'squat',           false, false, true,  false),
('Leg Extension',          'leg extension',          ARRAY['leg extension machine'],                    'machine_stack', 'quads',     ARRAY[],                            'isolation',       false, false, true,  false),
('Seated Leg Curl',        'seated leg curl',        ARRAY['leg curl', 'hamstring curl'],               'machine_stack', 'hamstrings',ARRAY[],                            'isolation',       false, false, true,  false),
('Lying Leg Curl',         'lying leg curl',         ARRAY[],                                           'machine_stack', 'hamstrings',ARRAY[],                            'isolation',       false, false, true,  false),
('Hip Thrust Machine',     'hip thrust machine',     ARRAY['machine hip thrust'],                       'machine_stack', 'glutes',    ARRAY['hamstrings'],                'hinge',           false, false, true,  false),
('Hip Abductor Machine',   'hip abductor machine',   ARRAY['abductor machine', 'hip abduction'],        'machine_stack', 'glutes',    ARRAY[],                            'isolation',       false, false, true,  false),
('Hip Adductor Machine',   'hip adductor machine',   ARRAY['adductor machine', 'hip adduction'],        'machine_stack', 'quads',     ARRAY[],                            'isolation',       false, false, true,  false),
('Calf Raise',             'calf raise',             ARRAY['standing calf raise'],                      'machine_plate', 'calves',    ARRAY[],                            'isolation',       false, false, true,  false),
('Seated Calf Raise',      'seated calf raise',      ARRAY['donkey calf raise'],                        'machine_stack', 'calves',    ARRAY[],                            'isolation',       false, false, true,  false),

('Bodyweight Squat',       'bodyweight squat',       ARRAY['air squat', 'bw squat'],                    'bodyweight',    'quads',     ARRAY['glutes'],                    'squat',           true,  false, true,  false),
('Bodyweight Lunge',       'bodyweight lunge',       ARRAY['walking lunge'],                            'bodyweight',    'quads',     ARRAY['glutes','hamstrings'],        'lunge',           true,  false, false, false),
('Glute Bridge',           'glute bridge',           ARRAY['hip bridge'],                               'bodyweight',    'glutes',    ARRAY['hamstrings'],                'hinge',           true,  false, true,  false),
('Nordic Curl',            'nordic curl',            ARRAY['nordic hamstring curl', 'natural leg curl'], 'bodyweight',   'hamstrings',ARRAY['glutes'],                    'hinge',           true,  false, true,  false),
('Step-up',                'step-up',                ARRAY['box step-up'],                              'bodyweight',    'quads',     ARRAY['glutes'],                    'lunge',           true,  false, false, false),

-- ── CORE ───────────────────────────────────────────────────────────────

('Plank',                  'plank',                  ARRAY['forearm plank'],                            'bodyweight',    'core',      ARRAY['shoulders'],                 'core',            true,  false, true,  false),
('Crunch',                 'crunch',                 ARRAY['abs crunch'],                               'bodyweight',    'core',      ARRAY[],                            'core',            true,  false, true,  false),
('Sit-up',                 'sit-up',                 ARRAY['situp'],                                    'bodyweight',    'core',      ARRAY['hip flexors'],               'core',            true,  false, true,  false),
('Leg Raise',              'leg raise',              ARRAY['hanging leg raise', 'lying leg raise'],     'bodyweight',    'core',      ARRAY[],                            'core',            true,  false, true,  false),
('Bicycle Crunch',         'bicycle crunch',         ARRAY[],                                           'bodyweight',    'core',      ARRAY[],                            'core',            true,  false, true,  false),
('Russian Twist',          'russian twist',          ARRAY[],                                           'bodyweight',    'core',      ARRAY[],                            'core',            true,  false, true,  false),
('Hollow Body Hold',       'hollow body hold',       ARRAY['hollow hold'],                              'bodyweight',    'core',      ARRAY[],                            'core',            true,  false, true,  false),
('Ab Wheel Rollout',       'ab wheel rollout',       ARRAY['wheel rollout', 'ab rollout'],              'bodyweight',    'core',      ARRAY['back_lats','shoulders'],      'core',            false, false, true,  false),
('Cable Crunch',           'cable crunch',           ARRAY[],                                           'cable',         'core',      ARRAY[],                            'core',            false, false, true,  false),
('Dragon Flag',            'dragon flag',            ARRAY[],                                           'bodyweight',    'core',      ARRAY[],                            'core',            true,  false, true,  false),

-- ── OLYMPIC LIFTS ──────────────────────────────────────────────────────

('Snatch',                 'snatch',                 ARRAY['barbell snatch'],                           'barbell',       'shoulders', ARRAY['quads','glutes','back_upper','core'], 'olympic', false, false, true,  true),
('Clean & Jerk',           'clean & jerk',           ARRAY['clean and jerk'],                           'barbell',       'shoulders', ARRAY['quads','glutes','back_upper','core'], 'olympic', false, false, true,  true),
('Power Snatch',           'power snatch',           ARRAY[],                                           'barbell',       'shoulders', ARRAY['quads','glutes','back_upper'], 'olympic',        false, false, true,  false),
('Power Clean',            'power clean',            ARRAY[],                                           'barbell',       'quads',     ARRAY['glutes','back_upper','shoulders'], 'olympic',    false, false, true,  false),
('Hang Clean',             'hang clean',             ARRAY[],                                           'barbell',       'quads',     ARRAY['glutes','back_upper'],        'olympic',         false, false, true,  false),
('Hang Snatch',            'hang snatch',            ARRAY[],                                           'barbell',       'shoulders', ARRAY['quads','glutes'],             'olympic',         false, false, true,  false),
('Clean Pull',             'clean pull',             ARRAY[],                                           'barbell',       'quads',     ARRAY['glutes','back_upper'],        'olympic',         false, false, true,  false),
('Snatch Pull',            'snatch pull',            ARRAY[],                                           'barbell',       'quads',     ARRAY['glutes','back_upper'],        'olympic',         false, false, true,  false),
('Push Jerk',              'push jerk',              ARRAY[],                                           'barbell',       'shoulders', ARRAY['quads','triceps'],            'olympic',         false, false, true,  false),
('Split Jerk',             'split jerk',             ARRAY[],                                           'barbell',       'shoulders', ARRAY['quads','triceps','core'],     'olympic',         false, false, true,  false),

-- ── KETTLEBELL ─────────────────────────────────────────────────────────

('Kettlebell Swing',       'kettlebell swing',       ARRAY['kb swing'],                                 'kettlebell',    'glutes',    ARRAY['hamstrings','back_upper','core'], 'hinge',       false, false, true,  false),
('Kettlebell Goblet Squat','kettlebell goblet squat',ARRAY['kb goblet squat', 'goblet squat'],          'kettlebell',    'quads',     ARRAY['glutes','core'],             'squat',           false, false, true,  false),
('Turkish Get-up',         'turkish get-up',         ARRAY['tgu'],                                      'kettlebell',    'shoulders', ARRAY['core','glutes'],              'carry',           false, false, false, false),
('Kettlebell Clean and Press','kettlebell clean and press',ARRAY['kb clean and press'],                 'kettlebell',    'shoulders', ARRAY['quads','glutes','triceps'],   'olympic',         false, false, false, false),

-- ── CARDIO MACHINES ────────────────────────────────────────────────────

('Rowing Machine',         'rowing machine',         ARRAY['rower', 'erg', 'concept2'],                 'cardio_machine','back_lats', ARRAY['quads','glutes','core'],      'cardio',          false, true,  true,  false),
('Stationary Bike',        'stationary bike',        ARRAY['bike', 'spin bike', 'cycling'],             'cardio_machine','quads',     ARRAY['glutes','hamstrings'],        'cardio',          false, true,  true,  false),
('Ski Erg',                'ski erg',                ARRAY['skierg'],                                   'cardio_machine','back_lats', ARRAY['core','shoulders'],           'cardio',          false, true,  true,  false),
('Assault Bike',           'assault bike',           ARRAY['air bike', 'echo bike'],                    'cardio_machine','quads',     ARRAY['shoulders','chest'],          'cardio',          false, true,  true,  false),
('Treadmill',              'treadmill',              ARRAY['running'],                                  'cardio_machine','quads',     ARRAY['glutes','hamstrings'],        'cardio',          false, true,  true,  false),
('Elliptical',             'elliptical',             ARRAY['cross trainer'],                            'cardio_machine','quads',     ARRAY['glutes','hamstrings'],        'cardio',          false, true,  true,  false),
('Stair Climber',          'stair climber',          ARRAY['stairmaster', 'step mill'],                 'cardio_machine','quads',     ARRAY['glutes','calves'],            'cardio',          false, true,  true,  false),
('Jump Rope',              'jump rope',              ARRAY['skipping rope'],                            'other',         'calves',    ARRAY['core','shoulders'],           'cardio',          false, true,  true,  false)

ON CONFLICT (normalized_name) DO NOTHING;
