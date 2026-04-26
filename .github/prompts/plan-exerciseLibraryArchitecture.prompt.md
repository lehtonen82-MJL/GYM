# Plan: Exercise Type System — Deep Dive & Future Architecture

**TL;DR**: The database already has `category` and `is_main_lift` columns on `exercises` but they're never populated. Exercises are created on-demand with no predefined library, no equipment classification, and no muscle group metadata. The right move is adding a global `exercise_definitions` table as a reference library, enriching user exercises by linking to it, and building UI to browse, filter, and manage exercises properly.

---

## Current State — What's There

| Thing | Status |
|---|---|
| `exercises.category` field | Exists, never populated |
| `exercises.is_main_lift` field | Exists, never populated |
| Equipment type (machine/barbell/bodyweight) | Not stored anywhere |
| Muscle group metadata | Not stored anywhere |
| Bodyweight detection | Dynamic: `weight_kg = 0` at display time |
| Exercise creation UI | None — created on-demand via import/workout start |
| Cardio | Rower only via `workout_bonus_cardio.machine_type = 'rower'` |
| Pre-defined exercise list | Only mock data (8 exercises in mock JSON for demo) |

---

## Proposed Architecture — 4 Phases

### Phase 1 — Global Exercise Definitions Library (new migration)

New `exercise_definitions` table (global read-only, seeded by migration):
```
id, name, normalized_name, aliases[], equipment_type, primary_muscle,
secondary_muscles[], movement_pattern, is_bodyweight, is_cardio,
is_bilateral, is_main_lift
```

Equipment types: `barbell | dumbbell | cable | machine_plate | machine_stack | smith | bodyweight | kettlebell | trap_bar | band | suspension | cardio_machine | other`

Primary muscles: `chest | back_lats | back_upper | shoulders | biceps | triceps | forearms | core | glutes | quads | hamstrings | calves`

Movement patterns: `horizontal_push | vertical_push | horizontal_pull | vertical_pull | squat | hinge | lunge | carry | olympic | isolation | core`

Add FK to user exercises:
```sql
alter table exercises add column exercise_definition_id uuid references exercise_definitions(id) on delete set null;
```

### Phase 2 — Auto-Linking at Runtime

When a user creates/imports an exercise, match by `normalized_name` to `exercise_definitions` and auto-populate `exercise_definition_id`, `category`, `is_main_lift`. Store `is_bodyweight` as an explicit DB flag, not dynamic detection.

### Phase 3 — Extended Cardio

Expand `machine_type` check constraint to include: `bike | skierg | assault_bike | elliptical | treadmill | stair_climber | other`. Use the existing `extra_metrics jsonb` column for machine-specific metrics (watts, HR, stroke rate, etc.).

### Phase 4 — UI Improvements

1. **Exercise Library Browser** — browse by muscle, equipment, or movement pattern
2. **Smart autocomplete** in ProgramForm + SwapExerciseModal — type-ahead against definitions with muscle/equipment badges
3. **Exercise Management page** — rename, merge duplicates, manually link to library definition, delete
4. **Progress enhancements** — volume-by-muscle-group chart, PR timeline, push/pull balance indicator

---

## Missing Exercises to Seed (curated list)

Current mock data covers: Bench Press, Incline Bench, Dips, Fly, Snatch, Clean & Jerk, Pull-ups/Lat Pulldown, Row, Face Pull, RDL, Back/Front Squat, Leg Curl, Calves.

### Chest
- DB Bench Press, DB Fly, DB Incline Bench Press, DB Incline Fly, DB Decline Bench Press, DB Pullover
- Pec Deck Fly, Cable Crossover, Cable Fly, Machine Chest Press, Cable Chest Press
- Push-up, Diamond Push-up, Decline Push-up, Incline Push-up, Chest Dip
- Decline Bench Press, Close Grip Bench Press

### Back
- Pendlay Row, T-bar Row, Conventional Deadlift, Sumo Deadlift, Rack Pull, Good Morning
- One-Arm DB Row, DB Lying Row
- Lat Pulldown, Wide Grip Lat Pulldown, Seated Cable Row, Wide Grip Cable Row, Chest Supported Row, Machine Row
- Chin-up, Inverted Row
- Barbell Shrug

### Shoulders
- Overhead Press, Push Press
- DB Shoulder Press, Arnold Press, Lateral Raise, Front Raise, Rear Delt Fly
- Machine Shoulder Press, Cable Lateral Raise, Cable Rear Delt Fly

### Biceps
- Barbell Curl, EZ-bar Curl
- DB Curl, Hammer Curl, Incline DB Curl, Concentration Curl
- Cable Curl, Preacher Curl Machine

### Triceps
- Skull Crusher, EZ-bar Skull Crusher
- Overhead DB Extension, DB Kickback
- Triceps Pushdown (rope), Triceps Pushdown (bar), Overhead Cable Extension

### Legs
- Leg Press, Leg Extension, Seated Leg Curl, Hip Thrust (machine), Hip Abductor Machine, Hip Adductor Machine, Calf Raise (standing machine), Seated Calf Raise
- Bulgarian Split Squat (barbell), Barbell Hip Thrust, Barbell Lunge, Barbell Step-up
- DB Romanian Deadlift, DB Lunge, DB Bulgarian Split Squat
- Bodyweight Squat, Lunge, Glute Bridge, Nordic Curl, Step-up

### Core
- Plank, Sit-up, Crunch, Leg Raise, Bicycle Crunch, Russian Twist, Hollow Body Hold, Ab Wheel Rollout
- Cable Crunch, Woodchop, Weighted Plank, Dragon Flag

### Olympic Lifts (expand mock)
- Power Snatch, Power Clean, Hang Clean, Hang Snatch, Clean Pull, Snatch Pull, Push Jerk, Split Jerk

### Kettlebell
- Kettlebell Swing, Kettlebell Goblet Squat, Turkish Get-up, Kettlebell Clean and Press

### Cardio Machines
- Stationary Bike, Ski Erg, Assault Bike, Treadmill, Elliptical, Stair Climber, Jump Rope

> ~80–100 exercises total — practical, not exhaustive.

---

## Progression & History Tracking Improvements

- **PR tracking table** (`exercise_prs`): `(user_id, exercise_id, pr_type, value, achieved_at)` — updated after each workout. PR types: `max_weight`, `1rm_estimate` (Epley formula), `max_volume`
- **Volume by muscle group**: aggregate `weight_kg × reps` per `exercise_definitions.primary_muscle` over time
- **Swap continuity**: use existing `original_exercise_id` to cross-reference "this was programmed as X but you did Y" in progression charts
- **Program edit context**: when modifying a day, show last-used weight and PR for each exercise inline

---

## Key Files to Modify

- `supabase/migrations/010_exercise_library.sql` (new)
- `supabase/migrations/011_exercise_prs.sql` (new)
- `supabase/seed.sql` — seed ~100 exercises
- `src/lib/types.ts` — add `ExerciseDefinition`, `ExerciseEquipmentType`, `PrimaryMuscle`, `MovementPattern` types
- `src/lib/actions.ts` — add `getExerciseDefinitions()`, `matchExerciseToLibrary()`, `getExercisePRs()`
- `src/components/SwapExerciseModal.tsx` — library metadata badges
- `src/components/ProgramExerciseRow.tsx` — library-aware autocomplete
- `src/app/(app)/progress/ProgressClient.tsx` — muscle group analysis
- `src/app/(app)/settings/page.tsx` — exercise management UI

---

## Design Decisions

- `exercise_definitions` is **global and read-only** (no per-user rows, no RLS) — seeded by migrations only
- User `exercises` table is unchanged architecturally — the library is a reference layer on top
- Don't break existing UUID-based progression tracking — all historical data stays intact
- Custom exercises users create that don't match the library still work fine (null `exercise_definition_id`)
- Repurpose `exercises.category` to align with `equipment_type` enum values when linking
- `is_main_lift` field already on `exercises` — populate from definition at match time
- Bodyweight: store as explicit flag on `exercises`, not dynamic detection from `weight_kg = 0`
- Cardio: expand `workout_bonus_cardio` `machine_type` constraint + use existing `extra_metrics jsonb`
