import { supabaseEnv } from "./env";

describe("supabaseEnv", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("names the missing variable", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => supabaseEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL is not set, see .env.local");
  });

  it("returns the configured project", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    expect(supabaseEnv()).toEqual({ url: "https://example.supabase.co", anonKey: "anon" });
  });
});
