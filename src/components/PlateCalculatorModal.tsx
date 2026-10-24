"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { toDisplay, weightStep } from "@/lib/format";
import { BAR_OPTIONS, DEFAULT_PLATES, platesFor } from "@/lib/plates";

type Props = {
  /** Starting target in kg (e.g. the next set's weight); null = empty bar. */
  initialWeightKg: number | null;
  onClose: () => void;
};

/** Plates per side for a target weight (Phase 5.1). Works in the user's display unit. */
export default function PlateCalculatorModal({ initialWeightKg, onClose }: Props) {
  const { unit } = useSettings();
  const bars = BAR_OPTIONS[unit];
  const [bar, setBar] = useState(bars[0]);
  const [target, setTarget] = useState(() =>
    initialWeightKg ? Math.round(toDisplay(initialWeightKg, unit) * 100) / 100 : bars[0]
  );
  const step = weightStep(unit);
  const result = platesFor(target, bar, DEFAULT_PLATES[unit]);
  const maxPlate = DEFAULT_PLATES[unit][0];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Plate calculator"
        className="bg-zinc-900 rounded-t-3xl w-full max-w-md p-5 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-bold">Plate calculator</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 text-sm px-2 py-1">
            Close
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setTarget((t) => Math.max(0, t - step))}
            className="w-12 h-12 rounded-xl bg-zinc-800 text-zinc-300 font-bold active:bg-zinc-700"
          >
            −{step}
          </button>
          <input
            type="number"
            inputMode="decimal"
            value={target || ""}
            onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
            aria-label={`Target weight (${unit})`}
            className="w-24 h-12 text-center text-xl font-bold bg-zinc-800 rounded-xl text-white border border-zinc-700 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-zinc-400 text-sm">{unit}</span>
          <button
            type="button"
            onClick={() => setTarget((t) => t + step)}
            className="w-12 h-12 rounded-xl bg-zinc-800 text-zinc-300 font-bold active:bg-zinc-700"
          >
            +{step}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">Bar</span>
          {bars.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBar(b)}
              aria-pressed={bar === b}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                bar === b ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"
              }`}
            >
              {b} {unit}
            </button>
          ))}
        </div>

        <div className="bg-zinc-800/60 rounded-2xl p-4 space-y-3">
          <p className="text-zinc-400 text-xs uppercase tracking-wide">Each side</p>
          {result.perSide.length === 0 ? (
            <p className="text-white font-semibold">Empty bar</p>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap" aria-label="Plates per side">
              {result.perSide.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center justify-center rounded-md bg-zinc-200 text-zinc-900 text-xs font-bold px-1.5"
                  style={{ height: `${28 + 28 * (p / maxPlate)}px`, minWidth: "2.25rem" }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}
          <p className="text-zinc-400 text-sm">
            Loaded: <span className="text-white font-semibold">{result.loaded} {unit}</span>
            {result.remainder > 0 && (
              <span className="text-amber-400"> · {result.remainder} {unit} short — closest with these plates</span>
            )}
            {result.remainder < 0 && <span className="text-amber-400"> · lighter than the bar</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
