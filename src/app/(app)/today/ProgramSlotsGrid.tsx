"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkoutDay } from "@/lib/types";
import StartWorkoutButton from "./StartWorkoutButton";

// ── localStorage helpers ──────────────────────────────────────────────────────
// Written by DeloadSetupModal when a compact (multi-day) Easy Week workout starts.

type CompactDoneStore = {
  weekStart: string; // ISO date string of Monday 00:00
  dayIds: string[];
};

function currentWeekStart(): string {
  const now = new Date();
  const dow = now.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const d = new Date(now);
  d.setDate(now.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function readCompactDoneIds(programId: string): string[] {
  try {
    const raw = localStorage.getItem(`week-compact-done-${programId}`);
    if (!raw) return [];
    const store = JSON.parse(raw) as CompactDoneStore;
    // Discard if it's from a previous week
    if (store.weekStart !== currentWeekStart()) return [];
    return store.dayIds;
  } catch {
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  allDays: WorkoutDay[];
  /** Day IDs with a completed_at this calendar week (from server). */
  serverFinishedIds: string[];
  programId: string;
};

export default function ProgramSlotsGrid({ allDays, serverFinishedIds, programId }: Props) {
  const [compactDoneIds, setCompactDoneIds] = useState<string[]>([]);

  useEffect(() => {
    setCompactDoneIds(readCompactDoneIds(programId));
  }, [programId]);

  const finishedSet = useMemo(
    () => new Set([...serverFinishedIds, ...compactDoneIds]),
    [serverFinishedIds, compactDoneIds],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Program Slots</h2>
      <div className="grid grid-cols-2 gap-3">
        {allDays.map((day, index) => {
          const isToday = day.day_of_week === new Date().getDay();
          const done = finishedSet.has(day.id);
          return (
            <div
              key={day.id}
              className={`bg-card rounded-xl border p-3 ${
                done
                  ? "border-accent/50 bg-accent/5"
                  : isToday
                  ? "border-accent bg-accent/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-muted text-xs">Workout {index + 1}</p>
                {done && (
                  <span className="text-xs text-accent font-semibold">✓ Done</span>
                )}
              </div>
              <p className="text-white font-medium">{day.name}</p>
              {isToday && !done && <p className="text-xs text-accent mt-1">Today</p>}
              <StartWorkoutButton workoutDayId={day.id} programId={day.program_id} small />
            </div>
          );
        })}
      </div>
    </div>
  );
}
