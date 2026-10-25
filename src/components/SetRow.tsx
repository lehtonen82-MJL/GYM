"use client";

import { useState } from "react";
import WeightStepper from "./WeightStepper";

const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

type SetRowProps = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  targetReps: number;
  completed: boolean;
  isWarmup?: boolean;
  isTooHeavy?: boolean;
  wasTooHeavyLastTime?: boolean;
  tooHeavyLastAchievedReps?: number | null;
  tooHeavyTargetReps?: number;
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
  /** Rate of perceived exertion; offered on completed work sets when onRpeChange is given */
  rpe?: number | null;
  onRpeChange?: (rpe: number | null) => void;
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
  tooHeavyLastAchievedReps = null,
  tooHeavyTargetReps,
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
  rpe = null,
  onRpeChange,
}: SetRowProps) {
  const [rpeOpen, setRpeOpen] = useState(false);
  const canRate = !!onRpeChange && completed && !isWarmup && !isEditMode;
  const bg = isTooHeavy
    ? "bg-red-950/40 border border-red-700/50"
    : wasTooHeavyLastTime
    ? "bg-red-950/20 border border-dashed border-red-800/40"
    : isWarmup
    ? "bg-yellow-950/30 border border-yellow-800/40"
    : completed
    ? "bg-accent/30 border border-accent/50"
    : "bg-card";

  return (
    <div className="space-y-0.5">
    <div className={`flex items-center gap-2 py-2 px-2 rounded-xl transition-colors ${bg}`}>
      {/* Edit mode: reorder arrows */}
      {isEditMode && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-6 h-5 flex items-center justify-center text-xs text-muted disabled:opacity-20 active:text-white"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-6 h-5 flex items-center justify-center text-xs text-muted disabled:opacity-20 active:text-white"
          >
            ▼
          </button>
        </div>
      )}

      <span className="text-muted text-sm font-medium w-4 shrink-0 text-center">
        {wasTooHeavyLastTime ? (
          <span className="text-red-500" title="Was too heavy last time">⚠</span>
        ) : (
          setNumber
        )}
      </span>

      <WeightStepper value={weightKg} onChange={onWeightChange} />

      <div className="flex items-center gap-1">
        <span className="text-subtle text-xs">×</span>
        <input
          type="number"
          inputMode="numeric"
          value={reps || ""}
          onChange={(e) => onRepsChange(parseInt(e.target.value) || 0)}
          placeholder={String(targetReps)}
          className="w-12 h-10 text-center text-base font-bold font-num bg-surface rounded-xl text-white border border-border-strong focus:border-accent focus:outline-none"
        />
      </div>

      {/* Normal mode: complete checkmark */}
      {!isEditMode && (
        <button
          type="button"
          onClick={onToggleComplete}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            completed
              ? "bg-accent text-on-accent"
              : "bg-surface text-muted active:bg-surface-hover"
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
                : "bg-surface border-border-strong text-muted"
            }`}
            title={isWarmup ? "Warm-up set (tap to make work set)" : "Work set (tap to make warm-up)"}
          >
            {isWarmup ? "W" : "S"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-lg bg-surface border border-border-strong text-red-400 text-base flex items-center justify-center active:bg-red-950/40"
          >
            ×
          </button>
        </div>
      )}
    </div>
    {/* Optional RPE for a completed work set */}
    {canRate && (
      <div className="pl-7">
        <button
          type="button"
          onClick={() => setRpeOpen((o) => !o)}
          aria-expanded={rpeOpen}
          className={`text-xs ${rpe != null ? "text-accent font-semibold" : "text-muted"}`}
        >
          {rpe != null ? `RPE ${rpe}` : "+ RPE"}
        </button>
        {rpeOpen && (
          <div className="flex flex-wrap gap-1 mt-1" role="group" aria-label="Rate of perceived exertion">
            {RPE_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={rpe === v}
                onClick={() => {
                  onRpeChange?.(rpe === v ? null : v);
                  setRpeOpen(false);
                }}
                className={`min-w-9 h-8 px-2 rounded-lg text-xs font-semibold border ${
                  rpe === v ? "bg-accent text-on-accent border-accent" : "bg-surface text-soft border-border-strong"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    {/* Last time too-heavy achieved reps hint */}
    {wasTooHeavyLastTime && tooHeavyTargetReps !== undefined && (
      <p className="text-xs text-red-400/80 pl-3">
        ⚠ Last time:{" "}
        {tooHeavyLastAchievedReps !== null
          ? `${tooHeavyLastAchievedReps}/${tooHeavyTargetReps} reps`
          : "too heavy"}
      </p>
    )}
    </div>
  );
}
