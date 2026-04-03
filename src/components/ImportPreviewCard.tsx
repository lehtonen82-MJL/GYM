"use client";

import type { PropsWithChildren } from "react";

interface WarningBadgeProps {
  type: "unknown_exercise" | "malformed_line" | "empty_day" | "duplicate_day";
  message: string;
}

export function WarningBadge({ type, message }: WarningBadgeProps) {
  const bgColor = {
    unknown_exercise: "bg-yellow-100 text-yellow-800 border-yellow-300",
    malformed_line: "bg-orange-100 text-orange-800 border-orange-300",
    empty_day: "bg-yellow-100 text-yellow-800 border-yellow-300",
    duplicate_day: "bg-orange-100 text-orange-800 border-orange-300",
  }[type];

  const icon = {
    unknown_exercise: "⚠️",
    malformed_line: "⚠️",
    empty_day: "📭",
    duplicate_day: "⚠️",
  }[type];

  return (
    <div className={`border ${bgColor} px-3 py-2 rounded text-sm flex items-start gap-2`}>
      <span className="text-lg flex-shrink-0">{icon}</span>
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
    <div className="border-l-4 border-blue-500 bg-white rounded-lg p-4 shadow-sm mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base text-gray-900">{dayName}</h3>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
          {exerciseCount} exercises
        </span>
      </div>

      {children}
    </div>
  );
}
