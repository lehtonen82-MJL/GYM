"use server";

import type { WorkoutDay, Workout } from "@/lib/types";
import { db, getUserId } from "./_shared";
import { getActiveProgram } from "./programs";

export async function getTodayWorkoutDay(): Promise<WorkoutDay | null> {
  const supabase = await db();
  const userId = await getUserId();
  const dow = new Date().getDay();

  // Get active program first
  const activeProgram = await getActiveProgram();
  if (!activeProgram) return null;

  const { data } = await supabase
    .from("workout_days")
    .select("*")
    .eq("user_id", userId)
    .eq("program_id", activeProgram.id)
    .eq("day_of_week", dow)
    .limit(1)
    .single();

  return data ?? null;
}

export async function getWorkoutDaysForProgram(): Promise<WorkoutDay[]> {
  const supabase = await db();
  const userId = await getUserId();

  // Get active program first
  const activeProgram = await getActiveProgram();
  if (activeProgram) {
    const { data: activeDays } = await supabase
      .from("workout_days")
      .select("*")
      .eq("user_id", userId)
      .eq("program_id", activeProgram.id)
      .order("day_order");

    if (activeDays && activeDays.length > 0) {
      return activeDays;
    }
  }

  // Fallback: if no active program has days, choose one program (newest with days).
  const { data: programs } = await supabase
    .from("programs")
    .select("id, created_at, updated_at")
    .eq("user_id", userId)
    .neq("name", "__imports__")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  for (const program of programs ?? []) {
    const { data: candidateDays } = await supabase
      .from("workout_days")
      .select("*")
      .eq("user_id", userId)
      .eq("program_id", program.id)
      .order("day_order");

    if (candidateDays && candidateDays.length > 0) {
      return candidateDays;
    }
  }

  return [];
}

// Returns workout_day_ids of all completed workouts in the current calendar week (Mon–Sun).
export async function getThisWeekFinishedDayIds(): Promise<string[]> {
  const supabase = await db();
  const userId = await getUserId();

  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("workouts")
    .select("workout_day_id")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .gte("completed_at", weekStart.toISOString())
    .not("workout_day_id", "is", null);

  return (data ?? []).map((w) => w.workout_day_id as string);
}

export async function getLatestUnfinishedWorkout(): Promise<Workout | null> {
  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Workout | null) ?? null;
}
