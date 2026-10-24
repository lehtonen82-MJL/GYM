# Workout draft is restored ~6 s after the workout screen appears

Status: closed
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

## Comments

### Resolution (2026-10-24)

Cause: the restore ran in an effect, and its state update only committed once the first server action
(ExerciseCard's previous-results fetch, ~5.8 s in production) finished — Next.js runs server actions in
transitions, one at a time. WorkoutClient only renders in the browser, so the draft is now read in the
state initializers: the first render already shows it and nothing waits for a server action. The slow
first server action itself (cold start?) is a separate question.
