"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteWorkoutFromHistory } from "@/lib/actions";
import type { Workout } from "@/lib/types";

export default function HistoryList({ workouts }: { workouts: Workout[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (workoutId: string) => {
    const ok = confirm("Delete this workout from history? This cannot be undone.");
    if (!ok) return;

    try {
      setDeletingId(workoutId);
      await deleteWorkoutFromHistory(workoutId);
      router.refresh();
    } catch {
      alert("Failed to delete workout. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {workouts.map((w) => (
        <div key={w.id} className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/workout/${w.id}`} className="min-w-0 flex-1 active:opacity-80 transition-opacity">
              <p className="text-white font-semibold">{w.workout_day?.name ?? "Workout"}</p>
              <p className="text-muted text-sm">{w.workout_day?.day_label}</p>
              <p className="text-white text-sm mt-2">{formatDate(w.started_at)}</p>
              <p className="text-muted text-xs">{formatDuration(w.started_at, w.completed_at)}</p>
              {w.notes && <p className="text-muted text-sm mt-2 line-clamp-1">{w.notes}</p>}
            </Link>

            <button
              onClick={() => void handleDelete(w.id)}
              disabled={deletingId === w.id}
              className="rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:bg-zinc-600"
            >
              {deletingId === w.id ? "Deleting..." : "Delete"}
            </button>
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
