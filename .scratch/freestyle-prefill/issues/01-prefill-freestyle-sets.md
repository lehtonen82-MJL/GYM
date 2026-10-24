# Pre-fill freestyle workouts from previous results

Status: needs-triage
Category: enhancement

Starting a workout from a program plans its sets with `planSets` (src/lib/plannedSets.ts): previous
results' warmup sets, at least as many work sets as last time, weights/reps carried over. Starting from a
**workout template** and **adding an exercise** to a live workout both create blank work sets instead
(target count, no weight/reps, no warmups).

Question: should these two paths plan their sets with `planSets` as well (template: target_sets as the
target, no prescription)? Decided out of scope for the planned-set-generation refactor (2026-10-24) because
it changes behaviour.
