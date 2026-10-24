/** Supabase project URL and anon key; throws a clear error when they are not configured. */
export function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || url === "your-supabase-url") throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set, see .env.local");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set, see .env.local");
  return { url, anonKey };
}
