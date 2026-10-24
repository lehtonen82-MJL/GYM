"use server";

import type { ExercisePR } from "@/lib/types";
import { DEMO_MODE, db, getDefaultEquipment, getUserId } from "./_shared";
import { matchesEquipment } from "@/lib/equipment";

/**
 * Fetch PRs for a specific exercise done with `equipment`
 * (defaults to the exercise's library tool). PRs are tracked per tool.
 */
export async function getExercisePRs(
  exerciseId: string,
  equipment?: string | null
): Promise<ExercisePR[]> {
  if (DEMO_MODE) return [];

  const supabase = await db();
  const userId = await getUserId();

  const [{ data }, defaults] = await Promise.all([
    supabase
      .from("exercise_prs")
      .select("*")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId),
    getDefaultEquipment(supabase, userId, [exerciseId]),
  ]);

  return ((data ?? []) as ExercisePR[]).filter((pr) =>
    matchesEquipment(pr.equipment_type, equipment, defaults[exerciseId])
  );
}

/**
 * Recompute and upsert PRs for a given exercise after a workout session.
 * Calls the DB function upsert_exercise_prs which uses Epley formula for 1RM.
 * Should be called from completeWorkout() for each exercise entry.
 */
export async function refreshExercisePRs(
  exerciseId: string,
  workoutStartedAt: string
): Promise<void> {
  if (DEMO_MODE) return;

  const supabase = await db();
  const userId = await getUserId();

  await supabase.rpc("upsert_exercise_prs", {
    p_user_id: userId,
    p_exercise_id: exerciseId,
    p_workout_started_at: workoutStartedAt,
  });
}

/**
 * Fetch PRs for all exercises the user has ever logged — useful for dashboard/progress overview.
 * Returns a map of exercise_id → { max_weight, one_rm_estimate, max_volume }.
 */
export async function getAllExercisePRs(): Promise<
  Record<string, Partial<Record<"max_weight" | "1rm_estimate" | "max_volume", { value: number; achieved_at: string }>>>
> {
  if (DEMO_MODE) return {};

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("exercise_prs")
    .select("exercise_id, pr_type, value, achieved_at")
    .eq("user_id", userId);

  const result: Record<string, Partial<Record<"max_weight" | "1rm_estimate" | "max_volume", { value: number; achieved_at: string }>>> = {};
  for (const row of data ?? []) {
    if (!result[row.exercise_id]) result[row.exercise_id] = {};
    result[row.exercise_id][row.pr_type as "max_weight" | "1rm_estimate" | "max_volume"] = {
      value: row.value,
      achieved_at: row.achieved_at,
    };
  }
  return result;
}
