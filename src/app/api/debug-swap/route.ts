import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" });

    const [userResult, libraryResult] = await Promise.all([
      supabase
        .from("exercises")
        .select("id, name, exercise_definition_id")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("exercise_definitions")
        .select("id, name, equipment_type, primary_muscle")
        .order("name")
        .limit(5),
    ]);

    return NextResponse.json({
      user_exercise_count: userResult.data?.length ?? null,
      user_exercise_error: userResult.error?.message ?? null,
      library_sample: libraryResult.data ?? null,
      library_error: libraryResult.error?.message ?? null,
      library_error_code: libraryResult.error?.code ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
