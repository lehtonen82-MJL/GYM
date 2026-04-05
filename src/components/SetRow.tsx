"use client";

import WeightStepper from "./WeightStepper";

type SetRowProps = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  targetReps: number;
  completed: boolean;
  onWeightChange: (weight: number) => void;
  onRepsChange: (reps: number) => void;
  onToggleComplete: () => void;
};

export default function SetRow({
  setNumber,
  weightKg,
  reps,
  targetReps,
  completed,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
}: SetRowProps) {
  return (
    <div
      className={`flex items-center gap-2 py-2 px-2 rounded-xl transition-colors ${
        completed ? "bg-green-950/30 border border-green-900/50" : "bg-zinc-900"
      }`}
    >
      <span className="text-zinc-500 text-sm font-medium w-4 shrink-0 text-center">
        {setNumber}
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
    </div>
  );
}
