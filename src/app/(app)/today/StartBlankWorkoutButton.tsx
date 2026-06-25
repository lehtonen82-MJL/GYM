"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startBlankWorkout } from "@/lib/actions";

export default function StartBlankWorkoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const result = await startBlankWorkout();
      if (!result) throw new Error("Failed to create workout");
      const serialized = JSON.stringify(result);
      sessionStorage.setItem(`workout-${result.id}`, serialized);
      localStorage.setItem(`workout-${result.id}`, serialized);
      router.push(`/workout/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-zinc-800 text-white font-semibold text-sm border border-zinc-700 active:bg-zinc-700 disabled:opacity-50"
      >
        {loading ? "Starting…" : "+ Start blank workout"}
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}
