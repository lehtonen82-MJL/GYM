"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProgramDayCard } from "@/components/ProgramDayCard";
import { ProgramExerciseRow } from "@/components/ProgramExerciseRow";
import { DuplicateProgramModal } from "@/components/DuplicateProgramModal";
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

interface PageProps {
  params: { id: string };
}

export default function ProgramEditorPage({ params }: PageProps) {
  const router = useRouter();
  const programId = params.id;

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
  const setErrorWithTimeout = (msg: string) => {
    setError(msg);
    if (errorTimeout) clearTimeout(errorTimeout);
    const timeout = setTimeout(() => setError(""), 5000);
    setErrorTimeout(timeout);
  };

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
      const { [dayId]: _, ...rest } = exercisesByDay;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading program...</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Program not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/programs")}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
            <p className="text-xs text-gray-600 mt-1">
              {program.mode === "weekday" ? "Weekday Mode" : "Sessions Mode"}
              {program.description && ` • ${program.description}`}
            </p>
          </div>
          <button
            onClick={() => setShowDuplicateModal(true)}
            className="text-gray-600 hover:text-gray-900 text-lg"
            title="Duplicate"
          >
            📋
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
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
        <button
          onClick={handleAddDay}
          className="w-full bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 active:bg-blue-700 mb-6 text-base transition-colors"
        >
          + Add Day
        </button>

        {/* Days */}
        {days.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">No days yet</p>
            <p className="text-gray-500 text-sm">Click "Add Day" above to get started!</p>
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
                  className="w-full bg-gray-200 text-gray-900 font-medium py-2 rounded hover:bg-gray-300 active:bg-gray-400 text-sm mt-2"
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
