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
    const result = await startWorkout(workoutDayId);
    if (result) {
      // Store full workout data in sessionStorage to avoid server module isolation issues
      sessionStorage.setItem(`workout-${result.id}`, JSON.stringify(result));
      router.push(`/workout/${result.id}`);
    }
    setLoading(false);
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
