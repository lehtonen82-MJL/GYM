# Workout draft is restored ~6 s after the workout screen appears

Status: needs-triage
Category: bug

Found 2026-10-24 testing production (gym-six-ochre.vercel.app) in the desktop app's browser.

After reloading an in-progress workout, the exercise cards render at ~1.2 s showing the server's sets
(nothing checked off), and the workout draft is applied only at ~7.4 s (measured: the draft's
`updatedAt` is rewritten at +7.4 s, which happens right after the hydrate effect). All of
WorkoutClient's passive effects seem to run late, not only the draft one. Timers/rAF/MessageChannel
in the page were not throttled, so it is not the browser.

Effect: no data loss (the draft save waits for hydration), but a set checked off in those seconds
is overwritten when the draft is merged in, and the screen briefly shows wrong progress.

The hydrate/save effects are structurally unchanged from before the workoutSession refactor
(172388a), so this is likely older. Next step: reproduce locally with React profiling to find what
delays the passive effects (suspects: Next 16 route/Activity behaviour, server actions started from
ExerciseCard effects).
