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

    // 2. Auto-link by normalized_name match using rpc (raw SQL)
    const { error: rpcError } = await supabase.rpc("run_link_exercises" as never);

    // rpc won't work for arbitrary SQL — use the update approach via JS instead
    // Fetch all definitions and match manually
    const { data: defs } = await supabase
      .from("exercise_definitions")
      .select("id, normalized_name");

    const defMap = new Map((defs ?? []).map((d) => [d.normalized_name as string, d.id as string]));

    let linked = 0;
    for (const ex of before ?? []) {
      const defId = defMap.get(ex.normalized_name as string);
      if (defId) {
        await supabase
          .from("exercises")
          .update({ exercise_definition_id: defId })
          .eq("id", ex.id as string);
        linked++;
      }
    }

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
