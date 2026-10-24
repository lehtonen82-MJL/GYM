"use client";

import { useSettings } from "@/lib/settings";
import { fromDisplay, toDisplay, weightStep } from "@/lib/format";

type WeightStepperProps = {
  /** Weight in kg (canonical); shown and edited in the user's unit. */
  value: number | null;
  /** Called with the new weight in kg. */
  onChange: (value: number) => void;
  /** Step in the display unit; defaults to 2.5 kg / 5 lb. */
  step?: number;
};

export default function WeightStepper({
  value,
  onChange,
  step,
}: WeightStepperProps) {
  const { unit } = useSettings();
  const stepSize = step ?? weightStep(unit);
  const current = value === null ? 0 : toDisplay(value, unit);
  const commit = (display: number) => onChange(fromDisplay(display, unit));

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => commit(Math.max(0, current - stepSize))}
        className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold active:bg-zinc-700 flex items-center justify-center shrink-0"
      >
        −{stepSize}
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={current || ""}
        onChange={(e) => commit(parseFloat(e.target.value) || 0)}
        placeholder={unit}
        aria-label={`Weight (${unit})`}
        className="w-16 h-10 text-center text-base font-semibold bg-zinc-800 rounded-xl text-white border border-zinc-700 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => commit(current + stepSize)}
        className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold active:bg-zinc-700 flex items-center justify-center shrink-0"
      >
        +{stepSize}
      </button>
    </div>
  );
}
