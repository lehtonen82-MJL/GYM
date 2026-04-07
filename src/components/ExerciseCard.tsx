"use client";

import { useEffect, useRef, useState } from "react";
import SetRow from "./SetRow";
import IntervalTimer from "./IntervalTimer";
import type { WorkoutExerciseEntry, SetEntry } from "@/lib/types";
import { getPreviousResults } from "@/lib/actions";

type ExerciseCardProps = {
  entry: WorkoutExerciseEntry;
  sets: SetEntry[];
  onSetsChange: (sets: SetEntry[]) => void;
  suggestedWeight: number | null;
  isActive: boolean;
  onToggle: () => void;
};

function renumber(sets: SetEntry[]): SetEntry[] {
  return sets.map((s, i) => ({ ...s, set_number: i + 1 }));
}

export default function ExerciseCard({
  entry,
  sets,
  onSetsChange,
  suggestedWeight,
  isActive,
  onToggle,
}: ExerciseCardProps) {
  const [prevResults, setPrevResults] = useState<{ weight_kg: number; reps: number }[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPreviousResults(entry.exercise_id).then(setPrevResults);
  }, [entry.exercise_id]);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isActive]);

  // Exit edit mode when card collapses
  useEffect(() => {
    if (!isActive) setIsEditMode(false);
  }, [isActive]);

  function updateSet(setId: string, changes: Partial<SetEntry>) {
    onSetsChange(sets.map((s) => (s.id === setId ? { ...s, ...changes } : s)));
  }

  function handleWeightChange(setId: string, weight: number) {
    updateSet(setId, { weight_kg: weight });
  }

  function handleRepsChange(setId: string, reps: number) {
    updateSet(setId, { reps });
  }

  function handleToggleComplete(setId: string) {
    const set = sets.find((s) => s.id === setId);
    if (set) updateSet(setId, { completed: !set.completed });
  }

  function handleTypeToggle(setId: string) {
    const set = sets.find((s) => s.id === setId);
    if (set) updateSet(setId, { is_warmup: !set.is_warmup });
  }

  function handleMoveSet(setId: string, dir: "up" | "down") {
    const idx = sets.findIndex((s) => s.id === setId);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sets.length) return;
    const next = [...sets];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onSetsChange(renumber(next));
  }

  function handleDeleteSet(setId: string) {
    onSetsChange(renumber(sets.filter((s) => s.id !== setId)));
  }

  function handleAddSet() {
    const last = sets[sets.length - 1];
    const newSet: SetEntry = {
      id: crypto.randomUUID(),
      workout_exercise_entry_id: entry.id,
      user_id: entry.user_id,
      set_number: sets.length + 1,
      weight_kg: last?.weight_kg ?? null,
      reps: last?.reps ?? null,
      completed: false,
      is_warmup: false,
      created_at: new Date().toISOString(),
    };
    onSetsChange([...sets, newSet]);
  }

  const completedCount = sets.filter((s) => s.completed).length;
  const targetSets = entry.workout_day_exercise?.target_sets ?? sets.length;
  const targetReps = entry.workout_day_exercise?.target_reps ?? 5;
  const allDone = completedCount === targetSets && targetSets > 0;

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border overflow-hidden transition-colors ${
        allDone && !isActive
          ? "bg-zinc-900 border-zinc-800 opacity-60"
          : "bg-card border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Toggle area */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 text-left active:opacity-70"
        >
          <h3 className={`font-semibold text-lg ${allDone && !isActive ? "text-zinc-400" : "text-white"}`}>
            {entry.exercise?.name}
          </h3>
          {(!allDone || isActive) && (
            <p className="text-muted text-sm">
              {targetSets}×{targetReps}
              {suggestedWeight !== null && (
                <span className="ml-2 text-accent">↑ {suggestedWeight} kg</span>
              )}
            </p>
          )}
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isActive && (
            <button
              type="button"
              onClick={() => setIsEditMode((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                isEditMode
                  ? "text-accent border-accent/40 bg-accent/10"
                  : "text-zinc-400 border-zinc-700 bg-zinc-800 active:bg-zinc-700"
              }`}
            >
              {isEditMode ? "Done" : "Edit"}
            </button>
          )}
          <button type="button" onClick={onToggle} className="flex items-center gap-1 active:opacity-70">
            {allDone ? (
              <span className="text-success text-lg">✔</span>
            ) : (
              <span className="text-muted text-sm font-medium">
                {completedCount}/{targetSets}
              </span>
            )}
            <span className="text-muted text-xs">{isActive ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Previous results */}
      {isActive && prevResults.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted">
            Last:{" "}
            {prevResults.map((r) => `${r.weight_kg}kg×${r.reps}`).join(", ")}
          </p>
        </div>
      )}

      {/* Sets */}
      {isActive && (
        <div className="px-3 pb-3 space-y-2">
          {sets.map((set, idx) => (
            <SetRow
              key={set.id}
              setNumber={set.set_number}
              weightKg={set.weight_kg}
              reps={set.reps}
              targetReps={targetReps}
              completed={set.completed}
              isWarmup={set.is_warmup ?? false}
              isEditMode={isEditMode}
              isFirst={idx === 0}
              isLast={idx === sets.length - 1}
              onWeightChange={(w) => handleWeightChange(set.id, w)}
              onRepsChange={(r) => handleRepsChange(set.id, r)}
              onToggleComplete={() => handleToggleComplete(set.id)}
              onTypeToggle={() => handleTypeToggle(set.id)}
              onMoveUp={() => handleMoveSet(set.id, "up")}
              onMoveDown={() => handleMoveSet(set.id, "down")}
              onDelete={() => handleDeleteSet(set.id)}
            />
          ))}

          {/* Add Set — only in edit mode */}
          {isEditMode && (
            <button
              type="button"
              onClick={handleAddSet}
              className="w-full py-2 rounded-xl bg-zinc-800 border border-accent/30 text-accent text-sm font-semibold active:bg-zinc-700"
            >
              + Add Set
            </button>
          )}

          {/* Interval Timer — hidden during edit mode */}
          {!isEditMode && (
            <button
              type="button"
              onClick={() => setShowTimer(true)}
              className="w-full mt-1 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm active:bg-zinc-700 flex items-center justify-center gap-2"
            >
              <span>⏱</span>
              <span>Interval Timer</span>
            </button>
          )}
        </div>
      )}

      {showTimer && (
        <IntervalTimer
          defaultRounds={targetSets}
          exerciseId={entry.exercise_id}
          sets={sets}
          targetReps={targetReps}
          onSetsChange={onSetsChange}
          onClose={() => setShowTimer(false)}
        />
      )}
    </div>
  );
}
