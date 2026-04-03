"use client";

import type { Program } from "@/lib/types";

interface ProgramCardProps {
  program: Program;
  daysCount: number;
  onOpen?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onSetActive?: () => void;
  onDelete?: () => void;
}

export function ProgramCard({
  program,
  daysCount,
  onOpen,
  onEdit,
  onDuplicate,
  onSetActive,
  onDelete,
}: ProgramCardProps) {
  const modeLabel = program.mode === "weekday" ? "Weekday" : "Sessions";

  return (
    <div className="border-l-4 border-blue-500 bg-white rounded-lg p-4 shadow-sm mb-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-base text-gray-900">{program.name}</h3>
          {program.description && (
            <p className="text-sm text-gray-600 mt-1">{program.description}</p>
          )}
        </div>
        {program.is_active && (
          <span className="ml-2 inline-block bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
            Active
          </span>
        )}
      </div>

      {/* Meta info */}
      <div className="flex gap-3 text-xs text-gray-600 mb-4">
        <span>{modeLabel}</span>
        <span>•</span>
        <span>{daysCount} days</span>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        {onOpen && (
          <button
            onClick={onOpen}
            className="bg-blue-500 text-white text-sm font-medium py-2 rounded hover:bg-blue-600 active:bg-blue-700"
          >
            Open
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="bg-gray-500 text-white text-sm font-medium py-2 rounded hover:bg-gray-600 active:bg-gray-700"
          >
            Edit
          </button>
        )}
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="bg-gray-500 text-white text-sm font-medium py-2 rounded hover:bg-gray-600 active:bg-gray-700"
          >
            Duplicate
          </button>
        )}
      </div>

      {/* Second row of actions */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {onSetActive && !program.is_active && (
          <button
            onClick={onSetActive}
            className="bg-green-500 text-white text-sm font-medium py-2 rounded hover:bg-green-600 active:bg-green-700 col-span-2"
          >
            Set Active
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="bg-red-500 text-white text-sm font-medium py-2 rounded hover:bg-red-600 active:bg-red-700"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
