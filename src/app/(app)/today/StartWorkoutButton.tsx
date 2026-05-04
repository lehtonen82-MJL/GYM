"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startWorkout, startDeloadWorkout } from "@/lib/actions";
import { useEasyWeekMode } from "./useEasyWeekMode";
import { useSettings } from "@/lib/settings";

export default function StartWorkoutButton({
  workoutDayId,
  programId,
  small = false,
}: {
  workoutDayId: string;
  programId?: string;
  small?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { active: easyWeekActive } = useEasyWeekMode(programId);
  const { deloadWeightPct, deloadSetPct, deloadReduceWarmups } = useSettings();

  async function handleStart() {
    setLoading(true);
    try {
      const result = easyWeekActive && programId
        ? await startDeloadWorkout(workoutDayId, [], deloadWeightPct, deloadSetPct, deloadReduceWarmups)
        : await startWorkout(workoutDayId);
      if (result) {
        const serialized = JSON.stringify(result);
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
        className={`mt-2 text-sm font-medium active:opacity-70 disabled:opacity-50 ${
          easyWeekActive ? "text-amber-400" : "text-accent active:text-accent-hover"
        }`}
      >
        {loading ? "..." : easyWeekActive ? "🔄 Easy →" : "Start →"}
      </button>
    );
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className={`w-full py-4 rounded-xl text-white font-bold text-lg disabled:opacity-50 ${
        easyWeekActive
          ? "bg-amber-500 active:bg-amber-600"
          : "bg-accent active:bg-accent-hover"
      }`}
    >
      {loading ? "Starting..." : easyWeekActive ? "🔄 Start Easy Week" : "Start Workout"}
    </button>
  );
}
