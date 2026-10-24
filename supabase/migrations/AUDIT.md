# Migration audit (Phase 2, Task 2.1)

Audited 2026-10-24 by applying the chain to a local Postgres 16 with a minimal Supabase
stub (`tests/supabase_stub.sql`) and diffing the catalog after each step.

## Findings before Phase 2

| # | Problem | Fix |
|---|---------|-----|
| 1 | The chain could not build a database from scratch: `001`… assumed the tables from the hand-maintained `schema.sql` already existed. | That script became `000_base_schema.sql`. |
| 2 | `schema.sql` itself failed: `create trigger if not exists` is not valid Postgres syntax (5 triggers). | `000` uses `drop trigger if exists` + `create trigger`. |
| 3 | `schema.sql` was a stale snapshot, missing everything from `010` onwards (`exercise_definitions`, `exercise_prs`, templates, equipment columns, `original_exercise_id`). | `schema.sql` is now generated from the chain (`tests/verify-migrations.sh --update-snapshot`). |
| 4 | Duplicate ordinals: two `004_*`, two `010_*`. | Renamed to `004a`/`004b`, `010a`/`010b` (letters keep every later number — and every "migration 0NN" reference in code and docs — unchanged). |
| 5 | `012` failed: `ARRAY[]` without a type ("cannot determine type of empty array"). | `ARRAY[]::text[]`. |
| 6 | `apply_010_013.sql` was a hand-patched copy of `010`–`013` plus two backfills — the version actually run on production, diverging from the numbered files (`NOT NULL` arrays, guarded policies, typed arrays). | Folded in: `010b` gets the `NOT NULL` arrays, `012` the typed arrays, `014` its name/alias backfill, new `019` its PR backfill. File removed. |
| 7 | Not re-runnable: unguarded `create policy` (`001`, `009`, `010`, `011`, `016`, base) and `create trigger` (`001`). | `drop … if exists` before every `create policy` / `create trigger`. |
| 8 | PR rows written before `018` mixed tools. | `019` rebuilds `exercise_prs` from history, per tool. |

Known leftovers (harmless): `005_warmup_sets.sql` repeats `004a` (same `add column if not exists`);
`upsert_exercise_prs` is `SECURITY DEFINER` without `SET search_path` and trusts `p_user_id`
(inherited from `011`/`015`, worth fixing in its own migration).

## What each migration adds on a fresh database

`000_base_schema.sql` creates the base tables (`profiles`, `programs`, `workout_days`,
`exercises`, `workout_day_exercises`, `workouts`, `workout_bonus_cardio`,
`workout_exercise_entries`, `set_entries`, `program_exercises`,
`program_exercise_alternatives`), their RLS policies, `updated_at` triggers,
`handle_new_user` + `on_auth_user_created`, and `set_active_program`. Because it is the old
setup script, it already contains the columns that `001`–`009` add with
`add column if not exists`; on an older production database those migrations are what
added them. "No schema change" below therefore means "already in the base", not "useless".

#### `001_programs_feature.sql`

No schema change on a fresh database.

#### `002_bonus_cardio.sql`

- added: index idx_workout_bonus_cardio_user

#### `003_remove_bonus_cardio_ocr.sql`

No schema change on a fresh database.

#### `004a_add_is_warmup_to_set_entries.sql`

No schema change on a fresh database.

#### `004b_past_workout_import.sql`

No schema change on a fresh database.

#### `005_warmup_sets.sql`

No schema change on a fresh database.

#### `006_too_heavy.sql`

No schema change on a fresh database.

#### `007_too_heavy_per_set.sql`

No schema change on a fresh database.

#### `008_too_heavy_reps.sql`

No schema change on a fresh database.

#### `009_exercise_alternatives.sql`

- added: column workout_exercise_entries.original_exercise_id

#### `010a_deload_week.sql`

No schema change on a fresh database.

#### `010b_exercise_library.sql`

- added: column exercise_definitions.aliases
- added: column exercise_definitions.created_at
- added: column exercise_definitions.equipment_type
- added: column exercise_definitions.id
- added: column exercise_definitions.is_bilateral
- added: column exercise_definitions.is_bodyweight
- added: column exercise_definitions.is_cardio
- added: column exercise_definitions.is_main_lift
- added: column exercise_definitions.movement_pattern
- added: column exercise_definitions.name
- added: column exercise_definitions.normalized_name
- added: column exercise_definitions.primary_muscle
- added: column exercise_definitions.secondary_muscles
- added: column exercises.exercise_definition_id
- added: column exercises.is_bodyweight
- added: constraint exercise_definitions: exercise_definitions_equipment_type_check
- added: constraint exercise_definitions: exercise_definitions_movement_pattern_check
- added: constraint exercise_definitions: exercise_definitions_name_key
- added: constraint exercise_definitions: exercise_definitions_normalized_name_key
- added: constraint exercise_definitions: exercise_definitions_primary_muscle_check
- added: index idx_exdef_equipment
- added: index idx_exdef_normalized
- added: index idx_exdef_primary_muscle
- added: index idx_exercises_definition
- added: policy exercise_definitions: exercise_definitions are publicly readable

#### `011_exercise_prs.sql`

- added: column exercise_prs.achieved_at
- added: column exercise_prs.created_at
- added: column exercise_prs.exercise_id
- added: column exercise_prs.id
- added: column exercise_prs.pr_type
- added: column exercise_prs.updated_at
- added: column exercise_prs.user_id
- added: column exercise_prs.value
- added: constraint exercise_prs: exercise_prs_pr_type_check
- added: constraint exercise_prs: exercise_prs_user_id_exercise_id_pr_type_key
- added: function upsert_exercise_prs(uuid,uuid,timestamp with time zone)
- added: index idx_prs_user_exercise
- added: policy exercise_prs: Users can manage own exercise_prs

#### `012_seed_exercise_definitions.sql`

No schema change on a fresh database.

#### `013_expand_cardio_types.sql`

No schema change on a fresh database.

#### `014_link_unlinked_exercises.sql`

No schema change on a fresh database.

#### `015_fix_1rm_formula.sql`

No schema change on a fresh database.

#### `016_workout_templates.sql`

- added: column workout_template_exercises.exercise_id
- added: column workout_template_exercises.exercise_name_snapshot
- added: column workout_template_exercises.id
- added: column workout_template_exercises.sort_order
- added: column workout_template_exercises.target_reps
- added: column workout_template_exercises.target_sets
- added: column workout_template_exercises.template_id
- added: column workout_template_exercises.user_id
- added: column workout_templates.created_at
- added: column workout_templates.id
- added: column workout_templates.last_used_at
- added: column workout_templates.name
- added: column workout_templates.user_id
- added: index idx_workout_templates_user
- added: index idx_wte_template
- added: policy workout_template_exercises: Users can manage own workout_template_exercises
- added: policy workout_templates: Users can manage own workout_templates

#### `017_equipment_variants.sql`

- added: column exercise_prs.equipment_type
- added: column workout_exercise_entries.equipment_type
- added: index idx_wee_exercise_equipment

#### `018_equipment_scoped_prs.sql`

- added: constraint exercise_prs: exercise_prs_user_exercise_type_equipment_key
- added: function upsert_exercise_prs(uuid,uuid,timestamp with time zone,text)
- removed: constraint exercise_prs: exercise_prs_user_id_exercise_id_pr_type_key
- removed: function upsert_exercise_prs(uuid,uuid,timestamp with time zone)

#### `019_recompute_prs.sql`

No schema change on a fresh database.

#### `020_expand_exercise_library.sql` (Phase E, added after this audit)

- added: 168 rows in `exercise_definitions` (115 → 283), aliases for existing rows
- added: function link_unlinked_exercises()
