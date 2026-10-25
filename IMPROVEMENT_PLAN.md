# GYM Tracker — Durability, Data, Usability & Freestyle-Workout Plan

> Planning document only. Tasks are granular enough for a single Sonnet/Haiku-class agent to execute one at a time.
> **Rules for implementers:**
> - One task = one focused change. Run `npm run build` after every task; do not move on if it fails.
> - Don't change a public function signature unless the task says so.
> - Before editing the data layer, read `node_modules/next/dist/docs/` per `AGENTS.md` (this is a modified Next.js).
> - Server Actions live in files starting with `"use server"`. Pure helpers must NOT live in those files — put them in `_shared.ts`/util modules.
> - Demo mode was removed (2026-10-24, `docs/adr/0001-remove-demo-mode.md`). Actions have no demo branch; demo-branch notes in completed phases below are historical.

---

## Part A — Health Assessment (summary)

Solid stack (Next 16, Supabase, RLS everywhere) and excellent offline draft handling, but durability risks:
1. `src/lib/actions.ts` is a 3,927-line monolith — top maintainability risk.
2. No DB transactions for multi-row writes → orphan-row risk (already visible in recent "fix/debug" commits).
3. `syncWorkoutSets` does N sequential round-trips (one query per set).
4. Migration chain is inconsistent (duplicate `004_*`, `010_*`; manual `apply_010_013.sql`; possible `schema.sql` drift).
5. Repo cruft (`eng.traineddata` 5 MB, `iCloud Photos/`, `tmp/`, `build_*.txt`, `debug-rowing` route).
6. Almost no tests on the riskiest logic.
7. Naive progression (`max + 2.5`) ignores reps, equipment, `too_heavy`.

## Part B — Competitive gaps worth adding

Rest-timer polish · kg/lb toggle · plate calculator · surfaced PRs · session/weekly volume · bodyweight tracking ·
RPE · history search · **expanded exercise library so all movements are recognized (Phase E)** ·
**freestyle/custom workouts (headline new feature — Phase F)**.

---

## Part C — Granular Task List

Format per task — **Files · Do · Done when.** Phases are ordered; within a phase, tasks are sequential unless noted.

---

### PHASE 0 — Repo hygiene (no behaviour change) · RISK: very low

**Task 0.1 — Remove orphaned binary/data artifacts**
- Files: `eng.traineddata`, `iCloud Photos/`, `tmp/`, `.gitignore`
- Do: `git rm -r --cached eng.traineddata "iCloud Photos" tmp`; delete them from disk; append `eng.traineddata`, `*.traineddata`, `iCloud Photos/`, `tmp/` to `.gitignore`.
- Done when: `git status` shows them removed/ignored; `npm run build` passes.

**Task 0.2 — Remove committed build logs**
- Files: `build-output.txt`, `build_out.txt`, `build_output.txt`, `build_output2.txt`, `build_result.txt`, `build_log.txt`
- Do: delete all; add `build*.txt` to `.gitignore`.
- Done when: none remain tracked.

**Task 0.3 — Delete the debug API route**
- Files: `src/app/api/debug-rowing/route.ts`
- Do: Grep the repo for `debug-rowing`; if nothing references it, delete the file (and the empty folder).
- Done when: route gone, build passes.

**Task 0.4 — Move stray docs into `docs/`**
- Files: `AUDIT_PHASE_0.md`, `PROGRAM_BUILDER_DOCS.md`, `PROGRAM_BUILDER_TESTING.md` → `docs/`
- Do: `git mv` each into a new `docs/` folder. Leave `README.md`, `AGENTS.md`, `CLAUDE.md`, this file at root.
- Done when: root is clean; links (if any) updated.

---

### PHASE 1 — Split `actions.ts` into domain modules · RISK: medium (mechanical)

> Goal: no file over ~500 lines; zero changes to any import site (use a barrel re-export).
> Use the function map in the current `actions.ts` header comments to know which function goes where.

**Task 1.1 — Create shared core**
- Files (new): `src/lib/actions/_shared.ts`
- Do: move `DEMO_MODE`, `db()`, `getUserId()`, and the `globalThis.__ws/__nid/__bonusCardio/...` mock-store setup + `uid()` here. Export them. Start the file with `"use server"` only if it exports actions — it does NOT, so do **not** add `"use server"`; export plain helpers.
- Done when: file compiles in isolation.

**Task 1.2 — Create mock-data module**
- Files (new): `src/lib/actions/_mocks.ts`
- Do: move `MOCK_DAYS`, `MOCK_EXERCISES`, `MOCK_PREV`, and mock helper fns here; import from `_shared.ts` as needed.
- Done when: compiles.

**Task 1.3 … 1.10 — Move action groups (one task each)**
Create each file with `"use server"` at top, import from `_shared`/`_mocks`, and move the listed exports verbatim:
- `today.ts`: `getTodayWorkoutDay`, `getWorkoutDaysForProgram`, `getThisWeekFinishedDayIds`, `getLatestUnfinishedWorkout`
- `workout.ts`: `startWorkout`, `startDeloadWorkout`, `getWorkout`, `completeWorkout`, `swapWorkoutExercise`, `getLastUsedAlternative` (+ internal helpers they call)
- `sets.ts`: `getPreviousResults`, `getSuggestedWeight`, `updateSet`, `syncWorkoutSets`, `saveSets`, `saveTooHeavySets`
- `cardio.ts`: `getWorkoutBonusCardio`, `saveWorkoutBonusCardio`, `getRowingHistory`
- `history.ts`: `getWorkoutHistory`, `exportWorkoutHistory`, `deleteWorkoutFromHistory`, `deleteWorkoutsBulk`, `deleteAllImportedWorkouts`, `importPastWorkouts`
- `exercises.ts`: `getExerciseList*`, `getOrCreateExerciseFromLibrary`, `getExerciseProgress`, `getExerciseDefinitions`, `matchExerciseToLibrary`, `linkExerciseToLibrary`, `getExerciseAlternatives`, `addProgramExerciseAlternative`, `removeProgramExerciseAlternative`
- `programs.ts`: all `*Program*` / `*ProgramDay*` / `*ProgramExercise*` CRUD + `duplicateProgram`, `saveImportedProgram`, `validateProgram`, `updateProgramExerciseDefault`
- `prs.ts`: `getExercisePRs`, `refreshExercisePRs`, `getAllExercisePRs`
- Done when (each): build passes; the moved functions are deleted from the old file.

**Task 1.11 — Convert `actions.ts` to a barrel**
- Files: `src/lib/actions.ts`
- Do: replace its body with `export * from "./actions/today";` … for every module. Keep shared types (`StartWorkoutResult`, `SetSyncEntry`, `RowingDataPoint`) exported from wherever they now live and re-exported here.
- Done when: every existing `import { x } from "@/lib/actions"` still resolves; full build + `npm test` pass.

---

### PHASE 2 — Reconcile migrations & schema · RISK: medium (DB — test on a scratch project)

> **Status 2026-10-24: done.** See `supabase/migrations/README.md` and `AUDIT.md`. Deviations: duplicates were
> renamed with letter suffixes (`004a/b`, `010a/b`) instead of renumbering; verification runs on a local Postgres
> with a Supabase stub (`supabase/tests/verify-migrations.sh`), not a scratch Supabase project; fresh setup now uses
> the generated `supabase/setup.sql`.

**Task 2.1 — Audit drift**
- Do: Read every file in `supabase/migrations/` + `schema.sql`. Produce `supabase/migrations/AUDIT.md` listing: each table/column/policy, which migration introduces it, and any item in `schema.sql` not covered by a migration (or vice-versa).
- Done when: AUDIT.md exists and is complete.

**Task 2.2 — Renumber duplicates into a unique linear sequence**
- Do: rename `004_add_is_warmup_to_set_entries.sql` / `004_past_workout_import.sql` and `010_deload_week.sql` / `010_exercise_library.sql` so ordinals are unique and reflect real apply order; fold `apply_010_013.sql` content into the chain; remove it.
- Done when: ordinals are unique and monotonic; no orphan patch file.

**Task 2.3 — Make every migration idempotent**
- Do: ensure each uses `create table if not exists`, `add column if not exists`, and guarded `create policy`/`create trigger` (drop-if-exists or `do $$ ... $$` guards).
- Done when: running the full chain twice on a fresh DB produces no errors.

**Task 2.4 — Document & regenerate**
- Files (new): `supabase/migrations/README.md`
- Do: state apply order and that `schema.sql` is the generated snapshot (not hand-edited). Rebuild a fresh Supabase project from migrations and diff against `schema.sql`; reconcile.
- Done when: fresh-from-migrations DB == `schema.sql`.

---

### PHASE 3 — kg/lb units + shared formatters · RISK: low

> **Status 2026-10-24: done.** `src/lib/format.ts` (+ tests): weight conversion (`toDisplay`/`fromDisplay`, lb shown to
> 0.1 and converted back to 0.01 kg — the `weight_kg` column precision), `formatWeight`/`formatSet`/`formatVolume`,
> date/duration/pace formatters. Unit setting in Settings → Units. Converted: WeightStepper, IntervalTimer, ExerciseCard,
> workout summary, progress page (chart, PRs, list), Easy Week example. Deviations: the old "duplicate" formatters were
> different formats under the same name, so `format.ts` gives each its own name (`formatWeekdayDate`,
> `formatShortDate`, …); the m:ss tenths formatters in BonusCardioCapture stayed local. **Still kg-only:** program
> builder set weights and the text workout import (both store kg inside text like `100x5` / `@90kg`).

**Task 3.1 — Central format module**
- Files (new): `src/lib/format.ts`
- Do: implement `formatDate`, `formatDuration`, `formatStartedAt`, `formatPace`, plus `toDisplay(weightKg, unit)` and `fromDisplay(value, unit)` (kg canonical; lb = kg×2.2046, round to 0.5 lb / 2.5 kg sensibly). Pure functions, unit-testable.
- Done when: compiles; exported.

**Task 3.2 — Replace duplicated formatters**
- Files: `today/page.tsx`, `WorkoutClient.tsx`, `history/*`, `progress/ProgressClient.tsx`
- Do: delete local `formatDate`/`formatDuration`/`formatPace` copies; import from `format.ts`.
- Done when: no duplicate definitions remain (Grep confirms).

**Task 3.3 — Add unit to settings**
- Files: `src/lib/settings.tsx`
- Do: add `unit: "kg" | "lb"` + `setUnit`, persisted in localStorage like existing prefs; default `"kg"`.
- Done when: setting persists across reload.

**Task 3.4 — Unit toggle in Settings UI**
- Files: `src/app/(app)/settings/page.tsx`
- Do: add a kg/lb segmented control (mirror the existing nav-position control).
- Done when: toggling updates context.

**Task 3.5 — Display weights via the unit at the UI boundary only**
- Files: `WeightStepper.tsx`, `SetRow.tsx`, `ExerciseCard.tsx`, `WorkoutClient.tsx` (summary/readonly), history & progress displays
- Do: convert with `toDisplay` for rendering and `fromDisplay` on input; **store/keep `weight_kg` canonical**. Step size: 2.5 kg or 5 lb based on unit.
- Done when: toggling unit re-labels every weight live; DB still stores kg; no double conversion (audit each `weight_kg` read/write).

---

### PHASE F — Freestyle / Custom Workouts (THE NEW FEATURE) · RISK: medium
> Depends on Phase 1 (put new actions in `src/lib/actions/`). Can run before/after Phases 2–3.
> **UX decided:** Start blank from Today → add exercises as you go → on finish, prompt "Save as workout?" (editable name) →
> saved ones live in a separate **"My Workouts"** section on Today with **preview-before-start**.
> **Storage:** two new tables; freestyle sessions reuse the existing blank-workout pattern (`workout_day_id = null`,
> like imports). The core primitive is `addExerciseToWorkout`.

**Task F.1 — Migration: template tables**
- Files (new): `supabase/migrations/0NN_workout_templates.sql` (next free ordinal)
- Do: create
  - `workout_templates(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null, created_at timestamptz default now(), last_used_at timestamptz)`
  - `workout_template_exercises(id uuid pk default gen_random_uuid(), template_id uuid not null references workout_templates on delete cascade, user_id uuid not null references auth.users on delete cascade, exercise_id uuid not null references exercises on delete cascade, exercise_name_snapshot text not null, target_sets int not null default 3, target_reps int not null default 8, sort_order int not null default 0)`
  - RLS on both: `for all using (auth.uid() = user_id)`; indexes on `(user_id)` and `(template_id)`.
- Do also: add the same tables to `schema.sql`.
- Done when: migration applies idempotently; tables visible.

**Task F.2 — Types**
- Files: `src/lib/types.ts`
- Do: add `WorkoutTemplate` and `WorkoutTemplateExercise` types; a `WorkoutTemplateWithExercises` (template + exercises[]); and a `WorkoutTemplateListItem` (id, name, exercise_count, exercise_names: string[], last_used_at).
- Done when: compiles.

**Task F.3 — Action: `addExerciseToWorkout` (core primitive)**
- Files (new): `src/lib/actions/freestyle.ts` (`"use server"`)
- Do: `addExerciseToWorkout(workoutId, exerciseId, targetSets = 3, targetReps = 8)`:
  - Insert a `workout_exercise_entries` row (workout_id, exercise_id, user_id; `workout_day_exercise_id = null`).
  - Insert `targetSets` blank `set_entries` (set_number 1..N, nulls, completed false, is_warmup false).
  - Return the new entry **with** `exercise` joined and `set_entries[]` populated (so the client can render an `ExerciseCard` immediately).
  - Demo branch: push into `mockStore`.
- Done when: returns a fully-formed `WorkoutExerciseEntry`; rows persisted.

**Task F.4 — Action: `removeExerciseFromWorkout`**
- Files: `freestyle.ts`
- Do: `removeExerciseFromWorkout(entryId)` → delete the entry (cascade removes its sets), scoped to `user_id`. Demo branch mirrors.
- Done when: entry + sets gone.

**Task F.5 — Action: `startBlankWorkout`**
- Files: `freestyle.ts`
- Do: `startBlankWorkout(name?)` → insert a `workouts` row with `workout_day_id = null`, `import_session_name = name ?? "Freestyle workout"`; return a `StartWorkoutResult`-shaped object with **empty** `entries`/`suggestions`/`tooHeavyFlags`. Demo branch mirrors.
- Done when: returns a valid workout id the workout screen can open.

**Task F.6 — Action: `saveWorkoutAsTemplate`**
- Files: `freestyle.ts`
- Do: `saveWorkoutAsTemplate(workoutId, name)` → read the workout's entries (+ their exercise names and current work-set counts), insert one `workout_templates` row and one `workout_template_exercises` per entry (snapshot name, sort_order by entry order, target_sets = work-set count, target_reps = modal reps or 8). Return the new template id. Demo branch mirrors.
- Done when: a template + its exercises exist after calling.

**Task F.7 — Actions: template read/list/manage**
- Files: `freestyle.ts`
- Do:
  - `getWorkoutTemplates(): WorkoutTemplateListItem[]` (for the My Workouts list — include up to ~4 exercise names for the collapsed preview, ordered by `last_used_at` desc then `created_at` desc).
  - `getWorkoutTemplate(id): WorkoutTemplateWithExercises` (full preview).
  - `renameWorkoutTemplate(id, name)`, `deleteWorkoutTemplate(id)`.
- Done when: all return correct data; demo branches present.

**Task F.8 — Action: `startWorkoutFromTemplate`**
- Files: `freestyle.ts`
- Do: `startWorkoutFromTemplate(templateId)` → create a blank workout (reuse F.5 logic, name = template name), then for each template exercise call the F.3 insert path (batch the set inserts). Set `workout_templates.last_used_at = now()`. Return a `StartWorkoutResult` with the entries pre-filled (+ `suggestions` via `getSuggestedWeightInternal` per exercise, like `startWorkout`).
- Done when: opening the returned workout shows the template's exercises with suggested weights.

**Task F.9 — Re-export new actions from the barrel**
- Files: `src/lib/actions.ts`
- Do: `export * from "./actions/freestyle";`
- Done when: importable from `@/lib/actions`.

**Task F.10 — UI: "Add exercise" picker modal**
- Files (new): `src/components/AddExerciseModal.tsx`
- Do: a modal that lists exercises via `getExerciseListForSwap()` with a search box (reuse the look of `SwapExerciseModal.tsx`). On pick, call back with `{ exerciseId, name }`. Allow picking an exercise not yet in the program.
- Done when: modal opens, searches, returns a selection.

**Task F.11 — UI: wire "Add exercise" into the workout screen**
- Files: `src/app/(app)/workout/[id]/WorkoutClient.tsx`
- Do: add an **"+ Add exercise"** button above "Finish Workout" (show for all in-progress, non-readonly workouts — it's required for blank workouts). On select:
  1. call `addExerciseToWorkout(workout.id, exerciseId)`,
  2. append the returned entry to local `entries`,
  3. seed `setsMap[newEntry.id]` from its returned `set_entries`,
  4. **append the new set IDs to `originalSetIds`** so `syncWorkoutSets` updates (not re-inserts) them,
  5. set the new entry active.
- Done when: a freshly added exercise renders as an `ExerciseCard` and saves correctly on Finish (verify a reload mid-session keeps it — it's already persisted server-side).

**Task F.12 — UI: "Save as workout?" prompt at finish**
- Files: `WorkoutClient.tsx`
- Do: after a successful `handleFinish` save, if the workout is freestyle (`workout.workout_day_id == null`) OR any exercise was added mid-session, show a prompt with a text input (default name = `import_session_name` or "Workout {date}") and Save / Skip. On Save → `saveWorkoutAsTemplate(workout.id, name)`. Then navigate to `/today`.
- Done when: finishing a freestyle session offers the save prompt; saving creates a reusable template.

**Task F.13 — UI: "Start blank workout" on Today**
- Files (new): `src/app/(app)/today/StartBlankWorkoutButton.tsx`; edit `today/page.tsx`
- Do: a button that calls `startBlankWorkout()` and routes to `/workout/{id}` (mirror `StartWorkoutButton`'s sessionStorage seeding). Place it near `ManualWorkoutSelector`.
- Done when: tapping it opens an empty workout ready for "+ Add exercise".

**Task F.14 — UI: "My Workouts" section with preview-before-start**
- Files (new): `src/app/(app)/today/MyWorkoutsSection.tsx`; edit `today/page.tsx` (fetch `getWorkoutTemplates()` in `TodayContent`)
- Do: render a separate card titled **My Workouts** listing saved templates. Each row shows name + exercise count; tapping expands a **preview** (exercise list via `getWorkoutTemplate`) with **Start** (→ `startWorkoutFromTemplate`, route to workout), **Rename**, **Delete**. Empty state: "No saved workouts yet — finish a blank workout to save one."
- Done when: a saved template appears, previews, and starts pre-filled.

**Task F.15 — Tests for freestyle logic**
- Files (new): `src/lib/actions/freestyle.test.ts` (demo-mode level) or a pure helper test
- Do: cover snapshot/build payload shape for `saveWorkoutAsTemplate` and `startWorkoutFromTemplate` (exercise order, set counts).
- Done when: `npm test` green.

---

### PHASE E — Exercise Library Expansion ("count all movements") · RISK: low (mostly data)

> **Status 2026-10-24: done.** Library 147 → 307 definitions (115 from `012` + 32 production-only kettlebell rows
> captured as `012b`) (`docs/exercise_gap_list.md`, migration `020`, both
> generated by `scripts/exercise_library_e.py`, which validates enums — none needed changing — and that no two
> definitions share a name/alias under the matching key). Two wrong/conflicting aliases moved (`donkey calf raise`,
> `hanging leg raise`). Matching (E.5) is `src/lib/exerciseMatching.ts`: case/punctuation/spacing/plural-insensitive,
> db/dumbbell, kb/kettlebell and bb/barbell prefixes (equipment never dropped except barbell), trailing "(note)"
> ignored, ambiguous → unlinked; no trigram similarity (kept strict). Tested against the real seed data.
> E.6/E.7: Settings → Exercise library lists unrecognized exercises with a "Re-link exercises" button
> (`relinkAllExercises`); `020` also links by exact name/alias in SQL (`link_unlinked_exercises()`).
> E.8: verified on the local test DB (fixture: "OHP" links, a custom name stays unlinked) — production counts can
> be read from the Settings list after running `setup.sql`.
> **Why:** only **115** exercise definitions are seeded today, and matching is **exact normalized-name or exact-alias only**
> (no fuzzy match — see `matchExerciseToLibrary`). So common lifts ("Incline Bench", "OHP", "Hack Squat", "Upright Row",
> "Hanging Leg Raise", "Farmer's Carry", "Trap-Bar Deadlift", many cable/machine/bodyweight variants) never link to a
> definition → the user exercise gets **no equipment_type / primary_muscle** → this silently breaks equipment-aware
> progression (Phase 6) and volume-per-muscle (Phase 8). This phase closes that gap.
> Depends on Phase 2 (clean migration chain) ideally; otherwise an additive migration is fine.

**Task E.1 — Build the gap list**
- Files (new): `docs/exercise_gap_list.md`
- Do: read `supabase/migrations/012_seed_exercise_definitions.sql` (115 entries). List target additions grouped by
  muscle/pattern — aim to roughly double coverage (~120–180 new). Cover at least: hack/sissy/box/zercher/belt/smith
  squats; reverse/walking/curtsy lunges; trap-bar deadlift, snatch-grip DL, single-leg RDL, cable pull-through;
  upright row, landmine press, Z-press, reverse pec deck; reverse/spider/zottman/drag curls, JM press, bench dip,
  reverse pushdown; floor press, Svend press, machine incline press; hanging leg/knee raise, toes-to-bar, Pallof press,
  side plank, woodchopper, V-up, mountain climber; wrist curl/reverse wrist curl, farmer's walk, suitcase carry, yoke;
  pistol squat, pike/handstand push-up, muscle-up, Nordic variations; thruster, burpee, wall ball, sled push/drag,
  battle ropes, box jump; Olympic accessories (overhead squat, snatch balance, muscle snatch, high pulls, jerk dip).
- Done when: a categorized list exists with chosen `equipment_type` / `primary_muscle` / `movement_pattern` per item.

**Task E.2 — Confirm/extend enums**
- Files: the new migration (below)
- Do: verify each planned item maps to an existing `equipment_type` / `primary_muscle` / `movement_pattern` value
  (see CHECK lists in `010_exercise_library.sql`). For genuinely full-body moves (thruster, burpee) pick the closest
  primary muscle and list the rest in `secondary_muscles`. Only if a value is truly missing, extend the CHECK
  constraint via drop+add (use `013_expand_cardio_types.sql` as the pattern). Prefer **not** changing enums.
- Done when: every planned row satisfies the constraints.

**Task E.3 — Migration: seed new definitions**
- Files (new): `supabase/migrations/0NN_expand_exercise_library.sql`; mirror into `schema.sql` notes
- Do: `INSERT INTO exercise_definitions (...) VALUES (...) ON CONFLICT (normalized_name) DO NOTHING;` for each new
  movement, grouped by muscle for reviewability. Fill `name`, `normalized_name`, `aliases`, `equipment_type`,
  `primary_muscle`, `secondary_muscles`, `movement_pattern`, and flags (`is_bodyweight`, `is_cardio`, `is_main_lift`).
- Done when: applies idempotently; `select count(*) from exercise_definitions` rises to the new target.

**Task E.4 — Aliases for shorthand (biggest matching lever)**
- Files: same or a follow-up migration
- Do: add common aliases to **existing and new** definitions so user shorthands link, e.g. `incline bench`→Incline Bench
  Press, `ohp`/`military press`→Overhead Press, `rdl`→Romanian Deadlift, `bss`→Bulgarian Split Squat, `cgbp`→Close Grip
  Bench Press, `skullcrusher`→Skull Crusher, `pullup`/`pull ups`→Pull-up, `db`/`bb` prefixes, `pulldown`→Lat Pulldown.
  Use `ON CONFLICT (normalized_name) DO UPDATE SET aliases = (select array(select distinct unnest(exercise_definitions.aliases || excluded.aliases)))`
  (dedupe-append) so reseeding is safe.
- Done when: a set of known shorthands resolves via `matchExerciseToLibrary`.

**Task E.5 — Add a conservative fuzzy fallback to matching**
- Files: `src/lib/actions/exercises.ts` (`matchExerciseToLibrary`, `linkExerciseToLibraryInternal`)
- Do: after exact + alias fail, try a normalized variant that strips leading equipment words (`db `, `dumbbell `, `bb `,
  `barbell `, `cable `, `machine `) and parentheticals (`(rope)`), then retry exact/alias. Optionally add a single
  `ILIKE`/`pg_trgm` similarity match with a high threshold. Keep it strict to avoid mis-links.
- Done when: "Incline Bench" links to "Incline Bench Press"; unrelated names still return null.

**Task E.6 — Backfill existing user exercises**
- Files: extend `supabase/migrations/014_link_unlinked_exercises.sql` OR add a server action `relinkAllExercises()`
- Do: for every `exercises` row with `exercise_definition_id IS NULL`, run the improved match and set
  `exercise_definition_id` / `is_bodyweight` / `category`. Provide it as a settings-page button if done in app code.
- Done when: the count of unlinked user exercises drops materially after running.

**Task E.7 — Surface unrecognized exercises (prevent future silent gaps)**
- Files: `src/lib/actions/exercises.ts` + a small Settings/dev panel
- Do: `getUnlinkedExercises()` returning user exercises with no definition; show them in Settings so the owner can see
  what the library still misses and add it later.
- Done when: the list renders; empty when everything is linked.

**Task E.8 — Verify**
- Do: record definition count before/after; spot-check ~10 previously-unlinked names now link; `npm run build` passes.

---

### PHASE 4 — Atomic, batched writes via RPC · RISK: medium-high (core save path)

> **Status (2026-10-24):** 4.1–4.3 done in migration `021` (`start_workout`, `save_workout_sets`, SECURITY INVOKER) and `tests/rpc_test.sql`; applied to production 2026-10-24. 4.4 (manual check on the app) pending.

**Task 4.1 — RPC: `save_workout_sets`**
- Files (new): migration `0NN_save_workout_sets_rpc.sql`
- Do: Postgres function taking `p_entries jsonb` (array of {entryId, workoutDayExerciseId, sets[]}) + `p_original_ids uuid[]`; in ONE transaction: delete removed sets, bulk upsert current sets, update `workout_day_exercises.target_sets`. `security definer`, all writes filtered to `auth.uid()`.
- Done when: applies; callable.

**Task 4.2 — Route `syncWorkoutSets` through the RPC**
- Files: `src/lib/actions/sets.ts`
- Do: replace the per-set loop with a single `supabase.rpc("save_workout_sets", …)`. Keep the existing signature.
- Done when: saving a 6×5 workout issues 1 RPC; data identical to before; killing the request mid-save leaves no partial rows.

**Task 4.3 — Make `startWorkout` creation atomic**
- Files: `src/lib/actions/workout.ts`
- Do: wrap workout+entries+sets creation in a `start_workout` RPC (or a single transaction). Keep the signature.
- Done when: an interrupted start can't orphan a workout with no entries.

**Task 4.4 — Verify with `/verify`**
- Do: run the save/reload/interrupt scenarios manually before merge.

---

### PHASE 5 — Quick-win usability (independent sub-tasks; any subset ships) · RISK: low

> **Status 2026-10-24: done (all four).** 5.1 `src/lib/plates.ts` (exact min-plate search, kg and lb plate sets) +
> `PlateCalculatorModal` from a "Plates" button in the active exercise card (the set rows had no room for another
> control). 5.2 there was no rest timer, only the EMOM interval timer — added `RestTimer`: starts when a set is
> checked off, shown in the active card (+15s / Skip, vibrates at 0), length in Settings → Rest timer (Off–4:00,
> default 2:00). 5.3 `getWorkoutHistory` now returns exercise names + volume; History has a search box
> (`src/lib/historyFilter.ts`: exercise, title, notes, date; all words must match). 5.4 `src/lib/volume.ts`
> (work sets with weight and reps, warmups excluded) on the workout summary, history rows and history detail.

**Task 5.1 — Plate calculator**
- Files (new): `src/lib/plates.ts` (pure `platesFor(targetKg, barKg, available[])`), `src/components/PlateCalculatorModal.tsx`; trigger from a set row.
- Done when: entering 100 kg shows per-side plates.

**Task 5.2 — Rest-timer polish**
- Files: `src/components/IntervalTimer.tsx`, `ExerciseCard.tsx`, `settings.tsx`, `settings/page.tsx`
- Do: confirm it auto-starts on set completion; add a configurable default rest duration in settings; show countdown in the active card.
- Done when: timer auto-starts and respects the setting.

**Task 5.3 — History search/filter**
- Files: `src/app/(app)/history/HistoryList.tsx`
- Do: client-side filter by exercise name / date over the fetched list.
- Done when: typing narrows the list.

**Task 5.4 — Session volume (tonnage)**
- Files: `src/lib/format.ts` (or `volume.ts`), `WorkoutClient.tsx` summary, history detail
- Do: compute Σ(weight×reps) of work sets; show per session.
- Done when: a number appears on summary + history detail.

---

### PHASE 6 — Smarter progression · RISK: medium

> **Status (2026-10-25):** done, in `src/lib/setRules.ts` (`suggestedWeight`, `progressionStep`) rather than a separate progression.ts. Decided rules: up one step only when every work set reached the target reps; one step down after a too-heavy set; otherwise hold; Easy Week never goes up. Steps (kg): barbell/smith/trap bar/plate machine 2.5, dumbbell 2, kettlebell 4, cable/stack machine 5, none for bodyweight/band/suspension/cardio, 2.5 otherwise. Never auto-applied: the card shows Add weight / Same weight / Lighter.

**Task 6.1 — Pure progression module**
- Files (new): `src/lib/progression.ts`
- Do: `suggestNext({ prevSets, targetSets, targetReps, equipmentType, tooHeavyReps })`: if `too_heavy` last time → hold/back-off; if all target reps met across all sets → increment by equipment step (barbell +2.5 kg, dumbbell +2 kg, machine +1 increment); if reps missed → repeat weight.
- Done when: pure + exported.

**Task 6.2 — Unit tests**
- Files (new): `src/lib/progression.test.ts` — cover progress/hold/back-off/first-time.

**Task 6.3 — Use it in suggestions**
- Files: `src/lib/actions/sets.ts`
- Do: feed `equipment_type` from the linked `exercise_definitions` into `getSuggestedWeight*`; never auto-apply — only pre-fill.
- Done when: suggestions differ by equipment and respect `too_heavy`.

---

### PHASE 7 — Tests & CI · RISK: low

**Task 7.1 — Critical-module tests**
- Files: tests for `format.ts` conversions, `workoutImportParser`, `plates.ts`, the sync payload builder.

**Task 7.2 — CI**
- Files (new): `.github/workflows/ci.yml`
- Do: run `npm run build` + `npm test` on PRs.
- Done when: CI green on a PR.

---

### PHASE 8 — Backlog (each its own design+migration+UI cycle)
Bodyweight tracking · weekly volume-per-muscle dashboard · RPE column · supersets · warmup auto-ramp · calendar streak view.

---

## Execution order
0 → 1 → **F** → 2 → 3 → **E** → 5 (any subset) → 4 → 6 → 7.
(Phase F lands the headline feature early; it only needs Phase 1. Phase E (library expansion) is low-risk and should
come before Phase 6 (equipment-aware progression) and Phase 8 (volume-per-muscle), both of which need the metadata it
links. Phase 4's atomic save also hardens the freestyle add-exercise path, but F works without it.)
