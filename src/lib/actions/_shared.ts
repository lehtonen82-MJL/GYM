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

/**
 * exercise_id → its library definition's equipment type and main-lift flag (unlinked: no entry).
 * Used to decide automatic warmups (src/lib/plannedSets.ts wantsAutoWarmup).
 */
export async function getLibraryInfo(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, { isMainLift: boolean; equipment: string | null }>> {
  if (exerciseIds.length === 0) return {};
  const { data } = await supabase
    .from("exercises")
    .select("id, definition:exercise_definitions(equipment_type, is_main_lift)")
    .eq("user_id", userId)
    .in("id", exerciseIds);

  const result: Record<string, { isMainLift: boolean; equipment: string | null }> = {};
  for (const ex of data ?? []) {
    const def = (Array.isArray(ex.definition) ? ex.definition[0] : ex.definition) as
      | { equipment_type?: string; is_main_lift?: boolean }
      | null;
    if (def) result[ex.id as string] = { isMainLift: !!def.is_main_lift, equipment: def.equipment_type ?? null };
  }
  return result;
}
