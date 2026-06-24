"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  saveTooHeavySets,
  swapWorkoutExercise,
  updateProgramExerciseDefault,
  getPreviousResults,
  addExerciseToWorkout,
  saveWorkoutAsTemplate,
} from "@/lib/actions";
import AddExerciseModal from "@/components/AddExerciseModal";
import BonusCardioCapture, {
  createEmptyBonusCardio,
  hasBonusCardioData,
  type BonusCardioDraft,
} from "./BonusCardioCapture";

type SetMap = Record<string, SetEntry[]>;
type DraftSetPatch = Pick<SetEntry, "id" | "weight_kg" | "reps" | "completed" | "is_warmup" | "too_heavy" | "too_heavy_reps" | "set_number" | "workout_exercise_entry_id" | "user_id">;
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
  tooHeavyFlags: Record<string, { setNumber: number; achievedReps: number | null }[]>;
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

    const serverIds = new Set(sets.map((s) => s.id));
    const draftById = new Map(draftSets.map((set) => [set.id, set]));

    // Patch existing server sets with draft values
    const merged = sets.map((set) => {
      const patch = draftById.get(set.id);
      if (!patch) return { ...set };
      return {
        ...set,
        weight_kg: patch.weight_kg,
        reps: patch.reps,
        completed: patch.completed,
        is_warmup: patch.is_warmup ?? set.is_warmup,
        too_heavy: patch.too_heavy ?? set.too_heavy,
        too_heavy_reps: patch.too_heavy_reps ?? set.too_heavy_reps,
      };
    });

    // Append sets from draft that don't exist on server (added during workout)
    for (const draftSet of draftSets) {
      if (!serverIds.has(draftSet.id) && draftSet.workout_exercise_entry_id && draftSet.user_id) {
        merged.push({
          id: draftSet.id,
          workout_exercise_entry_id: draftSet.workout_exercise_entry_id,
          user_id: draftSet.user_id,
          set_number: draftSet.set_number ?? merged.length + 1,
          weight_kg: draftSet.weight_kg,
          reps: draftSet.reps,
          completed: draftSet.completed,
          is_warmup: draftSet.is_warmup ?? false,
          too_heavy: draftSet.too_heavy ?? false,
          too_heavy_reps: draftSet.too_heavy_reps ?? null,
          created_at: new Date().toISOString(),
        });
      }
    }

    next[entryId] = merged;
  }

  return next;
}

export default function WorkoutClient({
  workout,
  entries: initialEntries,
  suggestions,
  tooHeavyFlags,
  readOnly = false,
  bonusCardio = null,
}: Props) {
  // Mutable copy of entries that updates on exercise swaps
  const [entries, setEntries] = useState<WorkoutExerciseEntry[]>(initialEntries);

  const [setsMap, setSetsMap] = useState<SetMap>(() => {
    const map: SetMap = {};
    for (const entry of initialEntries) {
      map[entry.id] = (entry.set_entries ?? []).map((s) => ({ ...s }));
    }
    return map;
  });

  // Track which set IDs existed in DB when this workout was loaded.
  // Stored in a ref so addExercise can append without triggering re-renders.
  const originalSetIdsRef = useRef<string[]>(
    initialEntries.flatMap((e) => (e.set_entries ?? []).map((s) => s.id))
  );
  // Keep a plain variable alias for the existing handleFinish references
  const originalSetIds = originalSetIdsRef.current;

  const [showAddExercise, setShowAddExercise] = useState(false);

  // State for the "Update program?" dialog shown after a mid-workout swap
  const [updateProgramDialog, setUpdateProgramDialog] = useState<{
    entryId: string;
    oldExerciseName: string;
    newExerciseName: string;
    newExerciseId: string;
    programExerciseId: string | null;
  } | null>(null);

  const [activeEntryId, setActiveEntryId] = useState<string | null>(entries[0]?.id ?? null);
  const [notes, setNotes] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
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
            too_heavy: set.too_heavy ?? false,
            too_heavy_reps: set.too_heavy_reps ?? null,
            set_number: set.set_number,
            workout_exercise_entry_id: set.workout_exercise_entry_id,
            user_id: set.user_id,
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

  function handleTooHeavySetsChange(entryId: string, setIds: string[], value: boolean, achievedReps?: number | null) {
    // Update local state — mark completed and set achieved reps when flagging as too heavy
    setSetsMap((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).map((s) => {
        if (!setIds.includes(s.id)) return s;
        if (value) {
          return {
            ...s,
            too_heavy: true,
            too_heavy_reps: achievedReps ?? null,
            completed: true,
            // Show achieved reps in the input (if provided), otherwise keep existing
            reps: achievedReps != null ? achievedReps : s.reps,
          };
        } else {
          return { ...s, too_heavy: false, too_heavy_reps: null };
        }
      }),
    }));
    // Persist to DB
    saveTooHeavySets(setIds, value, achievedReps).catch(() => {
      // Revert on failure
      setSetsMap((prev) => ({
        ...prev,
        [entryId]: (prev[entryId] ?? []).map((s) =>
          setIds.includes(s.id) ? { ...s, too_heavy: !value, too_heavy_reps: null } : s
        ),
      }));
    });
  }

  async function handleSwapExercise(entryId: string, newExerciseId: string, newExerciseName: string) {
    try {
      await swapWorkoutExercise(entryId, newExerciseId);
    } catch (err) {
      alert(`Swap failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // Update entry in state: swap exercise_id, set original_exercise
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const original = e.original_exercise ?? e.exercise;
        return {
          ...e,
          exercise_id: newExerciseId,
          exercise: { ...e.exercise!, id: newExerciseId, name: newExerciseName },
          original_exercise_id: original?.id ?? e.exercise_id,
          original_exercise: original,
        };
      })
    );

    // Fetch history for the new exercise and rebuild sets
    const prevResults = await getPreviousResults(newExerciseId);
    setSetsMap((prev) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return prev;
      const targetSets = entry.workout_day_exercise?.target_sets ?? (prev[entryId] ?? []).length;
      const newSets: SetEntry[] = Array.from({ length: targetSets }, (_, i) => ({
        id: crypto.randomUUID(),
        workout_exercise_entry_id: entryId,
        user_id: entry.user_id,
        set_number: i + 1,
        weight_kg: prevResults[i]?.weight_kg ?? null,
        reps: prevResults[i]?.reps ?? null,
        completed: false,
        is_warmup: false,
        too_heavy: false,
        too_heavy_reps: null,
        created_at: new Date().toISOString(),
      }));
      return { ...prev, [entryId]: newSets };
    });

    // Prompt to update the program if this entry is linked to one
    const entry = entries.find((e) => e.id === entryId);
    const programExerciseId = entry?.workout_day_exercise_id ?? null;
    const oldExerciseName = entry?.exercise?.name ?? "Previous exercise";
    setUpdateProgramDialog({
      entryId,
      oldExerciseName,
      newExerciseName,
      newExerciseId,
      programExerciseId,
    });
  }

  async function handleAddExercise(exerciseId: string, exerciseName: string) {
    setShowAddExercise(false);
    const newEntry = await addExerciseToWorkout(workout.id, exerciseId);
    if (!newEntry) return;

    setEntries((prev) => [...prev, newEntry]);
    setSetsMap((prev) => ({
      ...prev,
      [newEntry.id]: newEntry.set_entries ?? [],
    }));
    // New sets are already persisted server-side; track their IDs so syncWorkoutSets
    // will update (not re-insert) them on finish.
    const newSetIds = (newEntry.set_entries ?? []).map((s) => s.id);
    originalSetIdsRef.current = [...originalSetIdsRef.current, ...newSetIds];
    setActiveEntryId(newEntry.id);
  }

  function handleFinishClick() {
    const hasIncomplete = entries.some((entry) => {
      const sets = setsMap[entry.id] ?? [];
      return sets.some((s) => {
        // Skip empty/unused sets (added but never filled in)
        if (s.weight_kg === null && s.reps === null && !s.completed) return false;
        // A set with data is considered incomplete only if not checked off
        return !s.completed;
      });
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
          too_heavy: s.too_heavy ?? false,
          too_heavy_reps: s.too_heavy_reps ?? null,
        })),
      }));

      try {
        await syncWorkoutSets(entriesData, originalSetIds);
      } catch (syncError) {
        // Show the error but keep localStorage intact so no data is lost
        const msg = syncError instanceof Error ? syncError.message : String(syncError);
        alert(`Could not save all sets to server — your workout data is preserved locally.\n\nDetails: ${msg}\n\nPlease make sure the database migration has been applied (add is_warmup column) and try again.`);
        return;
      }

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

      // Offer to save as a reusable template for freestyle or mixed workouts
      const isFreestyle = workout.workout_day_id == null;
      if (isFreestyle) {
        const defaultName = workout.import_session_name && workout.import_session_name !== "Freestyle workout"
          ? workout.import_session_name
          : `Workout ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        setTemplateName(defaultName);
        setShowSaveTemplate(true);
        return;
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
          const setsWithData = sets.filter((s) => s.weight_kg || s.reps || s.completed);
          const entryIsBodyweight = setsWithData.every((s) => !s.weight_kg);
          return (
            <div key={entry.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-white">{entry.exercise?.name}</h3>
                {entry.original_exercise && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 leading-tight">
                    ↩ {entry.original_exercise.name}
                  </span>
                )}
              </div>
              {setsWithData.length === 0 ? (
                <p className="text-muted text-sm">No set data recorded</p>
              ) : (
                <div className="space-y-1">
                  {setsWithData.map((s) => {
                    const reps = s.reps ?? entry.workout_day_exercise?.target_reps ?? 0;
                    return (
                      <div key={s.id} className={`flex justify-between text-sm ${s.too_heavy ? "bg-red-950/30 border border-red-800/40 rounded-lg px-2 py-0.5" : ""}`}>
                        <span className="text-muted">
                          {s.is_warmup ? "Warmup" : `Set ${s.set_number}`}
                        </span>
                        <span className={`font-mono ${s.too_heavy ? "text-red-400" : "text-white"}`}>
                          {entryIsBodyweight
                            ? `× ${reps} reps`
                            : `${s.weight_kg ?? 0}kg × ${reps}`}
                          {s.too_heavy && (
                            <span className="ml-1" title="Too heavy">
                              ⚠{s.too_heavy_reps != null ? ` ${s.too_heavy_reps}/${reps}` : ""}
                            </span>
                          )}
                          {s.completed && <span className="text-success ml-2">✓</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
      <>
      <div className="space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSummary(false)}
            className="p-2 -ml-2 rounded-lg text-muted active:bg-zinc-800"
            aria-label="Back to workout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Workout Summary</h1>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-lg font-semibold text-white">{workout.workout_day?.name}</h2>

          {entries.map((entry) => {
            const allSets = (setsMap[entry.id] ?? []).filter((s) => s.weight_kg || s.reps || s.completed);
            if (allSets.length === 0) return null;
            const summaryIsBodyweight = allSets.every((s) => !s.weight_kg);
            const topSet = summaryIsBodyweight
              ? allSets.reduce((max, s) => ((s.reps ?? 0) > (max.reps ?? 0) ? s : max))
              : allSets.reduce((max, s) => ((s.weight_kg ?? 0) > (max.weight_kg ?? 0) ? s : max));
            const topReps = topSet.reps ?? entry.workout_day_exercise?.target_reps ?? 0;
            return (
              <div
                key={entry.id}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <span className="text-white">{entry.exercise?.name}</span>
                <span className="text-muted font-mono">
                  {summaryIsBodyweight
                    ? `× ${topReps} reps`
                    : `${topSet.weight_kg}kg × ${topReps}`}
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

      {/* Save as reusable workout prompt */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
          <div className="bg-zinc-900 rounded-t-3xl w-full max-w-md p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
            <h2 className="text-white text-lg font-bold">Save as workout?</h2>
            <p className="text-zinc-400 text-sm">
              Give this workout a name so you can start it again from Today.
            </p>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Workout name"
              className="w-full px-4 py-3 rounded-xl bg-zinc-800 text-white border border-zinc-700 focus:border-blue-500 focus:outline-none text-base"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowSaveTemplate(false); router.push("/today"); }}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-semibold text-sm active:bg-zinc-700"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (templateName.trim()) {
                    await saveWorkoutAsTemplate(workout.id, templateName.trim());
                  }
                  setShowSaveTemplate(false);
                  router.push("/today");
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      </>
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

      {workout.is_deload && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-400 text-sm font-medium">
          🔄 Recovery Week — lighter loads, fewer sets
        </div>
      )}

      {entries.map((entry) => (
        <ExerciseCard
          key={entry.id}
          entry={entry}
          sets={setsMap[entry.id] ?? []}
          onSetsChange={(sets) => handleSetsChange(entry.id, sets)}
          suggestedWeight={suggestions[entry.exercise_id] ?? null}
          isActive={activeEntryId === entry.id}
          onToggle={() => setActiveEntryId((prev) => (prev === entry.id ? null : entry.id))}
          tooHeavyLastSets={tooHeavyFlags[entry.exercise_id] ?? []}
          onTooHeavySetsChange={(setIds, value, achievedReps) => handleTooHeavySetsChange(entry.id, setIds, value, achievedReps)}
          programExerciseId={entry.workout_day_exercise_id ?? null}
          originalExerciseName={entry.original_exercise?.name ?? null}
          onSwapExercise={(newId, newName) => void handleSwapExercise(entry.id, newId, newName)}
        />
      ))}

      <button
        type="button"
        onClick={() => setShowAddExercise(true)}
        className="w-full py-3 rounded-xl bg-zinc-800 text-white font-semibold text-sm border border-zinc-700 active:bg-zinc-700"
      >
        + Add exercise
      </button>

      <button
        onClick={handleFinishClick}
        className="w-full py-4 rounded-xl bg-success text-white font-bold text-lg active:opacity-80"
      >
        Finish Workout
      </button>

      {showAddExercise && (
        <AddExerciseModal
          onAdd={(id, name) => void handleAddExercise(id, name)}
          onClose={() => setShowAddExercise(false)}
        />
      )}

      {/* Update Program dialog — shown after a mid-workout swap */}
      {updateProgramDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
          <div className="bg-zinc-900 rounded-t-3xl w-full max-w-md p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
            <h2 className="text-white text-lg font-bold">Update Program?</h2>
            <p className="text-zinc-400 text-sm">
              You swapped <span className="text-white font-semibold">{updateProgramDialog.oldExerciseName}</span>{" "}
              → <span className="text-white font-semibold">{updateProgramDialog.newExerciseName}</span>.
              Should this change be permanent in your program?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUpdateProgramDialog(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-semibold text-sm active:bg-zinc-700"
              >
                Just this time
              </button>
              {updateProgramDialog.programExerciseId && (
                <button
                  type="button"
                  onClick={() => {
                    if (!updateProgramDialog.programExerciseId) return;
                    void updateProgramExerciseDefault(
                      updateProgramDialog.programExerciseId,
                      updateProgramDialog.newExerciseId
                    );
                    setUpdateProgramDialog(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
                >
                  Update Program
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
