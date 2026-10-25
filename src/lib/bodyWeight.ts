// Body weight log summary (dates are local calendar days, "YYYY-MM-DD").

export type BodyWeight = { measured_on: string; weight_kg: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const round1 = (kg: number) => Math.round(kg * 10) / 10;

/**
 * Latest measurement, its change since the previous one, and since the measurement nearest to 30
 * days before it (only if one lies 23–37 days before; null otherwise).
 */
export function bodyWeightSummary(
  entries: BodyWeight[]
): { latest: BodyWeight; sincePrevious: number | null; since30Days: number | null } | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  let monthAgo: BodyWeight | null = null;
  for (const e of sorted) {
    const gap = Math.abs(daysBetween(e.measured_on, latest.measured_on) - 30);
    if (gap <= 7 && (!monthAgo || gap < Math.abs(daysBetween(monthAgo.measured_on, latest.measured_on) - 30))) {
      monthAgo = e;
    }
  }
  return {
    latest,
    sincePrevious: previous ? round1(latest.weight_kg - previous.weight_kg) : null,
    since30Days: monthAgo ? round1(latest.weight_kg - monthAgo.weight_kg) : null,
  };
}
