"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import WorkoutClient from "./WorkoutClient";
import type { StartWorkoutResult } from "@/lib/actions";
import { getWorkout, getWorkoutBonusCardio } from "@/lib/actions";
import type { WorkoutBonusCardio } from "@/lib/types";
import { browserStorage, clearSession, loadStartResult } from "@/lib/workoutSession";

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StartWorkoutResult | null>(null);
  const [bonusCardio, setBonusCardio] = useState<WorkoutBonusCardio | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1. Try local client stores — only for in-progress workouts.
      //    Completed workouts must be fetched from server so we get the real
      //    set_entries (localStorage only holds the initial empty template).
      const stored = loadStartResult(browserStorage, id);
      if (stored && !stored.workout.completed_at) {
        setData(stored);
        setReadOnly(false);
        setLoading(false);
        return;
      }

      // Clean up a stale start result for completed workouts
      if (stored?.workout.completed_at) clearSession(browserStorage, id);

      // 2. Fetch from server (history view or completed workout)
      const result = await getWorkout(id);
      if (result) {
        const bonus = await getWorkoutBonusCardio(id);
        setData({
          id,
          workout: result.workout,
          entries: result.entries,
          suggestions: {},
          tooHeavyFlags: {},
        });
        setBonusCardio(bonus);
        setReadOnly(Boolean(result.workout.completed_at));
        setLoading(false);
        return;
      }

      // 3. Not found — redirect
      router.replace("/today");
    }
    load();
  }, [id, router]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted text-lg">Loading workout...</div>
      </div>
    );
  }

  return (
    <WorkoutClient
      workout={data.workout}
      entries={data.entries}
      suggestions={data.suggestions}
      tooHeavyFlags={data.tooHeavyFlags}
      readOnly={readOnly}
      bonusCardio={bonusCardio}
    />
  );
}
