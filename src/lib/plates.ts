// Plate calculator (Phase 5.1). Unit-agnostic: pass bar, target and plates in the same
// unit (kg or lb) — the UI works in the user's display unit.

import type { WeightUnit } from "@/lib/format";

export type PlateResult = {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: number[];
  /** Total weight actually loaded (bar + both sides). */
  loaded: number;
  /** target − loaded; > 0 when the target can't be hit exactly with these plates. */
  remainder: number;
};

export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export const BAR_OPTIONS: Record<WeightUnit, number[]> = {
  kg: [20, 15, 10],
  lb: [45, 35, 25],
};

/**
 * Plates per side to load `target` on a `bar`, using any number of each plate size.
 * Picks the heaviest load ≤ target, then the fewest plates for it — exact even for plate
 * sets where "heaviest plate first" fails (e.g. 30 per side with only 20 and 15 → 15 + 15).
 */
export function platesFor(target: number, bar: number, available: number[]): PlateResult {
  const SCALE = 100; // work in hundredths so 1.25 / 2.5 are integers
  const plates = [...new Set(available)].filter((p) => p > 0).map((p) => Math.round(p * SCALE));
  const perSideTarget = Math.floor(Math.max(0, Math.round((target - bar) * SCALE)) / 2);

  // Empty bar (a negative remainder means the target is lighter than the bar)
  if (plates.length === 0 || perSideTarget === 0) {
    return { perSide: [], loaded: bar, remainder: round2(target - bar) };
  }

  // minPlates[w] = fewest plates summing exactly to w (Infinity = unreachable)
  const minPlates = new Array<number>(perSideTarget + 1).fill(Infinity);
  const lastPlate = new Array<number>(perSideTarget + 1).fill(0);
  minPlates[0] = 0;
  for (let w = 1; w <= perSideTarget; w++) {
    for (const p of plates) {
      if (p <= w && minPlates[w - p] + 1 < minPlates[w]) {
        minPlates[w] = minPlates[w - p] + 1;
        lastPlate[w] = p;
      }
    }
  }

  let best = perSideTarget;
  while (best > 0 && minPlates[best] === Infinity) best--;

  const perSide: number[] = [];
  for (let w = best; w > 0; w -= lastPlate[w]) perSide.push(lastPlate[w] / SCALE);
  perSide.sort((a, b) => b - a);

  const loaded = round2(bar + (2 * best) / SCALE);
  return { perSide, loaded, remainder: round2(target - loaded) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
