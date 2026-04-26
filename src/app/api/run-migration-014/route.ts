import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" });

    // 1. Find unlinked exercises BEFORE
    const { data: before } = await supabase
      .from("exercises")
      .select("id, name, normalized_name")
      .is("exercise_definition_id", null)
      .order("name");

    // Manual mappings: user exercise id → library definition normalized_name
    const MANUAL_MAP: Record<string, string> = {
      "a6d92761-cbf8-4508-b51f-90b2e2705b3e": "calf raise",           // Calves
      "e5c45abf-c36c-4ed2-8297-2c454fc148cc": "db fly",               // Fly
      "0a259b9b-6e55-4725-89b3-5e630c7ad6bd": "seated cable row",     // Row
      "c06511f1-70f0-440b-a3dc-d32183d079bb": "triceps pushdown (bar)", // Triceps
      // Light Row (fe46279e) has no library match — left unlinked intentionally
    };

    const { data: defs } = await supabase
      .from("exercise_definitions")
      .select("id, normalized_name")
      .in("normalized_name", Object.values(MANUAL_MAP));

    const defMap = new Map((defs ?? []).map((d) => [d.normalized_name as string, d.id as string]));

    let linked = 0;
    for (const [exerciseId, defNormalizedName] of Object.entries(MANUAL_MAP)) {
      const defId = defMap.get(defNormalizedName);
      if (defId) {
        await supabase
          .from("exercises")
          .update({ exercise_definition_id: defId })
          .eq("id", exerciseId);
        linked++;
      }
    }

    const rpcError = null;

    // 3. Find still-unlinked AFTER
    const { data: after } = await supabase
      .from("exercises")
      .select("id, name, normalized_name")
      .is("exercise_definition_id", null)
      .order("name");

    return NextResponse.json({
      before_count: before?.length ?? 0,
      linked,
      still_unlinked: after ?? [],
      rpc_error: rpcError?.message ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
