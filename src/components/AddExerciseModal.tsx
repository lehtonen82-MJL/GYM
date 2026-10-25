"use client";

import { useEffect, useRef, useState } from "react";
import { getExerciseListForSwap, getOrCreateExerciseFromLibrary, createCustomExercise } from "@/lib/actions";
import { MUSCLE_LABELS } from "@/lib/muscleVolume";

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
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getExerciseListForSwap().then((list) => {
      setExercises(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (showCustom) {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [showCustom]);

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

  async function handleAddCustom() {
    const name = customName.trim();
    if (!name || creatingCustom) return;
    setCreatingCustom(true);
    try {
      const id = await createCustomExercise(name);
      if (id) onAdd(id, name);
    } finally {
      setCreatingCustom(false);
    }
  }

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  // When search has text and no exact match exists, suggest adding custom
  const searchTrimmed = search.trim();
  const exactMatch = exercises.some(
    (ex) => ex.name.toLowerCase() === searchTrimmed.toLowerCase()
  );
  const showAddCustomPrompt = searchTrimmed.length > 1 && !exactMatch && !loading;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
      <div className="bg-card rounded-t-3xl w-full max-w-md flex flex-col max-h-[85vh] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-white text-lg font-bold">Add Exercise</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted active:text-white text-sm font-medium"
          >
            Cancel
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowCustom(false); }}
            placeholder="Search exercises…"
            className="w-full px-4 py-2.5 rounded-xl bg-surface text-white border border-border-strong focus:border-accent focus:outline-none text-sm"
            autoFocus
          />
        </div>

        {/* Custom exercise inline form */}
        {showCustom && (
          <div className="px-5 pb-3 shrink-0 space-y-2">
            <input
              ref={customInputRef}
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAddCustom(); if (e.key === "Escape") setShowCustom(false); }}
              placeholder="Exercise name…"
              className="w-full px-4 py-2.5 rounded-xl bg-surface text-white border border-border-strong focus:border-accent focus:outline-none text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleAddCustom()}
                disabled={!customName.trim() || creatingCustom}
                className="flex-1 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-sm active:bg-accent-hover disabled:opacity-50"
              >
                {creatingCustom ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="px-4 py-2.5 rounded-xl bg-surface text-muted text-sm active:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5">
          {loading ? (
            <p className="text-muted text-sm py-4 text-center">Loading…</p>
          ) : (
            <div className="space-y-1 pb-2">
              {/* "Add as custom" prompt when no match found */}
              {showAddCustomPrompt && !showCustom && (
                <button
                  type="button"
                  onClick={() => { setCustomName(searchTrimmed); setShowCustom(true); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-surface border border-dashed border-border-strong text-sm active:bg-surface-hover"
                >
                  <span className="text-muted">Add </span>
                  <span className="text-white font-medium">&ldquo;{searchTrimmed}&rdquo;</span>
                  <span className="text-muted"> as custom exercise</span>
                </button>
              )}

              {/* Blank custom entry button when not searching */}
              {!showCustom && !searchTrimmed && (
                <button
                  type="button"
                  onClick={() => { setCustomName(""); setShowCustom(true); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-surface border border-dashed border-border-strong text-muted text-sm active:bg-surface-hover"
                >
                  + Custom exercise (no library match)
                </button>
              )}

              {filtered.length === 0 && !showAddCustomPrompt ? (
                <p className="text-muted text-sm py-4 text-center">No exercises found</p>
              ) : (
                filtered.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => void handleAdd(ex)}
                    disabled={adding === ex.id}
                    className="w-full text-left px-4 py-3 rounded-xl bg-surface text-white text-sm active:bg-surface-hover disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{ex.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {ex.equipment_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-soft">
                            {EQUIPMENT_LABELS[ex.equipment_type] ?? ex.equipment_type}
                          </span>
                        )}
                        {ex.primary_muscle && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/60 text-accent">
                            {MUSCLE_LABELS[ex.primary_muscle] ?? ex.primary_muscle}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
