// Weekly sets per muscle (see GLOSSARY.md), grouped in the viewer's local time.

import { mondayOf } from "@/lib/calendar";
import { exerciseSummary, type RuleSet } from "@/lib/setRules";

/** Display names of the library's primary muscles. */
export const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest",
  back_lats: "Lats",
  back_upper: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

/** One exercise entry of a finished workout. */
export type MuscleEntry = {
  started_at: string;
  /** The library definition's primary muscle; null when the exercise isn't linked */
  primary_muscle: string | null;
  sets: RuleSet[];
};

export type MuscleWeeks = {
  /** Local Monday 00:00 of each week shown, oldest first, as ISO strings */
  weekStarts: string[];
  /** Muscles with any sets in the weeks shown: most sets this week first, unlinked (null) last */
  muscles: { muscle: string | null; weeklySets: number[]; kgThisWeek: number }[];
};

/** Completed work sets per primary muscle for the `weeks` weeks up to and including the current one. */
export function weeklyMuscleSets(entries: MuscleEntry[], now: Date, weeks = 8): MuscleWeeks {
  const current = mondayOf(now);
  const starts = Array.from(
    { length: weeks },
    (_, i) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (weeks - 1 - i))
  );
  const startTimes = starts.map((d) => d.getTime());

  const byMuscle = new Map<string | null, { weeklySets: number[]; kgThisWeek: number }>();
  for (const entry of entries) {
    const week = startTimes.indexOf(mondayOf(new Date(entry.started_at)).getTime());
    if (week === -1) continue;
    const { workSets, volume } = exerciseSummary(entry.sets);
    if (workSets === 0) continue;
    const row = byMuscle.get(entry.primary_muscle) ?? { weeklySets: Array(weeks).fill(0), kgThisWeek: 0 };
    row.weeklySets[week] += workSets;
    if (week === weeks - 1) row.kgThisWeek += volume;
    byMuscle.set(entry.primary_muscle, row);
  }

  const muscles = [...byMuscle.entries()]
    .map(([muscle, row]) => ({ muscle, ...row }))
    .sort((a, b) =>
      a.muscle === null ? 1 : b.muscle === null ? -1 : b.weeklySets[weeks - 1] - a.weeklySets[weeks - 1]
    );
  return { weekStarts: starts.map((d) => d.toISOString()), muscles };
}
