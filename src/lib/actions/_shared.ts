// ── Supabase helpers ─────────────────────────────────────

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

/** An exercise's library definition, as far as planning needs it. */
export type LibraryInfo = {
  equipment: string | null;
  isMainLift: boolean;
  isBodyweight: boolean;
  movementPattern: string | null;
  primaryMuscle: string | null;
};

/**
 * exercise_id → its library definition's equipment type, main-lift and bodyweight flags, movement
 * pattern and primary muscle (unlinked: no entry). Used for suggestions and warmups.
 */
export async function getLibraryInfo(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, LibraryInfo>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await supabase
    .from("exercises")
    .select("id, definition:exercise_definitions(equipment_type, is_main_lift, is_bodyweight, movement_pattern, primary_muscle)")
    .eq("user_id", userId)
    .in("id", exerciseIds);

  const result: Record<string, LibraryInfo> = {};
  for (const ex of data ?? []) {
    const def = (Array.isArray(ex.definition) ? ex.definition[0] : ex.definition) as Record<string, unknown> | null;
    if (!def) continue;
    result[ex.id as string] = {
      equipment: (def.equipment_type as string | null) ?? null,
      isMainLift: !!def.is_main_lift,
      isBodyweight: !!def.is_bodyweight,
      movementPattern: (def.movement_pattern as string | null) ?? null,
      primaryMuscle: (def.primary_muscle as string | null) ?? null,
    };
  }
  return result;
}
