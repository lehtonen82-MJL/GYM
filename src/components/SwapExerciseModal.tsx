"use client";

import { useEffect, useState } from "react";
import {
  getExerciseAlternatives,
  getExerciseList,
} from "@/lib/actions";
import type { ProgramExerciseAlternative } from "@/lib/types";

type Props = {
  /** The program_exercises.id for this slot (null for unlinked/imported entries) */
  programExerciseId: string | null;
  /** The exercise_id currently used — excluded from the list */
  currentExerciseId: string;
  onSwap: (exerciseId: string, exerciseName: string) => void;
  onClose: () => void;
};

export default function SwapExerciseModal({
  programExerciseId,
  currentExerciseId,
  onSwap,
  onClose,
}: Props) {
  const [alternatives, setAlternatives] = useState<ProgramExerciseAlternative[]>([]);
  const [allExercises, setAllExercises] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [alts, all] = await Promise.all([
        programExerciseId ? getExerciseAlternatives(programExerciseId) : Promise.resolve([]),
        getExerciseList(),
      ]);
      setAlternatives(alts);
      setAllExercises(all);
      setLoading(false);
    }
    void load();
  }, [programExerciseId]);

  // Saved alternatives (excluding current exercise)
  const savedAlts = alternatives.filter((a) => a.exercise_id !== currentExerciseId);

  // Full library filtered by search, excluding current and already shown alternatives
  const altIds = new Set(savedAlts.map((a) => a.exercise_id));
  const filtered = allExercises.filter(
    (ex) =>
      ex.id !== currentExerciseId &&
      !altIds.has(ex.id) &&
      ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="bg-zinc-900 rounded-t-3xl w-full max-w-md flex flex-col max-h-[85vh] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-white text-lg font-bold">Swap Exercise</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 active:text-white text-sm font-medium"
          >
            Cancel
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 text-white border border-zinc-700 focus:border-blue-500 focus:outline-none text-sm"
            autoFocus
          />
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 px-5 space-y-4">
          {loading ? (
            <p className="text-zinc-500 text-sm py-4 text-center">Loading…</p>
          ) : (
            <>
              {/* Saved alternatives section */}
              {savedAlts.length > 0 && search === "" && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                    Saved alternatives
                  </p>
                  <div className="space-y-1">
                    {savedAlts.map((alt) => (
                      <button
                        key={alt.exercise_id}
                        type="button"
                        onClick={() =>
                          onSwap(alt.exercise_id, alt.exercise?.name ?? "Unknown")
                        }
                        className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800 border border-blue-500/30 text-white font-medium text-sm active:bg-zinc-700 flex items-center justify-between"
                      >
                        <span>{alt.exercise?.name ?? "Unknown"}</span>
                        <span className="text-blue-400 text-xs">⭐</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All exercises section */}
              <div>
                {savedAlts.length > 0 && search === "" && (
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                    All exercises
                  </p>
                )}
                {filtered.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-2 text-center">No exercises found</p>
                ) : (
                  <div className="space-y-1">
                    {filtered.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => onSwap(ex.id, ex.name)}
                        className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm active:bg-zinc-700"
                      >
                        {ex.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
