"use client";

import { useState } from "react";
import type { ProgramExercise } from "@/lib/types";

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
  const [scheme, setScheme] = useState(exercise.scheme_text || "");
  const [sets, setSets] = useState(exercise.target_sets?.toString() || "");
  const [reps, setReps] = useState(exercise.target_reps_text || "");
  const [notes, setNotes] = useState(exercise.notes || "");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave?.({
      exercise_name_snapshot: name.trim(),
      scheme_text: scheme.trim() || undefined,
      target_sets: sets ? parseInt(sets) : undefined,
      target_reps_text: reps.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  if (isEditing) {
    return (
      <div className="border border-gray-300 rounded-lg p-3 mb-2 bg-blue-50">
        {/* Name */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-700">Exercise Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Back Squat"
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
          />
        </div>

        {/* Scheme */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-700">Scheme (optional)</label>
          <input
            type="text"
            value={scheme}
            onChange={(e) => setScheme(e.target.value)}
            placeholder="e.g., 4x2, 1x5 + 2x5"
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
          />
        </div>

        {/* Sets */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-700">Target Sets (optional)</label>
          <input
            type="number"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            placeholder="e.g., 3"
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
          />
        </div>

        {/* Reps */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-700">Target Reps Text (optional)</label>
          <input
            type="text"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="e.g., 5, 5,5,5, 8-10"
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
          />
        </div>

        {/* Notes */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-700">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., top set + backoff"
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-500 text-white text-sm font-medium py-2 rounded hover:bg-blue-600 active:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-500 text-white text-sm font-medium py-2 rounded hover:bg-gray-600 active:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-2 bg-white flex items-stretch gap-2 group">
      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="font-semibold text-sm text-gray-900">{exercise.exercise_name_snapshot}</h4>
        <div className="flex gap-3 text-xs text-gray-600 mt-1">
          {exercise.target_sets && <span>{exercise.target_sets} sets</span>}
          {exercise.scheme_text && <span>{exercise.scheme_text}</span>}
          {exercise.target_reps_text && <span>{exercise.target_reps_text} reps</span>}
          {exercise.notes && <span className="italic">{exercise.notes}</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 flex-shrink-0 items-center">
        {canMoveUp && (
          <button
            onClick={onMoveUp}
            className="w-10 h-10 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="Move up"
            aria-label="Move exercise up"
          >
            ↑
          </button>
        )}
        {canMoveDown && (
          <button
            onClick={onMoveDown}
            className="w-10 h-10 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="Move down"
            aria-label="Move exercise down"
          >
            ↓
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="w-10 h-10 flex items-center justify-center rounded text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
            title="Delete exercise"
            aria-label="Delete exercise"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
