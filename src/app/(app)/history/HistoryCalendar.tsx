"use client";

import { useState } from "react";
import { localDay, monthGrid, weekStreak } from "@/lib/calendar";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Month calendar of workout days with the week streak. Tapping a day with workouts selects it (tap
 * again to clear); browsing goes back as far as the loaded history.
 */
export default function HistoryCalendar({
  startedAts,
  selectedDay,
  onSelectDay,
}: {
  startedAts: string[];
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const workoutDays = new Set(startedAts.map((iso) => localDay(iso)));
  const earliest = startedAts.reduce<string | null>((min, iso) => (min === null || iso < min ? iso : min), null);
  const earliestMonth = earliest ? new Date(earliest) : now;
  const canGoBack =
    month.year > earliestMonth.getFullYear() ||
    (month.year === earliestMonth.getFullYear() && month.month > earliestMonth.getMonth());
  const canGoForward = month.year < now.getFullYear() || (month.year === now.getFullYear() && month.month < now.getMonth());
  const shift = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const streak = weekStreak(startedAts, now);
  const today = localDay(now);
  const title = new Date(month.year, month.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="w-9 h-9 rounded-lg text-white disabled:opacity-20 active:bg-zinc-800"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-white font-semibold">{title}</p>
          <p className="text-xs text-muted">
            {streak > 0 ? `🔥 ${streak}-week streak` : "No streak yet: train this week to start one"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          aria-label="Next month"
          className="w-9 h-9 rounded-lg text-white disabled:opacity-20 active:bg-zinc-800"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[10px] text-muted uppercase">{d}</span>
        ))}
        {monthGrid(month.year, month.month).flat().map((day, i) => {
          if (!day) return <span key={i} />;
          const trained = workoutDays.has(day);
          const selected = day === selectedDay;
          return (
            <button
              key={i}
              type="button"
              disabled={!trained}
              onClick={() => onSelectDay(selected ? null : day)}
              aria-pressed={selected}
              aria-label={trained ? `Workouts on ${day}` : day}
              className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center ${
                selected
                  ? "bg-accent text-white"
                  : trained
                    ? "bg-accent/15 text-white active:bg-accent/30"
                    : day === today
                      ? "text-white ring-1 ring-zinc-600"
                      : "text-zinc-600"
              }`}
            >
              {Number(day.slice(8))}
              {trained && !selected && <span className="w-1 h-1 rounded-full bg-accent mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
