"use client";

type WeightStepperProps = {
  value: number | null;
  onChange: (value: number) => void;
  step?: number;
};

export default function WeightStepper({
  value,
  onChange,
  step = 2.5,
}: WeightStepperProps) {
  const current = value ?? 0;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, current - step))}
        className="w-11 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-lg font-bold active:bg-zinc-700 flex items-center justify-center"
      >
        −{step}
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={current || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder="kg"
        className="w-20 h-11 text-center text-lg font-semibold bg-zinc-800 rounded-xl text-white border border-zinc-700 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(current + step)}
        className="w-11 h-11 rounded-xl bg-zinc-800 text-zinc-300 text-lg font-bold active:bg-zinc-700 flex items-center justify-center"
      >
        +{step}
      </button>
    </div>
  );
}
