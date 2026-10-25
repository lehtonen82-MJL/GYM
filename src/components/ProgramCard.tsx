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
    <div className="mb-3 rounded-lg border border-border border-l-4 border-l-accent bg-card p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">{program.name}</h3>
          {program.description && (
            <p className="mt-1 text-sm text-muted">{program.description}</p>
          )}
        </div>
        {program.is_active && (
          <span className="ml-2 inline-block rounded bg-success/20 px-2 py-1 text-xs font-medium text-success">
            Active
          </span>
        )}
      </div>

      <div className="mb-4 flex gap-3 text-xs text-muted">
        <span>{modeLabel}</span>
        <span>-</span>
        <span>{daysCount} days</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {onOpen && (
          <button
            onClick={onOpen}
            className="rounded bg-accent py-2 text-sm font-medium text-on-accent hover:bg-accent-hover active:bg-accent-hover"
          >
            Open
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded border border-border bg-surface-hover py-2 text-sm font-medium text-white hover:bg-surface-strong active:bg-surface-strong"
          >
            Edit
          </button>
        )}
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="rounded border border-border bg-surface-hover py-2 text-sm font-medium text-white hover:bg-surface-strong active:bg-surface-strong"
          >
            Duplicate
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {onSetActive && !program.is_active && (
          <button
            onClick={onSetActive}
            className="col-span-2 rounded bg-success py-2 text-sm font-medium text-on-accent hover:bg-accent active:bg-accent"
          >
            Set Active
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 active:bg-red-700"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
