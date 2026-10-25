"use client";

import { useMemo, useState } from "react";
import type { ProgramExercise, ProgramExerciseAlternative } from "@/lib/types";
import { parseSchemePrescription } from "@/lib/programParser";
import {
  getExerciseAlternatives,
  getExerciseList,
  addProgramExerciseAlternative,
  removeProgramExerciseAlternative,
} from "@/lib/actions";

interface ProgramExerciseRowProps {
  exercise: ProgramExercise;
  isEditing?: boolean;
  onSave?: (updates: Partial<ProgramExercise>) => void;
  onCancel?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

type DraftSet = {
  id: string;
  weight: string;
  reps: string;
};

function buildInitialSets(exercise: ProgramExercise): DraftSet[] {
  const fromScheme = parseSchemePrescription(exercise.scheme_text || "");
  if (fromScheme.length > 0) {
    return fromScheme.map((set, idx) => ({
      id: `set-${idx}`,
      weight: set.weightKg?.toString() || "",
      reps: set.reps?.toString() || "",
    }));
  }

  const setCount = exercise.target_sets ?? 0;
  if (setCount > 0) {
    const repsParts = (exercise.target_reps_text || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    return Array.from({ length: setCount }, (_, idx) => ({
      id: `set-${idx}`,
      weight: "",
      reps: repsParts[idx] || repsParts[0] || "",
    }));
  }

  return [{ id: "set-0", weight: "", reps: "" }];
}

function formatTargetRepsText(reps: number[]): string | undefined {
  if (reps.length === 0) return undefined;
  const unique = new Set(reps);
  if (unique.size === 1) return String(reps[0]);
  return reps.join(",");
}

export function ProgramExerciseRow({
  exercise,
  isEditing = false,
  onSave,
  onCancel,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
}: ProgramExerciseRowProps) {
  const [name, setName] = useState(exercise.exercise_name_snapshot);
  const [notes, setNotes] = useState(exercise.notes || "");
  const [setRows, setSetRows] = useState<DraftSet[]>(() => buildInitialSets(exercise));
  const [formError, setFormError] = useState("");

  // Alternatives panel state (view mode)
  const [showAlts, setShowAlts] = useState(false);
  const [alternatives, setAlternatives] = useState<ProgramExerciseAlternative[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [showAddAlt, setShowAddAlt] = useState(false);
  const [altSearch, setAltSearch] = useState("");
  const [allExercises, setAllExercises] = useState<{ id: string; name: string }[]>([]);

  const previewScheme = useMemo(() => {
    return setRows
      .filter((row) => row.weight.trim() && row.reps.trim())
      .map((row) => `${row.weight.trim()}x${row.reps.trim()}`)
      .join(", ");
  }, [setRows]);

  const handleAddSet = () => {
    setSetRows((prev) => [
      ...prev,
      { id: `set-${Date.now()}-${prev.length}`, weight: "", reps: "" },
    ]);
  };

  const handleRemoveSet = (setId: string) => {
    setSetRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== setId);
    });
  };

  const handleSetChange = (setId: string, key: "weight" | "reps", value: string) => {
    setSetRows((prev) =>
      prev.map((row) => (row.id === setId ? { ...row, [key]: value } : row))
    );
  };

  const handleSave = () => {
    setFormError("");

    if (!name.trim()) {
      setFormError("Exercise name is required.");
      return;
    }

    if (setRows.length === 0) {
      setFormError("Add at least one set.");
      return;
    }

    const parsedSets = setRows.map((row) => {
      const weight = parseFloat(row.weight);
      const reps = parseInt(row.reps, 10);
      return {
        weight,
        reps,
        validWeight: Number.isFinite(weight),
        validReps: Number.isFinite(reps) && reps > 0,
      };
    });

    const invalidIndex = parsedSets.findIndex((s) => !s.validWeight || !s.validReps);
    if (invalidIndex >= 0) {
      setFormError(`Set ${invalidIndex + 1}: weight and reps are required.`);
      return;
    }

    const weights = parsedSets.map((s) => s.weight);
    const reps = parsedSets.map((s) => s.reps);
    const schemeText = weights.map((w, idx) => `${w}x${reps[idx]}`).join(", ");

    onSave?.({
      exercise_name_snapshot: name.trim(),
      scheme_text: schemeText,
      target_sets: parsedSets.length,
      target_reps_text: formatTargetRepsText(reps),
      notes: notes.trim() || undefined,
    });
  };

  if (isEditing) {
    return (
      <div className="mb-2 rounded-lg border border-accent/60 bg-card p-3">
        {formError && (
          <div className="mb-3 rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-xs text-red-300">
            {formError}
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs font-medium text-muted">Exercise Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Back Squat"
            className="mt-1 w-full rounded border border-border bg-deep px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-muted">Sets (Weight + Reps) *</label>
          <button
            onClick={handleAddSet}
            className="rounded bg-accent/20 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/30"
          >
            + Add Set
          </button>
        </div>

        <div className="mb-3 space-y-2">
          {setRows.map((row, idx) => (
            <div key={row.id} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-2 text-xs text-muted">Set {idx + 1}</div>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={row.weight}
                onChange={(e) => handleSetChange(row.id, "weight", e.target.value)}
                placeholder="kg"
                className="col-span-4 rounded border border-border bg-deep px-2 py-2 text-sm font-medium text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={row.reps}
                onChange={(e) => handleSetChange(row.id, "reps", e.target.value)}
                placeholder="reps"
                className="col-span-4 rounded border border-border bg-deep px-2 py-2 text-sm font-medium text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={() => handleRemoveSet(row.id)}
                className="col-span-2 rounded bg-red-500/20 px-2 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30"
                disabled={setRows.length <= 1}
                title="Remove set"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mb-3 rounded border border-border bg-card px-2 py-2">
          <p className="text-[11px] text-muted">Generated Scheme</p>
          <p className="mt-1 text-xs font-medium text-white">
            {previewScheme || "Add weight + reps to build scheme"}
          </p>
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-muted">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., top set + backoff"
            className="mt-1 w-full rounded border border-border bg-deep px-2 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded bg-accent py-2 text-sm font-medium text-on-accent hover:bg-accent-hover active:bg-accent-hover"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded border border-border bg-surface-hover py-2 text-sm font-medium text-white hover:bg-surface-strong active:bg-surface-strong"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group mb-2 rounded-lg border border-border bg-card">
      <div className="flex items-stretch gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">{exercise.exercise_name_snapshot}</h4>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
            {exercise.target_sets && <span>{exercise.target_sets} sets</span>}
            {exercise.scheme_text && <span>{exercise.scheme_text}</span>}
            {exercise.notes && <span className="italic">{exercise.notes}</span>}
          </div>
          {/* Alternatives toggle */}
          <button
            type="button"
            onClick={async () => {
              if (!showAlts) {
                setLoadingAlts(true);
                const [alts, exList] = await Promise.all([
                  getExerciseAlternatives(exercise.id),
                  allExercises.length === 0 ? getExerciseList() : Promise.resolve(allExercises),
                ]);
                setAlternatives(alts);
                setAllExercises(exList);
                setLoadingAlts(false);
              }
              setShowAlts((v) => !v);
            }}
            className="mt-2 text-xs text-accent active:text-accent"
          >
            {showAlts ? "▲ Hide alternatives" : "▼ Alternatives"}
            {alternatives.length > 0 && !showAlts && (
              <span className="ml-1 text-muted">({alternatives.length})</span>
            )}
          </button>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className="h-10 w-10 rounded text-muted transition-colors hover:bg-surface hover:text-white active:bg-surface-hover"
              title="Move up"
              aria-label="Move exercise up"
            >
              ^
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className="h-10 w-10 rounded text-muted transition-colors hover:bg-surface hover:text-white active:bg-surface-hover"
              title="Move down"
              aria-label="Move exercise down"
            >
              v
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 w-10 rounded text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 active:bg-red-500/20"
              title="Delete exercise"
              aria-label="Delete exercise"
            >
              x
            </button>
          )}
        </div>
      </div>

      {/* Alternatives panel */}
      {showAlts && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {loadingAlts ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : (
            <>
              {alternatives.length === 0 && !showAddAlt && (
                <p className="text-xs text-muted">No saved alternatives yet.</p>
              )}
              {alternatives.map((alt) => (
                <div key={alt.exercise_id} className="flex items-center justify-between">
                  <span className="text-xs text-white">{alt.exercise?.name ?? "Unknown"}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await removeProgramExerciseAlternative(exercise.id, alt.exercise_id);
                      setAlternatives((prev) => prev.filter((a) => a.exercise_id !== alt.exercise_id));
                    }}
                    className="text-xs text-red-400 active:text-red-300 ml-2"
                  >
                    × remove
                  </button>
                </div>
              ))}
              {showAddAlt ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={altSearch}
                    onChange={(e) => setAltSearch(e.target.value)}
                    placeholder="Search exercises…"
                    className="w-full px-2 py-1.5 rounded-lg bg-surface text-white text-xs border border-border-strong focus:border-accent focus:outline-none"
                    autoFocus
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allExercises
                      .filter(
                        (ex) =>
                          ex.id !== exercise.exercise_id &&
                          !alternatives.some((a) => a.exercise_id === ex.id) &&
                          ex.name.toLowerCase().includes(altSearch.toLowerCase())
                      )
                      .slice(0, 20)
                      .map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={async () => {
                            await addProgramExerciseAlternative(exercise.id, ex.id);
                            const updated = await getExerciseAlternatives(exercise.id);
                            setAlternatives(updated);
                            setAltSearch("");
                            setShowAddAlt(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg bg-surface text-xs text-white active:bg-surface-hover"
                        >
                          {ex.name}
                        </button>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowAddAlt(false); setAltSearch(""); }}
                    className="text-xs text-muted active:text-soft"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddAlt(true)}
                  className="text-xs text-accent active:text-accent"
                >
                  + Add alternative
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
