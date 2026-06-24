import type { Workout, WorkoutBonusCardio, WorkoutExerciseEntry, Program, ProgramDay, ProgramExercise } from "@/lib/types";

// ── Mode detection ──────────────────────────────────────

export const DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "your-supabase-url";

// ── Supabase helpers (only used in production) ──────────

export async function db() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

export async function getUserId(): Promise<string> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ── MockStore type and globalThis declarations ──────────

export type MockStore = { workout: Workout; entries: WorkoutExerciseEntry[] };

declare const globalThis: typeof global & {
  __ws?: Map<string, MockStore>;
  __nid?: number;
  __bonusCardio?: Map<string, WorkoutBonusCardio>;
  __mockPrograms?: Program[];
  __mockProgramDays?: ProgramDay[];
  __mockProgramExercises?: ProgramExercise[];
};
if (!globalThis.__ws) globalThis.__ws = new Map();
if (!globalThis.__nid) globalThis.__nid = 1;
if (!globalThis.__bonusCardio) globalThis.__bonusCardio = new Map();
export const mockStore = globalThis.__ws;
export const mockBonusCardio = globalThis.__bonusCardio;
export function uid() { return `mock-${globalThis.__nid!++}`; }
