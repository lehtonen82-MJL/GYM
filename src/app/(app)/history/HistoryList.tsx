"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteWorkoutFromHistory } from "@/lib/actions";
import type { Workout } from "@/lib/types";
import ImportWorkoutModal from "./ImportWorkoutModal";

export default function HistoryList({ workouts }: { workouts: Workout[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const handleDeleteConfirmed = async (workoutId: string) => {
    try {
      setDeletingId(workoutId);
      setConfirmId(null);
      await deleteWorkoutFromHistory(workoutId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete workout. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Import button */}
      <button
        type="button"
        onClick={() => setShowImport(true)}
        className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-accent font-semibold text-sm active:bg-zinc-800"
      >
        + Import Past Workouts
      </button>

      {showImport && (
        <ImportWorkoutModal onClose={() => setShowImport(false)} />
      )}

      {workouts.map((w) => (
        <div key={w.id} className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/workout/${w.id}`} className="min-w-0 flex-1 active:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold">
                  {w.workout_day?.name === "Imported" && w.notes?.startsWith("[Import]")
                    ? w.notes.replace(/^\[Import\]\s*/, "") || "Imported"
                    : (w.workout_day?.name ?? w.import_session_name ?? "Workout")}
                </p>
                {((!w.workout_day && w.import_session_name !== undefined) ||
                  w.notes?.startsWith("[Import]")) && (
                  <span className="text-xs bg-zinc-700 text-zinc-300 rounded px-1.5 py-0.5">Imported</span>
                )}
              </div>
              <p className="text-muted text-sm">{w.workout_day?.day_label}</p>
              <p className="text-white text-sm mt-2">{formatDate(w.started_at)}</p>
              <p className="text-muted text-xs">{formatDuration(w.started_at, w.completed_at)}</p>
              {w.notes && !w.notes.startsWith("[Import]") && <p className="text-muted text-sm mt-2 line-clamp-1">{w.notes}</p>}
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              {confirmId === w.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-medium text-white active:bg-zinc-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteConfirmed(w.id)}
                    disabled={deletingId === w.id}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white active:bg-red-700 disabled:bg-zinc-600"
                  >
                    {deletingId === w.id ? "Deleting…" : "Confirm"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(w.id)}
                  disabled={deletingId === w.id}
                  className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-red-400 active:bg-zinc-700 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
