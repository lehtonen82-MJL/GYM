import {
  getLatestUnfinishedWorkout,
  getTodayWorkoutDay,
  getWorkoutDaysForProgram,
} from "@/lib/actions";
import Link from "next/link";
import StartWorkoutButton from "./StartWorkoutButton";
import ManualWorkoutSelector from "./ManualWorkoutSelector";

export default async function TodayPage() {
  const [unfinishedWorkout, todayDay, allDays] = await Promise.all([
    getLatestUnfinishedWorkout(),
    getTodayWorkoutDay(),
    getWorkoutDaysForProgram(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Today</h1>
        <p className="text-muted text-sm mt-1">{formatDate(new Date())}</p>
      </div>

      {unfinishedWorkout && (
        <div className="bg-card rounded-2xl border border-accent/40 p-5 space-y-4">
          <div>
            <p className="text-accent text-sm font-semibold">Unfinished workout</p>
            <h2 className="text-xl font-bold text-white">
              {unfinishedWorkout.workout_day?.name ?? "Workout in progress"}
            </h2>
            <p className="text-muted text-sm mt-1">
              Started {formatStartedAt(unfinishedWorkout.started_at)}
            </p>
          </div>
          <Link
            href={`/workout/${unfinishedWorkout.id}`}
            className="block w-full py-4 rounded-xl bg-accent text-white font-bold text-lg text-center active:bg-accent-hover"
          >
            Resume Workout
          </Link>
        </div>
      )}

      {todayDay ? (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div>
            <p className="text-muted text-sm">Today&apos;s slot</p>
            <h2 className="text-xl font-bold text-white">{todayDay.name}</h2>
          </div>
          <StartWorkoutButton workoutDayId={todayDay.id} />
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-muted text-center">Rest day</p>
        </div>
      )}

      {allDays.length > 0 ? (
        <ManualWorkoutSelector days={allDays} />
      ) : (
        <div className="bg-card rounded-2xl border border-border p-5 text-center">
          <p className="text-muted text-sm">No workout slots found yet.</p>
          <Link
            href="/programs"
            className="inline-block mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Open Programs
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Program Slots</h2>
        <div className="grid grid-cols-2 gap-3">
          {allDays.map((day, index) => {
            const isToday = day.day_of_week === new Date().getDay();
            return (
              <div
                key={day.id}
                className={`bg-card rounded-xl border p-3 ${
                  isToday ? "border-accent bg-accent/5" : "border-border"
                }`}
              >
                <p className="text-muted text-xs">Workout {index + 1}</p>
                <p className="text-white font-medium">{day.name}</p>
                {isToday && <p className="text-xs text-accent mt-1">Today</p>}
                <StartWorkoutButton workoutDayId={day.id} small />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
