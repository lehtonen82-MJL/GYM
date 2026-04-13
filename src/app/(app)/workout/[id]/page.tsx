"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import WorkoutClient from "./WorkoutClient";
import type { StartWorkoutResult } from "@/lib/actions";
import { getWorkout, getWorkoutBonusCardio } from "@/lib/actions";
import type { WorkoutBonusCardio } from "@/lib/types";

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StartWorkoutResult | null>(null);
  const [bonusCardio, setBonusCardio] = useState<WorkoutBonusCardio | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function getStoredWorkout(workoutId: string): StartWorkoutResult | null {
      const key = `workout-${workoutId}`;
      const candidates = [sessionStorage.getItem(key), localStorage.getItem(key)];
      for (const raw of candidates) {
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          // Normalize: old stored tooHeavyFlags may be bool, number[], or new {setNumber,achievedReps}[]
          const rawFlags = parsed.tooHeavyFlags ?? {};
          const normalizedFlags: Record<string, { setNumber: number; achievedReps: number | null }[]> = {};
          for (const [key, val] of Object.entries(rawFlags)) {
            if (!Array.isArray(val)) {
              normalizedFlags[key] = [];
            } else if (val.length === 0) {
              normalizedFlags[key] = [];
            } else if (typeof val[0] === "number") {
              // Old format: number[] → convert to new shape with null achievedReps
              normalizedFlags[key] = (val as number[]).map((n) => ({ setNumber: n, achievedReps: null }));
            } else {
              normalizedFlags[key] = val as { setNumber: number; achievedReps: number | null }[];
            }
          }
          return {
            ...parsed,
            suggestions: parsed.suggestions ?? {},
            tooHeavyFlags: normalizedFlags,
          } as StartWorkoutResult;
        } catch {
          // Keep trying next source.
        }
      }
      return null;
    }

    async function load() {
      // 1. Try local client stores (active workout).
      const stored = getStoredWorkout(id);
      if (stored) {
        setData(stored);
        setReadOnly(Boolean(stored.workout.completed_at));
        setLoading(false);
        return;
      }

      // 2. Try fetching from server (viewing history)
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
