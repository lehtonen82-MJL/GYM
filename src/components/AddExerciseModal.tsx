"use client";

import { useEffect, useState } from "react";
import { getExerciseListForSwap, getOrCreateExerciseFromLibrary } from "@/lib/actions";

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "DB",
  cable: "Cable",
  machine_plate: "Machine",
  machine_stack: "Machine",
  smith: "Smith",
  bodyweight: "BW",
  kettlebell: "KB",
  trap_bar: "Trap Bar",
  band: "Band",
  suspension: "TRX",
  cardio_machine: "Cardio",
  other: "Other",
};

const MUSCLE_LABELS: Record<string, string> = {
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

type ExerciseItem = {
  id: string;
  name: string;
  equipment_type?: string;
  primary_muscle?: string;
  is_bodyweight?: boolean;
  source: "user" | "library";
};

type Props = {
  onAdd: (exerciseId: string, exerciseName: string) => void;
  onClose: () => void;
};

export default function AddExerciseModal({ onAdd, onClose }: Props) {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    getExerciseListForSwap().then((list) => {
      setExercises(list);
      setLoading(false);
    });
  }, []);

  async function handleAdd(ex: ExerciseItem) {
    if (adding) return;
    setAdding(ex.id);
    try {
      if (ex.source === "library") {
        const userExerciseId = await getOrCreateExerciseFromLibrary(ex.id, ex.name);
        if (userExerciseId) onAdd(userExerciseId, ex.name);
      } else {
        onAdd(ex.id, ex.name);
      }
    } finally {
      setAdding(null);
    }
  }

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="bg-zinc-900 rounded-t-3xl w-full max-w-md flex flex-col max-h-[85vh] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-white text-lg font-bold">Add Exercise</h2>
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

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5">
          {loading ? (
            <p className="text-zinc-500 text-sm py-4 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4 text-center">No exercises found</p>
          ) : (
            <div className="space-y-1 pb-2">
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => void handleAdd(ex)}
                  disabled={adding === ex.id}
                  className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm active:bg-zinc-700 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{ex.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ex.equipment_type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                          {EQUIPMENT_LABELS[ex.equipment_type] ?? ex.equipment_type}
                        </span>
                      )}
                      {ex.primary_muscle && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300">
                          {MUSCLE_LABELS[ex.primary_muscle] ?? ex.primary_muscle}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
