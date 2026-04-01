"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExerciseCard from "@/components/ExerciseCard";
import type { Workout, WorkoutExerciseEntry, SetEntry } from "@/lib/types";
import { completeWorkout, saveSets } from "@/lib/actions";

type SetMap = Record<string, SetEntry[]>; // entryId → sets

type Props = {
  workout: Workout;
  entries: WorkoutExerciseEntry[];
  suggestions: Record<string, number | null>;
  readOnly?: boolean;
};

export default function WorkoutClient({
  workout,
  entries,
  suggestions,
  readOnly = false,
}: Props) {
  // All set state lives here — no server round-trips on every tap
  const [setsMap, setSetsMap] = useState<SetMap>(() => {
    const map: SetMap = {};
    for (const entry of entries) {
      map[entry.id] = (entry.set_entries ?? []).map((s) => ({ ...s }));
    }
    return map;
  });

  const [activeEntryId, setActiveEntryId] = useState<string | null>(
    entries[0]?.id ?? null
  );
  const [notes, setNotes] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSetsChange = useCallback(
    (entryId: string, sets: SetEntry[]) => {
      setSetsMap((prev) => ({ ...prev, [entryId]: sets }));

      // Auto-advance to next exercise when all sets are completed
      const allDone = sets.length > 0 && sets.every((s) => s.completed);
      if (allDone) {
        const currentIdx = entries.findIndex((e) => e.id === entryId);
        const nextEntry = entries[currentIdx + 1];
        setTimeout(() => {
          setActiveEntryId(nextEntry ? nextEntry.id : null);
        }, 600);
      }
    },
    [entries]
  );

  async function handleFinish() {
    setSaving(true);
    try {
      // Batch-save all sets to the database
      const allSets = Object.values(setsMap)
        .flat()
        .map((s) => ({
          id: s.id,
          weight_kg: s.weight_kg,
          reps: s.reps,
          completed: s.completed,
        }));
      await saveSets(allSets);
      await completeWorkout(workout.id, notes || null);
      // Clear sessionStorage for this workout
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`workout-${workout.id}`);
      }
      router.push("/today");
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) {
    return (
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted text-sm">{workout.workout_day?.day_label}</p>
            <h1 className="text-2xl font-bold text-white">
              {workout.workout_day?.name}
            </h1>
            {workout.completed_at && (
              <p className="text-muted text-xs mt-1">
                {new Date(workout.started_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push("/history")}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-semibold text-sm active:opacity-80"
          >
            ← Back
          </button>
        </div>

        {entries.map((entry) => {
          const sets = setsMap[entry.id] ?? [];
          const completedSets = sets.filter((s) => s.completed);
          if (completedSets.length === 0 && sets.every((s) => !s.weight_kg)) return null;
          return (
            <div key={entry.id} className="bg-card rounded-2xl border border-border p-4">
              <h3 className="font-semibold text-white mb-2">{entry.exercise?.name}</h3>
              <div className="space-y-1">
                {sets.filter((s) => s.weight_kg || s.completed).map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-muted">Set {s.set_number}</span>
                    <span className="text-white font-mono">
                      {s.weight_kg ?? 0}kg × {s.reps ?? 0}
                      {s.completed && <span className="text-success ml-2">✓</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {workout.notes && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-muted text-sm">Notes</p>
            <p className="text-white mt-1">{workout.notes}</p>
          </div>
        )}
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="space-y-6 pb-8">
        <h1 className="text-2xl font-bold text-white">Workout Summary</h1>
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-lg font-semibold text-white">
            {workout.workout_day?.name}
          </h2>

          {/* Top sets */}
          {entries.map((entry) => {
            const completedSets = (setsMap[entry.id] ?? []).filter(
              (s) => s.completed
            );
            if (completedSets.length === 0) return null;
            const topSet = completedSets.reduce((max, s) =>
              (s.weight_kg ?? 0) > (max.weight_kg ?? 0) ? s : max
            );
            return (
              <div
                key={entry.id}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <span className="text-white">{entry.exercise?.name}</span>
                <span className="text-muted font-mono">
                  {topSet.weight_kg}kg × {topSet.reps}
                </span>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-muted mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel?"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 text-white border border-zinc-800 focus:border-blue-500 focus:outline-none text-base resize-none"
          />
        </div>

        <button
          onClick={handleFinish}
          disabled={saving}
          className="w-full py-4 rounded-xl bg-success text-white font-bold text-lg active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Workout"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted text-sm">{workout.workout_day?.day_label}</p>
          <h1 className="text-2xl font-bold text-white">
            {workout.workout_day?.name}
          </h1>
        </div>
        <button
          onClick={() => setShowSummary(true)}
          className="px-4 py-2 rounded-xl bg-success text-white font-semibold text-sm active:opacity-80"
        >
          Finish
        </button>
      </div>

      {/* Exercise cards */}
      {entries.map((entry) => (
        <ExerciseCard
          key={entry.id}
          entry={entry}
          sets={setsMap[entry.id] ?? []}
          onSetsChange={(sets) => handleSetsChange(entry.id, sets)}
          suggestedWeight={suggestions[entry.exercise_id] ?? null}
          isActive={activeEntryId === entry.id}
          onToggle={() =>
            setActiveEntryId((prev) =>
              prev === entry.id ? null : entry.id
            )
          }
        />
      ))}

      {/* Bottom finish button */}
      <button
        onClick={() => setShowSummary(true)}
        className="w-full py-4 rounded-xl bg-success text-white font-bold text-lg active:opacity-80"
      >
        Finish Workout
      </button>
    </div>
  );
}
