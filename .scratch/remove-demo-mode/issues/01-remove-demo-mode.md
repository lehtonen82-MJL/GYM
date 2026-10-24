# Remove demo mode entirely

Status: closed
Category: enhancement

Decided 2026-10-24 (see docs/adr/0001-remove-demo-mode.md).

- Delete every `DEMO_MODE` branch in src/lib/actions/* (cardio, equipment, exercises, freestyle, history,
  programs, prs, sets, today, workout), `_mocks.ts`, and the mock store / `uid()` in `_shared.ts`.
- `src/lib/supabase/middleware.ts`: drop the demo bypass.
- Missing env vars → fail with a clear error: "NEXT_PUBLIC_SUPABASE_URL is not set, see .env.local".
- Docs: README "Demo Mode" section, IMPROVEMENT_PLAN.md demo rule + "keep demo branch" mentions,
  `.env.local` comment line ("Tyhjänä sovellus pyörii demotilassa").
- Done when: no DEMO_MODE/mock references remain; tsc, jest, build pass. Then commit together with the ADR.

Next after this: architecture candidate #2 (planned set generation), decisions Q1 (a: program start paths
only; freestyle stays blank, file a separate ticket), Q3 (warmup reps ignore too_heavy; remove dead code),
Q4 (startDeloadWorkout multi-day becomes a thin wrapper; generator takes one exercise, returns planned sets).

## Comments

### Resolution (2026-10-24)

Done. Every DEMO_MODE branch, `_mocks.ts`, the mock stores and the middleware bypass are gone;
`src/lib/supabase/env.ts` throws "NEXT_PUBLIC_SUPABASE_URL is not set, see .env.local" (or the anon-key
equivalent). README and IMPROVEMENT_PLAN updated; completed-phase notes about demo branches are kept as
history.
