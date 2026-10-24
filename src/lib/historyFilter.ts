// Client-side history search (Phase 5.3).

export type SearchableWorkout = {
  started_at: string;
  title: string;
  exercise_names: string[];
  notes?: string | null;
};

/**
 * Workouts matching every word of `query` (case-insensitive) in the title, an exercise
 * name, the notes, or the date — as ISO "2026-10-24" or as shown, e.g. "Oct 24".
 */
export function filterWorkouts<T extends SearchableWorkout>(
  workouts: T[],
  query: string,
  formatDate: (iso: string) => string
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return workouts;
  return workouts.filter((w) => {
    const haystack = [
      w.title,
      ...w.exercise_names,
      w.notes ?? "",
      w.started_at.slice(0, 10),
      formatDate(w.started_at),
    ]
      .join(" \n ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** The selected ids that are still visible — selections hidden by the search are dropped. */
export function visibleSelection(selectedIds: Set<string>, visible: { id: string }[]): string[] {
  return visible.filter((w) => selectedIds.has(w.id)).map((w) => w.id);
}
