// Calendar weeks and days in the viewer's local time: Monday-first weeks, the week streak.
// Dates are built from calendar parts (year, month, day), so DST changes don't shift them.

const pad = (n: number) => String(n).padStart(2, "0");

/** The local calendar day of a date or ISO timestamp, as "YYYY-MM-DD". */
export function localDay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Monday 00:00 of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

/**
 * Consecutive Monday–Sunday weeks with at least one workout, counting back from this week. A current
 * week without a workout yet doesn't break the streak; it starts from last week instead.
 */
export function weekStreak(startedAts: string[], now: Date): number {
  const weeks = new Set(startedAts.map((iso) => mondayOf(new Date(iso)).getTime()));
  const thisMonday = mondayOf(now);
  let streak = 0;
  for (let back = weeks.has(thisMonday.getTime()) ? 0 : 1; ; back++) {
    const monday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 * back);
    if (!weeks.has(monday.getTime())) return streak;
    streak++;
  }
}

/** The days of a month ("YYYY-MM-DD") in Monday-first weeks, padded with null. `month` is 0-based. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
