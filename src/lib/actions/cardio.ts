"use server";

import type { WorkoutBonusCardio } from "@/lib/types";
import { db, getUserId } from "./_shared";

export type RowingDataPoint = {
  date: string;
  pace_per_500_seconds: number;
  distance_m: number | null;
  duration_seconds: number | null;
  calories: number | null;
};

export type SaveWorkoutBonusCardioInput = {
  machine_type?: "rower";
  distance_m?: number | null;
  duration_seconds?: number | null;
  pace_per_500_seconds?: number | null;
  calories?: number | null;
  stroke_rate?: number | null;
  avg_watts?: number | null;
  extra_metrics?: Record<string, number | null> | null;
};

function isMissingBonusCardioTableError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes("workout_bonus_cardio") ||
    message.includes('relation "workout_bonus_cardio" does not exist')
  );
}

export async function getWorkoutBonusCardio(
  workoutId: string
): Promise<WorkoutBonusCardio | null> {
  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_bonus_cardio")
    .select("*")
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingBonusCardioTableError(error)) return null;
    throw new Error(`Failed to load bonus cardio: ${error.message}`);
  }

  return (data ?? null) as WorkoutBonusCardio | null;
}

export async function saveWorkoutBonusCardio(
  workoutId: string,
  input: SaveWorkoutBonusCardioInput
): Promise<WorkoutBonusCardio> {
  // The form stores avg pace in extra_metrics.avg_pace_per_500_seconds.
  // Promote it to the canonical pace_per_500_seconds column so history queries work.
  const resolvedPace =
    input.pace_per_500_seconds ??
    (input.extra_metrics?.avg_pace_per_500_seconds as number | null | undefined) ??
    null;

  const payload = {
    machine_type: "rower" as const,
    distance_m: input.distance_m ?? null,
    duration_seconds: input.duration_seconds ?? null,
    pace_per_500_seconds: resolvedPace,
    calories: input.calories ?? null,
    stroke_rate: input.stroke_rate ?? null,
    avg_watts: input.avg_watts ?? null,
    extra_metrics: input.extra_metrics ?? {},
  };


  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_bonus_cardio")
    .upsert(
      {
        workout_id: workoutId,
        user_id: userId,
        ...payload,
      },
      { onConflict: "workout_id" }
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingBonusCardioTableError(error)) {
      console.warn(
        "[bonus-cardio] Table workout_bonus_cardio is missing in Supabase; skipping persistence."
      );
      return {
        id: crypto.randomUUID(),
        workout_id: workoutId,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload,
      } as WorkoutBonusCardio;
    }
    throw new Error(`Failed to save bonus cardio: ${error.message}`);
  }
  return data as WorkoutBonusCardio;
}

export async function getRowingHistory(): Promise<RowingDataPoint[]> {
  const supabase = await db();
  const userId = await getUserId();

  // Step 1: fetch bonus cardio rows — no join, avoids any join/RLS complications
  const { data: cardioRows, error: cardioError } = await supabase
    .from("workout_bonus_cardio")
    .select("workout_id, pace_per_500_seconds, distance_m, duration_seconds, calories, extra_metrics")
    .eq("user_id", userId)
    .eq("machine_type", "rower");

  if (cardioError) {
    console.error("[getRowingHistory] cardio query error:", cardioError.message);
    return [];
  }
  if (!cardioRows || cardioRows.length === 0) return [];

  // Step 2: fetch corresponding workouts to get started_at (and optionally completed_at)
  const workoutIds = (cardioRows as { workout_id: string }[]).map((r) => r.workout_id);
  const { data: workoutRows } = await supabase
    .from("workouts")
    .select("id, started_at, completed_at")
    .eq("user_id", userId)
    .in("id", workoutIds);

  const workoutMap = new Map<string, { started_at: string; completed_at: string | null }>(
    ((workoutRows ?? []) as { id: string; started_at: string; completed_at: string | null }[])
      .map((w) => [w.id, { started_at: w.started_at, completed_at: w.completed_at }])
  );

  return (cardioRows as unknown as Array<{
    workout_id: string;
    pace_per_500_seconds: number | null;
    distance_m: number | null;
    duration_seconds: number | null;
    calories: number | null;
    extra_metrics: Record<string, number | null> | null;
  }>)
    .filter((row) => {
      const w = workoutMap.get(row.workout_id);
      // Exclude sessions from workouts that were started but never completed
      if (w && !w.completed_at) return false;
      // Must have pace, distance or duration
      const pace =
        row.pace_per_500_seconds ??
        (row.extra_metrics?.avg_pace_per_500_seconds as number | null);
      return pace != null || row.distance_m != null || row.duration_seconds != null;
    })
    .map((row) => {
      const w = workoutMap.get(row.workout_id);
      const pace =
        row.pace_per_500_seconds ??
        (row.extra_metrics?.avg_pace_per_500_seconds as number | null) ??
        0;
      return {
        date: (w?.started_at ?? new Date().toISOString()).split("T")[0],
        pace_per_500_seconds: pace,
        distance_m: row.distance_m,
        duration_seconds: row.duration_seconds,
        calories: row.calories,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
