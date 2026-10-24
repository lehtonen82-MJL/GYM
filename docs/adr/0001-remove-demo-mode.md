# Remove demo mode

The app used to fall back to an in-memory "demo mode" with mock data whenever the Supabase environment variables were missing, and every server action carried a `DEMO_MODE` branch re-implementing its behaviour. Those branches drifted from the real paths (no warmup sets on start, warmups counted in suggestions, set saves that did nothing) and doubled the work of every change, while the only real use is against a Supabase project. We removed demo mode entirely: the app now requires `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` and fails with a clear error when they are missing.

## Consequences

- Trying the app requires a Supabase project (free tier is enough); there is no zero-setup preview.
- Tests that need workout data must use pure modules (e.g. `src/lib/setRules.ts`) or a real/local database, not mocks inside actions.
