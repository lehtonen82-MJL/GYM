"use client";

import { useState } from "react";
import type { WorkoutDay } from "@/lib/types";
import StartWorkoutButton from "./StartWorkoutButton";

export default function ManualWorkoutSelector({ days }: { days: WorkoutDay[] }) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const selectedDay = days.find((d) => d.id === selectedDayId);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div>
        <p className="text-muted text-sm">Start another workout</p>
        <h3 className="text-lg font-semibold text-white mt-1">Select a day</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {days.map((day) => (
          <button
            key={day.id}
            onClick={() => setSelectedDayId(day.id)}
            className={`p-3 rounded-lg border-2 transition text-left ${
              selectedDayId === day.id
                ? "border-accent bg-accent/10"
                : "border-border bg-border/20 hover:bg-border/30"
            }`}
          >
            <p className="text-xs text-muted">{day.day_label}</p>
            <p className="text-sm font-medium text-white">{day.name}</p>
          </button>
        ))}
      </div>

      {selectedDay && (
        <div>
          <StartWorkoutButton workoutDayId={selectedDay.id} />
        </div>
      )}
    </div>
  );
}
