"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startWorkout } from "@/lib/actions";

export default function StartWorkoutButton({
  workoutDayId,
  small = false,
}: {
  workoutDayId: string;
  small?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleStart() {
    setLoading(true);
    try {
      const result = await startWorkout(workoutDayId);
      if (result) {
        const serialized = JSON.stringify(result);
        // Keep both stores: sessionStorage for fast tab-local resume and localStorage as fallback.
        sessionStorage.setItem(`workout-${result.id}`, serialized);
        localStorage.setItem(`workout-${result.id}`, serialized);
        router.push(`/workout/${result.id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (small) {
    return (
      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-2 text-sm text-accent font-medium active:text-accent-hover disabled:opacity-50"
      >
        {loading ? "..." : "Start →"}
      </button>
    );
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="w-full py-4 rounded-xl bg-accent text-white font-bold text-lg active:bg-accent-hover disabled:opacity-50"
    >
      {loading ? "Starting..." : "Start Workout"}
    </button>
  );
}
