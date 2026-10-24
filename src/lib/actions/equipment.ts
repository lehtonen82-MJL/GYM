"use server";

import { DEMO_MODE, db, getUserId } from "./_shared";
import { getSuggestedWeightInternal } from "./sets";
import { EQUIPMENT_ORDER, equipmentLabel } from "@/lib/equipment";

export type EquipmentOption = {
  equipment_type: string;
  label: string;
  /** Empty string when no library definition exists for this type — entry gets tagged but exercise is not swapped. */
  definition_id: string;
  exercise_name: string;
  /** The exercise definition's own tool — what an untagged entry was performed with. */
  is_default: boolean;
};

function allEquipmentTypes(
  siblingMap: Map<string, { id: string; name: string }>,
  defaultEquipment: string | null
): EquipmentOption[] {
  return EQUIPMENT_ORDER.map((eq) => {
    const sibling = siblingMap.get(eq);
    return {
      equipment_type: eq,
      label: equipmentLabel(eq),
      definition_id: sibling?.id ?? "",
      exercise_name: sibling?.name ?? "",
      is_default: eq === defaultEquipment,
    };
  });
}

/**
 * Returns all 13 equipment types as dropdown options.
 * Types that have a matching library definition for the same movement include
 * a definition_id so the exercise can be swapped (separate history per tool).
 * Types without a match get definition_id: "" and only tag the entry.
 * Returns [] only when the exercise has no library definition at all.
 */
export async function getEquipmentOptions(
  exerciseId: string
): Promise<EquipmentOption[]> {
  if (DEMO_MODE) return [];

  const supabase = await db();
  const userId = await getUserId();

  // 1. Get exercise → definition
  const { data: exercise } = await supabase
    .from("exercises")
    .select("exercise_definition_id")
    .eq("id", exerciseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!exercise?.exercise_definition_id) return [];

  // 2. Get current definition → movement + muscle
  const { data: def } = await supabase
    .from("exercise_definitions")
    .select("movement_pattern, primary_muscle, equipment_type")
    .eq("id", exercise.exercise_definition_id as string)
    .maybeSingle();

  if (!def) return allEquipmentTypes(new Map(), null);

  // 3. Find sibling definitions sharing movement + muscle (if both are set)
  const siblingMap = new Map<string, { id: string; name: string }>();

  if (def.movement_pattern && def.primary_muscle) {
    const { data: siblings } = await supabase
      .from("exercise_definitions")
      .select("id, name, equipment_type")
      .eq("movement_pattern", def.movement_pattern as string)
      .eq("primary_muscle", def.primary_muscle as string);

    for (const s of siblings ?? []) {
      const eq = s.equipment_type as string;
      if (!siblingMap.has(eq)) {
        siblingMap.set(eq, { id: s.id as string, name: s.name as string });
      }
    }
  }

  return allEquipmentTypes(siblingMap, (def.equipment_type as string | null) ?? null);
}

/**
 * Switches the equipment type on a workout entry.
 * If definition_id is non-empty: finds/creates the user exercise for the new
 * definition and swaps exercise_id (separate history per tool).
 * If definition_id is empty: only tags equipment_type on the entry.
 */
export async function changeEntryEquipment(
  entryId: string,
  newDefinitionId: string,
  newEquipmentType: string
): Promise<{
  exerciseId: string;
  exerciseName: string;
  suggestion: number | null;
} | null> {
  if (DEMO_MODE) return null;

  const supabase = await db();
  const userId = await getUserId();

  // Target sets drive the suggestion in both branches
  const { data: entry } = await supabase
    .from("workout_exercise_entries")
    .select("exercise_id, exercise:exercises!workout_exercise_entries_exercise_id_fkey(id, name), workout_day_exercise:workout_day_exercises(target_sets)")
    .eq("id", entryId)
    .eq("user_id", userId)
    .maybeSingle();

  const entryTyped = entry as {
    exercise_id: string;
    exercise: { id: string; name: string } | null;
    workout_day_exercise: { target_sets: number } | null;
  } | null;
  const targetSets = entryTyped?.workout_day_exercise?.target_sets ?? 3;

  // No definition → just tag equipment_type, keep current exercise.
  // History is filtered by equipment_type, so the suggestion comes from this tool only.
  if (!newDefinitionId) {
    await supabase
      .from("workout_exercise_entries")
      .update({ equipment_type: newEquipmentType })
      .eq("id", entryId)
      .eq("user_id", userId);

    const exerciseId = entryTyped?.exercise_id ?? "";
    const suggestion = exerciseId
      ? await getSuggestedWeightInternal(supabase, userId, exerciseId, targetSets, newEquipmentType)
      : null;
    return {
      exerciseId,
      exerciseName: entryTyped?.exercise?.name ?? "",
      suggestion,
    };
  }

  // Has definition → swap exercise for separate history
  const { data: def } = await supabase
    .from("exercise_definitions")
    .select("name, normalized_name, is_bodyweight, is_main_lift, equipment_type")
    .eq("id", newDefinitionId)
    .maybeSingle();

  if (!def) return null;

  const exerciseName = def.name as string;
  const normalized = def.normalized_name as string;

  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("user_id", userId)
    .eq("exercise_definition_id", newDefinitionId)
    .limit(1)
    .maybeSingle();

  let exerciseId: string;
  if (existing) {
    exerciseId = existing.id as string;
  } else {
    const { data: created } = await supabase
      .from("exercises")
      .insert({
        user_id: userId,
        name: exerciseName,
        normalized_name: normalized,
        exercise_definition_id: newDefinitionId,
        is_bodyweight: def.is_bodyweight,
        is_main_lift: def.is_main_lift,
        category: def.equipment_type,
      })
      .select("id")
      .single();
    if (!created) return null;
    exerciseId = created.id as string;
  }

  await supabase
    .from("workout_exercise_entries")
    .update({ exercise_id: exerciseId, equipment_type: newEquipmentType })
    .eq("id", entryId)
    .eq("user_id", userId);

  const suggestion = await getSuggestedWeightInternal(supabase, userId, exerciseId, targetSets, newEquipmentType);

  return { exerciseId, exerciseName, suggestion };
}
