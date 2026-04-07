"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import ExerciseCard from "@/components/ExerciseCard";
import type {
  Workout,
  WorkoutBonusCardio,
  WorkoutExerciseEntry,
  SetEntry,
} from "@/lib/types";
import {
  completeWorkout,
  syncWorkoutSets,
  saveWorkoutBonusCardio,
  deleteWorkoutFromHistory,
} from "@/lib/actions";
import BonusCardioCapture, {
  createEmptyBonusCardio,
  hasBonusCardioData,
  type BonusCardioDraft,
} from "./BonusCardioCapture";

type SetMap = Record<string, SetEntry[]>;
type DraftSetPatch = Pick<SetEntry, "id" | "weight_kg" | "reps" | "completed" | "is_warmup">;
type WorkoutDraftSnapshot = {
  version: 1;
  setsByEntryId: Record<string, DraftSetPatch[]>;
  notes: string;
  bonusCardioDraft: BonusCardioDraft;
  showSummary: boolean;
  activeEntryId: string | null;
  updatedAt: string;
};

type Props = {
  workout: Workout;
  entries: WorkoutExerciseEntry[];
  suggestions: Record<string, number | null>;
  readOnly?: boolean;
  bonusCardio?: WorkoutBonusCardio | null;
};

function draftStorageKey(workoutId: string): string {
  return `workout-draft-${workoutId}`;
}

function hasDraftContent(
  setsMap: SetMap,
  notes: string,
  bonusCardioDraft: BonusCardioDraft
): boolean {
  const hasSetInput = Object.values(setsMap).some((sets) =>
    sets.some((set) => set.completed || set.weight_kg !== null || set.reps !== null)
  );
  return hasSetInput || notes.trim().length > 0 || hasBonusCardioData(bonusCardioDraft);
}

function mergeSetsWithDraft(current: SetMap, draft: Record<string, DraftSetPatch[]>): SetMap {
  const next: SetMap = {};

  for (const [entryId, sets] of Object.entries(current)) {
    const draftSets = draft[entryId] ?? [];
    if (draftSets.length === 0) {
      next[entryId] = sets.map((set) => ({ ...set }));
      continue;
    }

    const draftById = new Map(draftSets.map((set) => [set.id, set]));
    next[entryId] = sets.map((set) => {
      const patch = draftById.get(set.id);
      if (!patch) return { ...set };
      return {
        ...set,
        weight_kg: patch.weight_kg,
        reps: patch.reps,
        completed: patch.completed,
        is_warmup: patch.is_warmup ?? set.is_warmup,
      };
    });
  }

  return next;
}

export default function WorkoutClient({
  workout,
  entries,
  suggestions,
  readOnly = false,
  bonusCardio = null,
}: Props) {
  const [setsMap, setSetsMap] = useState<SetMap>(() => {
    const map: SetMap = {};
    for (const entry of entries) {
      map[entry.id] = (entry.set_entries ?? []).map((s) => ({ ...s }));
    }
    return map;
  });

  // Track which set IDs existed in DB when this workout was loaded
  const originalSetIds = entries.flatMap((e) => (e.set_entries ?? []).map((s) => s.id));

  const [activeEntryId, setActiveEntryId] = useState<string | null>(entries[0]?.id ?? null);
  const [notes, setNotes] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [hydratedDraft, setHydratedDraft] = useState(false);
  const [bonusCardioDraft, setBonusCardioDraft] = useState<BonusCardioDraft>(
    bonusCardio
      ? {
          machine_type: "rower",
          distance_m: bonusCardio.distance_m,
          duration_seconds: bonusCardio.duration_seconds,
          pace_per_500_seconds: bonusCardio.pace_per_500_seconds,
          calories: bonusCardio.calories,
          stroke_rate: bonusCardio.stroke_rate,
          avg_watts: bonusCardio.avg_watts,
          extra_metrics: bonusCardio.extra_metrics ?? {},
        }
      : createEmptyBonusCardio()
  );

  const router = useRouter();

  useEffect(() => {
    if (!readOnly || !workout.completed_at) return;
    localStorage.removeItem(draftStorageKey(workout.id));
    localStorage.removeItem(`workout-${workout.id}`);
    sessionStorage.removeItem(`workout-${workout.id}`);
  }, [readOnly, workout.completed_at, workout.id]);

  useEffect(() => {
    if (readOnly) {
      setHydratedDraft(true);
      return;
    }

    const key = draftStorageKey(workout.id);
    const raw = localStorage.getItem(key);
    if (!raw) {
      setHydratedDraft(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as WorkoutDraftSnapshot;
      if (parsed?.version !== 1) {
        setHydratedDraft(true);
        return;
      }

      setSetsMap((prev) => mergeSetsWithDraft(prev, parsed.setsByEntryId ?? {}));
      if (typeof parsed.notes === "string") setNotes(parsed.notes);
      if (parsed.bonusCardioDraft) setBonusCardioDraft(parsed.bonusCardioDraft);
      if (typeof parsed.showSummary === "boolean") setShowSummary(parsed.showSummary);
      if (
        parsed.activeEntryId === null ||
        entries.some((entry) => entry.id === parsed.activeEntryId)
      ) {
        setActiveEntryId(parsed.activeEntryId ?? null);
      }
    } catch {
      // Ignore malformed local draft.
    } finally {
      setHydratedDraft(true);
    }
  }, [entries, readOnly, workout.id]);

  useEffect(() => {
    if (readOnly || !hydratedDraft) return;

    const snapshot: WorkoutDraftSnapshot = {
      version: 1,
      setsByEntryId: Object.fromEntries(
        Object.entries(setsMap).map(([entryId, sets]) => [
          entryId,
          sets.map((set) => ({
            id: set.id,
            weight_kg: set.weight_kg,
            reps: set.reps,
            completed: set.completed,
            is_warmup: set.is_warmup ?? false,
          })),
        ])
      ),
      notes,
      bonusCardioDraft,
      showSummary,
      activeEntryId,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftStorageKey(workout.id), JSON.stringify(snapshot));
  }, [
    activeEntryId,
    bonusCardioDraft,
    hydratedDraft,
    notes,
    readOnly,
    setsMap,
    showSummary,
    workout.id,
  ]);

  useEffect(() => {
    if (readOnly) return;
    if (!hasDraftContent(setsMap, notes, bonusCardioDraft)) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bonusCardioDraft, notes, readOnly, setsMap]);

  useEffect(() => {
    if (readOnly || showSummary) return;

    const allSetsDone = entries.every((entry) => {
      const sets = setsMap[entry.id] ?? [];
      return sets.length > 0 && sets.every((s) => s.completed);
    });

    if (allSetsDone && entries.length > 0) {
      const timer = setTimeout(() => setShowSummary(true), 500);
      return () => clearTimeout(timer);
    }
  }, [entries, readOnly, setsMap, showSummary]);

  const handleSetsChange = useCallback(
    (entryId: string, sets: SetEntry[]) => {
      setSetsMap((prev) => ({ ...prev, [entryId]: sets }));

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

  function handleFinishClick() {
    const hasIncomplete = entries.some((entry) => {
      const sets = setsMap[entry.id] ?? [];
      return sets.some((s) => !s.completed);
    });
    if (hasIncomplete) {
      setShowIncompleteWarning(true);
    } else {
      setShowSummary(true);
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const entriesData = entries.map((entry) => ({
        entryId: entry.id,
        workoutDayExerciseId: entry.workout_day_exercise_id ?? null,
        userId: entry.user_id,
        sets: (setsMap[entry.id] ?? []).map((s) => ({
          id: s.id,
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps: s.reps,
          completed: s.completed,
          is_warmup: s.is_warmup ?? false,
        })),
      }));

      await syncWorkoutSets(entriesData, originalSetIds);

      if (hasBonusCardioData(bonusCardioDraft)) {
        try {
          await saveWorkoutBonusCardio(workout.id, bonusCardioDraft);
        } catch (error) {
          console.warn("[workout] Bonus cardio save skipped:", error);
        }
      }

      await completeWorkout(workout.id, notes || null);

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`workout-${workout.id}`);
        localStorage.removeItem(`workout-${workout.id}`);
        localStorage.removeItem(draftStorageKey(workout.id));
      }
      router.push("/today");
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`workout-${workout.id}`);
        localStorage.removeItem(`workout-${workout.id}`);
        localStorage.removeItem(draftStorageKey(workout.id));
      }
      await deleteWorkoutFromHistory(workout.id);
      router.push("/today");
    } catch {
      alert("Failed to discard workout. Please try again.");
    } finally {
      setDiscarding(false);
      setShowDiscardConfirm(false);
    }
  }

  if (readOnly) {
    return (
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted text-sm">{workout.workout_day?.day_label}</p>
            <h1 className="text-2xl font-bold text-white">{workout.workout_day?.name}</h1>
            {workout.completed_at && (
              <p className="text-muted text-xs mt-1">
                {new Date(workout.started_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push("/history")}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-semibold text-sm active:opacity-80"
          >
            {"<"} Back
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
                      {s.weight_kg ?? 0}kg x {s.reps ?? 0}
                      {s.completed && <span className="text-success ml-2">OK</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <BonusCardioCapture value={bonusCardioDraft} onChange={setBonusCardioDraft} readOnly saved={bonusCardio} />

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
          <h2 className="text-lg font-semibold text-white">{workout.workout_day?.name}</h2>

          {entries.map((entry) => {
            const completedSets = (setsMap[entry.id] ?? []).filter((s) => s.completed);
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
                  {topSet.weight_kg}kg x {topSet.reps}
                </span>
              </div>
            );
          })}
        </div>

        <BonusCardioCapture value={bonusCardioDraft} onChange={setBonusCardioDraft} />

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
          disabled={saving || discarding}
          className="w-full py-4 rounded-xl bg-success text-white font-bold text-lg active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Workout"}
        </button>

        {showDiscardConfirm ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(false)}
              className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-semibold text-sm active:bg-zinc-700"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => void handleDiscard()}
              disabled={discarding}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700 disabled:opacity-50"
            >
              {discarding ? "Discarding..." : "Yes, Discard"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(true)}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-zinc-900 text-red-400 font-semibold text-sm border border-zinc-800 active:bg-zinc-800 disabled:opacity-50"
          >
            Discard Workout
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted text-sm">{workout.workout_day?.day_label}</p>
          <h1 className="text-2xl font-bold text-white">{workout.workout_day?.name}</h1>
        </div>
      </div>

      {entries.map((entry) => (
        <ExerciseCard
          key={entry.id}
          entry={entry}
          sets={setsMap[entry.id] ?? []}
          onSetsChange={(sets) => handleSetsChange(entry.id, sets)}
          suggestedWeight={suggestions[entry.exercise_id] ?? null}
          isActive={activeEntryId === entry.id}
          onToggle={() => setActiveEntryId((prev) => (prev === entry.id ? null : entry.id))}
        />
      ))}

      <button
        onClick={handleFinishClick}
        className="w-full py-4 rounded-xl bg-success text-white font-bold text-lg active:opacity-80"
      >
        Finish Workout
      </button>

      {/* Incomplete sets warning modal */}
      {showIncompleteWarning && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
          <div className="bg-zinc-900 rounded-t-3xl w-full max-w-md p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
            <h2 className="text-white text-xl font-bold">Incomplete Sets</h2>
            <p className="text-zinc-400 text-sm">The following exercises have uncompleted sets:</p>
            <ul className="space-y-1">
              {entries
                .filter((entry) => (setsMap[entry.id] ?? []).some((s) => !s.completed))
                .map((entry) => {
                  const sets = setsMap[entry.id] ?? [];
                  const incomplete = sets.filter((s) => !s.completed).length;
                  const total = sets.length;
                  return (
                    <li key={entry.id} className="flex items-center justify-between text-sm">
                      <span className="text-white">{entry.exercise?.name}</span>
                      <span className="text-red-400 font-semibold">
                        {total - incomplete}/{total} done
                      </span>
                    </li>
                  );
                })}
            </ul>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowIncompleteWarning(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-semibold active:bg-zinc-700"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => { setShowIncompleteWarning(false); setShowSummary(true); }}
                className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-semibold active:bg-amber-700"
              >
                Finish Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
