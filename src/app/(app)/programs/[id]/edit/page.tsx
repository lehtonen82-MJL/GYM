"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProgramDayCard } from "@/components/ProgramDayCard";
import { ProgramExerciseRow } from "@/components/ProgramExerciseRow";
import { DuplicateProgramModal } from "@/components/DuplicateProgramModal";
import { parseProgram, parseSchemeText } from "@/lib/programParser";
import {
  getProgramById,
  getProgramDays,
  getProgramExercises,
  createProgramDay,
  updateProgramDay,
  deleteProgramDay,
  reorderProgramDays,
  createProgramExercise,
  updateProgramExercise,
  deleteProgramExercise,
  reorderProgramExercises,
  updateProgram,
  duplicateProgram,
} from "@/lib/actions";
import type { Program, ProgramDay, ProgramExercise } from "@/lib/types";
import type { ParsedDay, ParserWarning } from "@/lib/programParser";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProgramEditorPage({ params }: PageProps) {
  const router = useRouter();
  const { id: programId } = use(params);

  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [exercisesByDay, setExercisesByDay] = useState<Record<string, ProgramExercise[]>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoBuilding, setIsAutoBuilding] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    detectedMode: "weekday" | "session";
    days: ParsedDay[];
    warnings: ParserWarning[];
  } | null>(null);

  // Load program and days
  useEffect(() => {
    async function load() {
      try {
        const prog = await getProgramById(programId);
        if (!prog) throw new Error("Program not found");
        setProgram(prog);

        const programDays = await getProgramDays(programId);
        setDays(programDays);

        // Load exercises for each day
        const exByDay: Record<string, ProgramExercise[]> = {};
        for (const day of programDays) {
          const exercises = await getProgramExercises(day.id);
          exByDay[day.id] = exercises;
        }
        setExercisesByDay(exByDay);

        // Expand first day
        if (programDays.length > 0) {
          setExpandedDays(new Set([programDays[0].id]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load program");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [programId]);

  // Helper to set error with auto-dismiss
  const setErrorWithTimeout = useCallback((msg: string) => {
    setError(msg);
    if (errorTimeout) clearTimeout(errorTimeout);
    const timeout = setTimeout(() => setError(""), 5000);
    setErrorTimeout(timeout);
  }, [errorTimeout]);

  const toggleDay = (dayId: string) => {
    const next = new Set(expandedDays);
    if (next.has(dayId)) {
      next.delete(dayId);
    } else {
      next.add(dayId);
    }
    setExpandedDays(next);
  };

  const handleAddDay = async () => {
    if (!program) return;
    try {
      const newDay = await createProgramDay(
        programId,
        `Day ${days.length + 1}`,
        days.length
      );
      setDays([...days, newDay]);
      setExercisesByDay({ ...exercisesByDay, [newDay.id]: [] });
      setExpandedDays(new Set([...expandedDays, newDay.id]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add day");
    }
  };

  const handleRenameDay = async (dayId: string, newName: string) => {
    try {
      await updateProgramDay(dayId, { name: newName });
      setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name: newName } : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename day");
    }
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm("Delete this day and all its exercises?")) return;
    try {
      await deleteProgramDay(dayId);
      setDays((prev) => prev.filter((d) => d.id !== dayId));
      const { [dayId]: removedDayExercises, ...rest } = exercisesByDay;
      void removedDayExercises;
      setExercisesByDay(rest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete day");
    }
  };

  const handleMoveDayUp = async (dayId: string) => {
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx <= 0) return;

    const reordered = [...days];
    [reordered[idx], reordered[idx - 1]] = [reordered[idx - 1], reordered[idx]];

    setDays(reordered);

    try {
      await reorderProgramDays(
        programId,
        reordered.map((d, i) => ({ id: d.id, day_order: i }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder days");
      // Revert on error
      setDays(days);
    }
  };

  const handleMoveDayDown = async (dayId: string) => {
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx >= days.length - 1) return;

    const reordered = [...days];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];

    setDays(reordered);

    try {
      await reorderProgramDays(
        programId,
        reordered.map((d, i) => ({ id: d.id, day_order: i }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder days");
      setDays(days);
    }
  };

  // ── Exercise operations ──

  const handleAddExercise = async (dayId: string) => {
    if (!program) return;
    try {
      const newEx = await createProgramExercise(dayId, programId, "New Exercise");
      setExercisesByDay((prev) => ({
        ...prev,
        [dayId]: [...(prev[dayId] || []), newEx],
      }));
      setEditingExercise(newEx.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add exercise");
    }
  };

  const handleSaveExercise = async (dayId: string, exerciseId: string, updates: Partial<ProgramExercise>) => {
    try {
      await updateProgramExercise(exerciseId, updates);
      setExercisesByDay((prev) => ({
        ...prev,
        [dayId]: prev[dayId].map((ex) =>
          ex.id === exerciseId ? { ...ex, ...updates } : ex
        ),
      }));
      setEditingExercise(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save exercise");
    }
  };

  const handleDeleteExercise = async (dayId: string, exerciseId: string) => {
    if (!confirm("Delete this exercise?")) return;
    try {
      await deleteProgramExercise(exerciseId);
      setExercisesByDay((prev) => ({
        ...prev,
        [dayId]: prev[dayId].filter((ex) => ex.id !== exerciseId),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exercise");
    }
  };

  const handleMoveExerciseUp = async (dayId: string, exerciseId: string) => {
    const exList = exercisesByDay[dayId];
    const idx = exList.findIndex((e) => e.id === exerciseId);
    if (idx <= 0) return;

    const reordered = [...exList];
    [reordered[idx], reordered[idx - 1]] = [reordered[idx - 1], reordered[idx]];

    setExercisesByDay((prev) => ({ ...prev, [dayId]: reordered }));

    try {
      await reorderProgramExercises(
        dayId,
        reordered.map((e, i) => ({ id: e.id, sort_order: i }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder exercises");
      setExercisesByDay((prev) => ({ ...prev, [dayId]: exList }));
    }
  };

  const handleMoveExerciseDown = async (dayId: string, exerciseId: string) => {
    const exList = exercisesByDay[dayId];
    const idx = exList.findIndex((e) => e.id === exerciseId);
    if (idx >= exList.length - 1) return;

    const reordered = [...exList];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];

    setExercisesByDay((prev) => ({ ...prev, [dayId]: reordered }));

    try {
      await reorderProgramExercises(
        dayId,
        reordered.map((e, i) => ({ id: e.id, sort_order: i }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder exercises");
      setExercisesByDay((prev) => ({ ...prev, [dayId]: exList }));
    }
  };

  // ── Duplicate program ──

  const handleDuplicate = async (newName: string) => {
    if (!program) return;
    setIsSaving(true);
    try {
      const dup = await duplicateProgram(programId, newName);
      setShowDuplicateModal(false);
      router.push(`/programs/${dup.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate program");
      setIsSaving(false);
    }
  };

  const parseProgramFromDescription = useCallback(() => {
    if (!program) return;

    const sourceText = (program.description || "").trim();
    if (!sourceText) {
      setErrorWithTimeout("No program text found in description.");
      return null;
    }

    const parsed = parseProgram(sourceText);
    if (parsed.days.length === 0) {
      setErrorWithTimeout(
        parsed.warnings[0]?.message ||
          "Could not parse days from description text."
      );
      return null;
    }
    return parsed;
  }, [program, setErrorWithTimeout]);

  const applyParsedProgram = useCallback(async (
    parsed: { detectedMode: "weekday" | "session"; days: ParsedDay[]; warnings: ParserWarning[] },
    strategy: "replace" | "append"
  ) => {
    if (!program) {
      setErrorWithTimeout("Program not loaded yet. Try again.");
      return;
    }

    setIsAutoBuilding(true);
    setError("");

    const sanitizedDays = parsed.days
      .map((day, dayIdx) => ({
        ...day,
        name: day.name.trim() || `Workout ${dayIdx + 1}`,
        exercises: day.exercises
          .map((ex) => ({
            ...ex,
            name: ex.name.trim(),
          }))
          .filter((ex) => ex.name.length > 0),
      }))
      .filter((day) => day.exercises.length > 0);

    if (sanitizedDays.length === 0) {
      setErrorWithTimeout("Add at least one exercise before saving.");
      setIsAutoBuilding(false);
      return;
    }

    try {
      let baseDays = days;
      let baseExercisesByDay = exercisesByDay;
      let startOrder = days.length;

      if (strategy === "replace") {
        for (const day of days) {
          await deleteProgramDay(day.id);
        }
        baseDays = [];
        baseExercisesByDay = {};
        startOrder = 0;
      }

      const newDays: ProgramDay[] = [...baseDays];
      const newExercisesByDay: Record<string, ProgramExercise[]> = {
        ...baseExercisesByDay,
      };

      for (let dayIdx = 0; dayIdx < sanitizedDays.length; dayIdx++) {
        const parsedDay = sanitizedDays[dayIdx];
        const createdDay = await createProgramDay(
          programId,
          parsedDay.name,
          startOrder + dayIdx,
          parsed.detectedMode === "weekday" ? (parsedDay.label || parsedDay.name) : undefined,
          parsed.detectedMode === "session" ? `Workout ${dayIdx + 1}` : undefined
        );

        newDays.push(createdDay);
        newExercisesByDay[createdDay.id] = [];

        for (const ex of parsedDay.exercises) {
          const createdEx = await createProgramExercise(
            createdDay.id,
            programId,
            ex.name,
            ex.schemeText,
            ex.targetSets,
            ex.targetRepsText,
            ex.notes
          );
          newExercisesByDay[createdDay.id].push(createdEx);
        }
      }

      if (program.mode !== parsed.detectedMode) {
        const updatedProgram = await updateProgram(programId, {
          mode: parsed.detectedMode,
        });
        setProgram(updatedProgram);
      }

      setDays(newDays);
      setExercisesByDay(newExercisesByDay);
      setExpandedDays(new Set(newDays[0] ? [newDays[0].id] : []));
      setEditingExercise(null);
      setParsedPreview(null);

      if (parsed.warnings.length > 0) {
        setErrorWithTimeout(
          `Imported with ${parsed.warnings.length} warning(s). Check exercise details.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-build failed");
    } finally {
      setIsAutoBuilding(false);
    }
  }, [days, exercisesByDay, program, programId, setErrorWithTimeout]);

  const handlePreviewFromText = () => {
    const parsed = parseProgramFromDescription();
    if (!parsed) return;
    setParsedPreview({
      detectedMode: parsed.detectedMode,
      days: parsed.days,
      warnings: parsed.warnings,
    });
  };

  const handleApplyParsed = async (strategy: "replace" | "append") => {
    const parsed = parsedPreview ?? parseProgramFromDescription();
    if (!parsed) return;
    await applyParsedProgram(
      {
        detectedMode: parsed.detectedMode,
        days: parsed.days,
        warnings: parsed.warnings,
      },
      strategy
    );
  };

  const handlePreviewDayNameChange = (dayIndex: number, nextName: string) => {
    setParsedPreview((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((d, idx) =>
        idx === dayIndex ? { ...d, name: nextName } : d
      );
      return { ...prev, days: nextDays };
    });
  };

  const handlePreviewExerciseChange = (
    dayIndex: number,
    exerciseIndex: number,
    field: "name" | "schemeText" | "notes",
    value: string
  ) => {
    setParsedPreview((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day;
        const nextExercises = day.exercises.map((ex, eIdx) => {
          if (eIdx !== exerciseIndex) return ex;
          const updated = { ...ex, [field]: value };
          if (field === "schemeText") {
            const scheme = parseSchemeText(value);
            updated.targetSets = scheme.targetSets;
            updated.targetRepsText = scheme.targetRepsText;
          }
          return updated;
        });
        return { ...day, exercises: nextExercises };
      });
      return { ...prev, days: nextDays };
    });
  };

  const handlePreviewAddExercise = (dayIndex: number) => {
    setParsedPreview((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((day, idx) =>
        idx === dayIndex
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  name: "",
                  schemeText: "",
                  targetSets: undefined,
                  targetRepsText: undefined,
                  notes: "",
                },
              ],
            }
          : day
      );
      return { ...prev, days: nextDays };
    });
  };

  const handlePreviewRemoveExercise = (dayIndex: number, exerciseIndex: number) => {
    setParsedPreview((prev) => {
      if (!prev) return prev;
      const nextDays = prev.days.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return {
          ...day,
          exercises: day.exercises.filter((_, exIdx) => exIdx !== exerciseIndex),
        };
      });
      return { ...prev, days: nextDays };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted">Loading program...</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-lg rounded-lg border border-red-500/60 bg-red-500/10 p-4 text-red-300">
          <p className="font-semibold">{error || "Program not found"}</p>
          <button
            onClick={() => router.push("/programs")}
            className="mt-3 text-sm underline"
          >
            Back to programs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/programs")}
            className="text-2xl text-muted hover:text-white"
          >
            {"<"}
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{program.name}</h1>
            <p className="mt-1 text-xs text-muted">
              {program.mode === "weekday" ? "Weekday Mode" : "Sessions Mode"}
              {program.description && ` - ${program.description}`}
            </p>
          </div>
          <button
            onClick={() => setShowDuplicateModal(true)}
            className="text-lg text-muted hover:text-white"
            title="Duplicate"
          >
            Duplicate
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {error && (
          <div className="mb-4 rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Add Day Button */}
        {program.description?.trim() && (
          <>
            <button
              onClick={handlePreviewFromText}
              disabled={isAutoBuilding}
              className="mb-3 w-full rounded-lg bg-emerald-500 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-zinc-600"
            >
              {isAutoBuilding ? "Saving..." : "Preview Auto-generate From Text"}
            </button>

            {parsedPreview && (
              <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
                <p className="mb-2 text-xs text-emerald-200">
                  Nothing is changed yet. Press Save to apply these generated workouts.
                </p>
                <p className="text-sm font-semibold text-emerald-100">
                  Parse Preview: {parsedPreview.days.length} day(s),{" "}
                  {parsedPreview.days.reduce((sum, d) => sum + d.exercises.length, 0)} exercise(s)
                </p>
                <p className="mt-1 text-xs text-emerald-200">
                  Mode: {parsedPreview.detectedMode === "weekday" ? "Weekday" : "Session"}
                  {parsedPreview.warnings.length > 0
                    ? ` - ${parsedPreview.warnings.length} warning(s)`
                    : " - no warnings"}
                </p>
                <div className="mt-3 space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {parsedPreview.days.map((day, dayIndex) => (
                    <div
                      key={`${day.name}-${dayIndex}`}
                      className="rounded border border-emerald-500/50 bg-zinc-900 p-3"
                    >
                      <div className="mb-2">
                        <label className="mb-1 block text-xs font-medium text-emerald-200">
                          Workout {dayIndex + 1} name
                        </label>
                        <input
                          value={day.name}
                          onChange={(e) => handlePreviewDayNameChange(dayIndex, e.target.value)}
                          className="w-full rounded border border-emerald-500/50 bg-zinc-950 px-2 py-1 text-sm text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        {day.exercises.map((exercise, exerciseIndex) => (
                          <div
                            key={`${dayIndex}-${exerciseIndex}`}
                            className="rounded border border-border bg-card p-2"
                          >
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                              <input
                                value={exercise.name}
                                onChange={(e) =>
                                  handlePreviewExerciseChange(
                                    dayIndex,
                                    exerciseIndex,
                                    "name",
                                    e.target.value
                                  )
                                }
                                placeholder="Exercise name"
                                className="rounded border border-border bg-zinc-950 px-2 py-1 text-sm text-white"
                              />
                              <input
                                value={exercise.schemeText || ""}
                                onChange={(e) =>
                                  handlePreviewExerciseChange(
                                    dayIndex,
                                    exerciseIndex,
                                    "schemeText",
                                    e.target.value
                                  )
                                }
                                placeholder="Scheme (e.g. 4x6)"
                                className="rounded border border-border bg-zinc-950 px-2 py-1 text-sm text-white"
                              />
                              <input
                                value={exercise.targetSets?.toString() || ""}
                                readOnly
                                placeholder="Sets"
                                className="rounded border border-border bg-zinc-800 px-2 py-1 text-sm text-white"
                              />
                              <button
                                onClick={() =>
                                  handlePreviewRemoveExercise(dayIndex, exerciseIndex)
                                }
                                className="rounded bg-red-500/20 px-2 py-1 text-sm font-medium text-red-300 hover:bg-red-500/30"
                              >
                                Remove
                              </button>
                            </div>
                            <input
                              value={exercise.notes || ""}
                              onChange={(e) =>
                                handlePreviewExerciseChange(
                                  dayIndex,
                                  exerciseIndex,
                                  "notes",
                                  e.target.value
                                )
                              }
                              placeholder="Notes (optional)"
                              className="mt-2 w-full rounded border border-border bg-zinc-950 px-2 py-1 text-sm text-white"
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handlePreviewAddExercise(dayIndex)}
                        className="mt-2 rounded bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
                      >
                        + Add movement
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void handleApplyParsed("replace")}
                    disabled={isAutoBuilding}
                    className="flex-1 rounded bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-zinc-600"
                  >
                    Save and Continue
                  </button>
                  <button
                    onClick={() => void handleApplyParsed("append")}
                    disabled={isAutoBuilding}
                    className="flex-1 rounded bg-accent py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-zinc-600"
                  >
                    Save and Append
                  </button>
                  <button
                    onClick={() => setParsedPreview(null)}
                    disabled={isAutoBuilding}
                    className="rounded border border-border bg-zinc-700 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:bg-zinc-700/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={handleAddDay}
          className="mb-6 w-full rounded-lg bg-accent py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent-hover"
        >
          + Add Day
        </button>

        {/* Days */}
        {days.length === 0 ? (
          <div className="text-center py-12">
            <p className="mb-4 text-lg text-muted">No days yet</p>
            <p className="text-sm text-muted">Click &quot;Add Day&quot; above to get started!</p>
          </div>
        ) : (
          days.map((day, idx) => (
            <ProgramDayCard
              key={day.id}
              day={day}
              isExpanded={expandedDays.has(day.id)}
              onToggle={() => toggleDay(day.id)}
              onRename={(newName) => handleRenameDay(day.id, newName)}
              onMoveUp={() => handleMoveDayUp(day.id)}
              onMoveDown={() => handleMoveDayDown(day.id)}
              onDelete={() => handleDeleteDay(day.id)}
              canMoveUp={idx > 0}
              canMoveDown={idx < days.length - 1}
            >
              {/* Exercises for this day */}
              <div className="space-y-2">
                {(exercisesByDay[day.id] || []).map((exercise, exIdx) => (
                  <div key={exercise.id}>
                    {editingExercise === exercise.id ? (
                      <ProgramExerciseRow
                        exercise={exercise}
                        isEditing={true}
                        onSave={(updates) => handleSaveExercise(day.id, exercise.id, updates)}
                        onCancel={() => setEditingExercise(null)}
                      />
                    ) : (
                      <div
                        onClick={() => setEditingExercise(exercise.id)}
                        className="cursor-pointer"
                      >
                        <ProgramExerciseRow
                          exercise={exercise}
                          onMoveUp={() => handleMoveExerciseUp(day.id, exercise.id)}
                          onMoveDown={() => handleMoveExerciseDown(day.id, exercise.id)}
                          onDelete={() => handleDeleteExercise(day.id, exercise.id)}
                          canMoveUp={exIdx > 0}
                          canMoveDown={exIdx < (exercisesByDay[day.id]?.length || 0) - 1}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Exercise Button */}
                <button
                  onClick={() => handleAddExercise(day.id)}
                  className="mt-2 w-full rounded border border-border bg-zinc-700 py-2 text-sm font-medium text-white hover:bg-zinc-600 active:bg-zinc-500"
                >
                  + Add Exercise
                </button>
              </div>
            </ProgramDayCard>
          ))
        )}
      </div>

      {/* Duplicate Modal */}
      <DuplicateProgramModal
        currentName={program.name}
        isOpen={showDuplicateModal}
        isLoading={isSaving}
        onSubmit={handleDuplicate}
        onCancel={() => setShowDuplicateModal(false)}
      />
    </div>
  );
}

