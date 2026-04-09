import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" });

    // 1. Check if table exists by querying it
    const { data: cardioRows, error: cardioError } = await supabase
      .from("workout_bonus_cardio")
      .select("*")
      .eq("user_id", user.id)
      .limit(10);

    if (cardioError) {
      return NextResponse.json({
        step: "cardio_query",
        error: cardioError.message,
        code: cardioError.code,
        details: cardioError.details,
        hint: cardioError.hint,
      });
    }

    // 2. Also check completed workouts
    const { data: workouts, error: workoutError } = await supabase
      .from("workouts")
      .select("id, started_at, completed_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      userId: user.id,
      cardioRowCount: cardioRows?.length ?? 0,
      cardioRows,
      recentCompletedWorkouts: workouts ?? [],
      workoutError: workoutError?.message ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
