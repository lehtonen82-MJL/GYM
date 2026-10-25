"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserStorage, saveStartResult } from "@/lib/workoutSession";
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
      saveStartResult(browserStorage, result);
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
        className="w-full py-3 rounded-xl bg-surface text-white font-semibold text-sm border border-border-strong active:bg-surface-hover disabled:opacity-50"
      >
        {loading ? "Starting…" : "+ Start blank workout"}
      </button>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}
