# Phase G — Equipment Variant Picker

**Goal:** Each movement (e.g. Shoulder Press) exposes a tool toggle — Barbell / Dumbbell /
Machine / Cable / KB / Smith. The tool can be picked when adding an exercise and switched
mid-workout. Weight suggestions and PRs are tracked **separately per equipment** (a 20 kg
dumbbell press is not comparable to a 60 kg barbell press).

## Core design decision

Equipment is a **per-entry dimension**, NOT a new library row per tool.

- One movement = one `exercise_definitions` row = one user `exercises` row.
- The tool actually used lives on `workout_exercise_entries.equipment_type` — this is the
  source of truth for what those sets were performed with.
- All "previous results", suggested-weight, and PR queries filter by that column, which
  gives "separate per equipment" tracking automatically.
- A movement declares which tools are valid via `exercise_definitions.allowed_equipment`.
  The toggle only renders when `allowed_equipment.length > 1`; tool-specific moves
  (Kettlebell Swing → `{kettlebell}`) show no toggle.

**One entry = one tool.** If a user genuinely wants barbell AND dumbbell bench in the same
session, that is two entries (correct — two separate histories). Switching the tool on an
entry that already has logged sets re-tags those sets to the new tool (same entry). UI hints
"Doing both? Add it again."

## Data model changes

### `exercise_definitions`
- `allowed_equipment text[] NOT NULL DEFAULT '{}'` — valid tools for this movement.
- `default_equipment text` — preselected tool (defaults to existing `equipment_type`).

### `workout_exercise_entries`
- `equipment_type text` — tool used for these sets. **Source of truth for history.**

### `exercise_prs`
- `equipment_type text` — PR scoped to tool. Uniqueness becomes
  `(exercise_id, pr_type, equipment_type)`.

### `exercises` (user)
- `last_equipment_type text` — remembers the user's last tool per movement for quick re-add
  (optional convenience).

### Backfill (safe, additive)
- `workout_exercise_entries.equipment_type` ← linked definition's `equipment_type`
  (`exercises` → `exercise_definitions`). Existing history keeps correct attribution.
- `exercise_prs.equipment_type` ← same backfill so existing PRs map to their tool.
- Seed `allowed_equipment`: multi-tool arrays for generic movements (bench, OHP, row,
  squat, RDL, curl, lat pulldown, etc.); single-element for inherently tool-specific moves.

## Server action changes (`src/lib/actions/`)
- `sets.ts`: `getPreviousResultsInternal` / `getSuggestedWeightInternal` gain an optional
  `equipment?` arg → add `.eq("equipment_type", equipment)` to the entries query.
- `prs.ts`: PR upsert includes `equipment_type`; conflict target updated; PR map keyed by
  `(exercise_id, equipment_type)`.
- `workout.ts` / `freestyle.ts`: when creating entries (`startWorkout`,
  `startBlankWorkout`, `startWorkoutFromTemplate`, `addExerciseToWorkout`), set
  `entry.equipment_type` to the chosen tool (or definition default). Suggestions computed
  for that tool.
- New `changeEntryEquipment(entryId, equipment)` → updates `entry.equipment_type`, returns
  the refreshed suggested weight for that tool.
- `exercises.ts`: include `allowed_equipment` / `default_equipment` in the swap/add lists.

## UI
- New `EquipmentToggle` component: compact segmented pill row with small tool icons. Renders
  only when `allowed_equipment.length > 1`. Active tool highlighted.
  - **AddExerciseModal / blank workout** — pick the tool before adding (default preselected).
  - **WorkoutClient** per-exercise header — switch mid-workout → calls
    `changeEntryEquipment` → refreshes the suggested weight, keeps logged sets.
- Equipment badge already shown in lists now reflects `entry.equipment_type`.

## Phases (granular, for lesser models)
- **G1** — DB migration: add columns + backfill entries/PRs from linked definition. Additive, safe.
- **G2** — Seed `allowed_equipment` / `default_equipment` for movements (generic = multi-tool).
- **G3** — Make reads equipment-aware: `getPreviousResults*`, `getSuggestedWeight*`, PR map.
- **G4** — Entry creation sets `equipment_type`; add `changeEntryEquipment` action; PR upsert tool-scoped.
- **G5** — `EquipmentToggle` component + wire into AddExerciseModal (pick at add time).
- **G6** — Wire `EquipmentToggle` into WorkoutClient (switch mid-exercise, re-suggest weight).
- **G7** — History/PR views show per-equipment; manual verification + `npm run build`.

## Out of scope (deferred)
- Gym/equipment ownership profile + availability filtering (the "Both" option) — can layer
  on later using `allowed_equipment` ∩ owned-equipment.
