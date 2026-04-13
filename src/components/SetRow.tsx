"use client";

import WeightStepper from "./WeightStepper";

type SetRowProps = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  targetReps: number;
  completed: boolean;
  isWarmup?: boolean;
  isTooHeavy?: boolean;
  wasTooHeavyLastTime?: boolean;
  isEditMode?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onWeightChange: (weight: number) => void;
  onRepsChange: (reps: number) => void;
  onToggleComplete: () => void;
  onTypeToggle?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
};

export default function SetRow({
  setNumber,
  weightKg,
  reps,
  targetReps,
  completed,
  isWarmup = false,
  isTooHeavy = false,
  wasTooHeavyLastTime = false,
  isEditMode = false,
  isFirst = false,
  isLast = false,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
  onTypeToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SetRowProps) {
  const bg = isTooHeavy
    ? "bg-red-950/40 border border-red-700/50"
    : wasTooHeavyLastTime
    ? "bg-red-950/20 border border-dashed border-red-800/40"
    : isWarmup
    ? "bg-yellow-950/30 border border-yellow-800/40"
    : completed
    ? "bg-green-950/30 border border-green-900/50"
    : "bg-zinc-900";

  return (
    <div className={`flex items-center gap-2 py-2 px-2 rounded-xl transition-colors ${bg}`}>
      {/* Edit mode: reorder arrows */}
      {isEditMode && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-6 h-5 flex items-center justify-center text-xs text-zinc-400 disabled:opacity-20 active:text-white"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-6 h-5 flex items-center justify-center text-xs text-zinc-400 disabled:opacity-20 active:text-white"
          >
            ▼
          </button>
        </div>
      )}

      <span className="text-zinc-500 text-sm font-medium w-4 shrink-0 text-center">
        {wasTooHeavyLastTime ? (
          <span className="text-red-500" title="Was too heavy last time">⚠</span>
        ) : (
          setNumber
        )}
      </span>

      <WeightStepper value={weightKg} onChange={onWeightChange} />

      <div className="flex items-center gap-1">
        <span className="text-zinc-600 text-xs">×</span>
        <input
          type="number"
          inputMode="numeric"
          value={reps || ""}
          onChange={(e) => onRepsChange(parseInt(e.target.value) || 0)}
          placeholder={String(targetReps)}
          className="w-12 h-10 text-center text-base font-semibold bg-zinc-800 rounded-xl text-white border border-zinc-700 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Normal mode: complete checkmark */}
      {!isEditMode && (
        <button
          type="button"
          onClick={onToggleComplete}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            completed
              ? "bg-green-600 text-white"
              : "bg-zinc-800 text-zinc-500 active:bg-zinc-700"
          }`}
        >
          ✓
        </button>
      )}

      {/* Edit mode: W/S type toggle + delete */}
      {isEditMode && (
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            type="button"
            onClick={onTypeToggle}
            className={`h-8 px-2 rounded-lg text-xs font-bold border transition-colors ${
              isWarmup
                ? "bg-yellow-900/60 border-yellow-700 text-yellow-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-400"
            }`}
            title={isWarmup ? "Warm-up set (tap to make work set)" : "Work set (tap to make warm-up)"}
          >
            {isWarmup ? "W" : "S"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-red-400 text-base flex items-center justify-center active:bg-red-950/40"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
