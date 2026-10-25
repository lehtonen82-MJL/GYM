import {
  getLatestUnfinishedWorkout,
  getTodayWorkoutDay,
  getThisWeekFinishedDayIds,
  getWorkoutDaysForProgram,
  getWorkoutTemplates,
} from "@/lib/actions";
import Link from "next/link";
import { formatStartedAt, formatWeekdayDate } from "@/lib/format";
import { Suspense } from "react";
import StartWorkoutButton from "./StartWorkoutButton";
import StartBlankWorkoutButton from "./StartBlankWorkoutButton";
import EasyWeekButton from "./EasyWeekButton";
import ManualWorkoutSelector from "./ManualWorkoutSelector";
import ProgramSlotsGrid from "./ProgramSlotsGrid";
import MyWorkoutsSection from "./MyWorkoutsSection";

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Today</h1>
        <p className="text-muted text-sm mt-1">{formatWeekdayDate(new Date())}</p>
      </div>
      <Suspense fallback={<TodaySkeleton />}>
        <TodayContent />
      </Suspense>
    </div>
  );
}

async function TodayContent() {
  const [unfinishedWorkout, todayDay, allDays, finishedDayIds, templates] = await Promise.all([
    getLatestUnfinishedWorkout(),
    getTodayWorkoutDay(),
    getWorkoutDaysForProgram(),
    getThisWeekFinishedDayIds(),
    getWorkoutTemplates(),
  ]);

  const programId = allDays[0]?.program_id;

  return (
    <>
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
            className="block w-full py-4 rounded-xl bg-accent text-on-accent font-bold text-lg text-center active:bg-accent-hover"
          >
            Resume Workout
          </Link>
        </div>
      )}

      {programId && <EasyWeekButton programId={programId} />}

      {todayDay ? (
        <div className={`bg-card rounded-2xl border p-5 space-y-4 ${
          finishedDayIds.includes(todayDay.id)
            ? "border-accent/50 bg-accent/5"
            : "border-border"
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">Today&apos;s slot</p>
              <h2 className="text-xl font-bold text-white">{todayDay.name}</h2>
            </div>
            {finishedDayIds.includes(todayDay.id) && (
              <span className="text-sm text-accent font-semibold">✓ Done</span>
            )}
          </div>
          <StartWorkoutButton workoutDayId={todayDay.id} programId={programId} />
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
            className="inline-block mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent"
          >
            Open Programs
          </Link>
        </div>
      )}

      {programId && (
        <ProgramSlotsGrid
          allDays={allDays}
          serverFinishedIds={finishedDayIds}
          programId={programId}
        />
      )}

      {templates.length > 0 && <MyWorkoutsSection templates={templates} />}

      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div>
          <p className="text-muted text-sm">Freestyle</p>
          <h3 className="text-lg font-semibold text-white mt-0.5">Build your own</h3>
          <p className="text-muted text-xs mt-1">Start empty and add exercises as you go</p>
        </div>
        <StartBlankWorkoutButton />
      </div>
    </>
  );
}

function TodaySkeleton() {
  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-6 w-40 bg-white/10 rounded" />
        <div className="h-12 w-full bg-white/10 rounded-xl" />
      </div>
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3 animate-pulse">
        <div className="h-4 w-20 bg-white/10 rounded" />
        <div className="h-6 w-32 bg-white/10 rounded" />
        <div className="h-12 w-full bg-white/10 rounded-xl" />
      </div>
    </>
  );
}
