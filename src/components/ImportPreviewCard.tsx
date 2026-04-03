"use client";

import type { PropsWithChildren } from "react";

interface WarningBadgeProps {
  type: "unknown_exercise" | "malformed_line" | "empty_day" | "duplicate_day";
  message: string;
}

export function WarningBadge({ type, message }: WarningBadgeProps) {
  const styles = {
    unknown_exercise: "border-yellow-500/60 bg-yellow-500/10 text-yellow-200",
    malformed_line: "border-orange-500/60 bg-orange-500/10 text-orange-200",
    empty_day: "border-yellow-500/60 bg-yellow-500/10 text-yellow-200",
    duplicate_day: "border-orange-500/60 bg-orange-500/10 text-orange-200",
  }[type];

  const label = {
    unknown_exercise: "Warning",
    malformed_line: "Warning",
    empty_day: "Info",
    duplicate_day: "Warning",
  }[type];

  return (
    <div className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${styles}`}>
      <span className="flex-shrink-0 text-xs font-semibold uppercase">{label}</span>
      <span>{message}</span>
    </div>
  );
}

interface ImportPreviewCardProps {
  dayIndex: number;
  dayName: string;
  exerciseCount: number;
  children?: PropsWithChildren["children"];
}

export function ImportPreviewCard({
  dayIndex,
  dayName,
  exerciseCount,
  children,
}: ImportPreviewCardProps) {
  return (
    <div className="mb-3 rounded-lg border border-border border-l-4 border-l-accent bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          Workout {dayIndex + 1}: {dayName}
        </h3>
        <span className="rounded bg-accent/20 px-2 py-1 text-xs text-accent">
          {exerciseCount} exercises
        </span>
      </div>

      {children}
    </div>
  );
}
