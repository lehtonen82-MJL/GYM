import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a program, if not create default
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: programs } = await supabase
          .from("programs")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (!programs || programs.length === 0) {
          await supabase.rpc("create_default_program", {
            p_user_id: user.id,
          });
        }
      }

      return NextResponse.redirect(`${origin}/today`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
