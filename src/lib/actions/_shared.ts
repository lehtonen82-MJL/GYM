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

/**
 * exercise_id → equipment_type of its linked library definition (null when unlinked).
 * Entries without an explicit equipment_type were performed with this default tool.
 */
export async function getDefaultEquipment(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, string | null>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await supabase
    .from("exercises")
    .select("id, definition:exercise_definitions(equipment_type)")
    .eq("user_id", userId)
    .in("id", exerciseIds);

  const result: Record<string, string | null> = {};
  for (const ex of data ?? []) {
    const def = Array.isArray(ex.definition) ? ex.definition[0] : ex.definition;
    result[ex.id as string] = (def as { equipment_type?: string } | null)?.equipment_type ?? null;
  }
  return result;
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
