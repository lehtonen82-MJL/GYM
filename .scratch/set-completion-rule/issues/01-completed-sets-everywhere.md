# Count only completed sets in progress, previous results and export

Status: needs-triage

## Context

Volume now counts only **completed work sets** (see `GLOSSARY.md`). Three other places still count every
set that has a weight or reps entered, so **planned sets** (pre-filled by "Add set" or an exercise swap,
never checked off) leak into them:

- Progress graph (`src/lib/actions/exercises.ts`, the `set_entries` query filtered by
  `weight_kg.not.is.null,reps.not.is.null`). Introduced on purpose in 1f7b586 (2026-04-09):
  "show all sets with weight in progress graph regardless of per-set completed flag".
- Previous results (`getPreviousResults`, same rule since 5699a77), which pre-fills the next workout.
- History export (`exportWorkoutHistory` in `src/lib/actions/history.ts`): per-exercise volume, top set and
  set count use all work sets.

The database PR / progression functions in `supabase/setup.sql` already count only `completed = true`.

## Question to settle before implementing

1f7b586 suggests sets were often not checked off in practice. Switching previous results to completed
sets means an unchecked set from last time is no longer suggested. Decide per place whether to switch,
and whether older workouts need any special handling.

## Done when

- Each of the three places either uses the completed-set rule or has a recorded reason not to.
- Tests cover the planned-set case at whatever seam is agreed.
