# Program save is slow; resumed workouts lose the rep range's max

Status: needs-triage
Category: enhancement

Found 2026-10-25 importing "Legs+Oly / Pull / Push" (3 days, 17 exercises) in production:

1. Saving the imported program took ~8 s (programs.ts inserts days/exercises one round trip at a time).
   Same treatment as Phase 4: one RPC / batched inserts.
2. A rep range's max ("10-12" → 12) lives only on the start result (`target_reps_max`, from
   program_exercises at start). A workout resumed through `buildStartWorkoutResultFromExisting` reads
   workout_day_exercises from the database: its card shows "3×10" and its suggestion uses 10 as the
   target. Fix by deriving targets from program_exercises on resume too (no migration needed).
