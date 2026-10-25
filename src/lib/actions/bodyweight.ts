"use server";

import type { BodyWeight } from "@/lib/bodyWeight";
import { db, getUserId } from "./_shared";

/** The user's body weight log, oldest first. */
export async function getBodyWeights(): Promise<BodyWeight[]> {
  const supabase = await db();
  const userId = await getUserId();
  const { data } = await supabase
    .from("body_weights")
    .select("measured_on, weight_kg")
    .eq("user_id", userId)
    .order("measured_on");
  return (data ?? []).map((r) => ({ measured_on: r.measured_on as string, weight_kg: Number(r.weight_kg) }));
}

/** Log a body weight for a local day ("YYYY-MM-DD"); a second log on the same day replaces the first. */
export async function saveBodyWeight(measuredOn: string, weightKg: number): Promise<void> {
  const supabase = await db();
  const userId = await getUserId();
  const { error } = await supabase
    .from("body_weights")
    .upsert({ user_id: userId, measured_on: measuredOn, weight_kg: weightKg }, { onConflict: "user_id,measured_on" });
  if (error) throw new Error(`Failed to save body weight: ${error.message}`);
}
