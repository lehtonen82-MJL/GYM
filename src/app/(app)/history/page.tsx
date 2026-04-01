import { getWorkoutHistory } from "@/lib/actions";
import Link from "next/link";

export default async function HistoryPage() {
  const workouts = await getWorkoutHistory();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">History</h1>

      {workouts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-muted text-center">No workouts yet. Start one from Today!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <Link
              key={w.id}
              href={`/workout/${w.id}`}
              className="block bg-card rounded-2xl border border-border p-4 active:bg-card-hover transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">
                    {w.workout_day?.name ?? "Workout"}
                  </p>
                  <p className="text-muted text-sm">
                    {w.workout_day?.day_label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">
                    {formatDate(w.started_at)}
                  </p>
                  <p className="text-muted text-xs">
                    {formatDuration(w.started_at, w.completed_at)}
                  </p>
                </div>
              </div>
              {w.notes && (
                <p className="text-muted text-sm mt-2 line-clamp-1">
                  {w.notes}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
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
