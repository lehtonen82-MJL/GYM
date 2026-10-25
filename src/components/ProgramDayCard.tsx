"use client";

import { useState } from "react";
import type { ProgramDay } from "@/lib/types";

const WEEKDAYS = ["SU", "MO", "TI", "WO", "TO", "FR", "LA"] as const;

interface ProgramDayCardProps {
  day: ProgramDay;
  isExpanded?: boolean;
  onToggle?: () => void;
  onRename?: (newName: string) => void;
  onWeekdayChange?: (dayOfWeek: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children?: React.ReactNode;
}

export function ProgramDayCard({
  day,
  isExpanded = false,
  onToggle,
  onRename,
  onWeekdayChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  children,
}: ProgramDayCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(day.name);

  const handleSaveName = () => {
    if (editName.trim() && editName !== day.name) {
      onRename?.(editName.trim());
    }
    setIsEditing(false);
    setEditName(day.name);
  };

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border border-l-4 border-l-accent bg-card">
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onToggle}
          className="h-10 w-10 flex-shrink-0 rounded text-muted transition-colors hover:bg-surface hover:text-white active:bg-surface-hover"
          aria-label={isExpanded ? "Collapse day" : "Expand day"}
        >
          {isExpanded ? "v" : ">"}
        </button>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setEditName(day.name);
                  setIsEditing(false);
                }
              }}
              placeholder="Day name"
              autoFocus
              className="w-full rounded border border-accent bg-card px-2 py-1 text-base text-white focus:outline-none"
            />
          ) : (
            <h3
              onClick={() => setIsEditing(true)}
              className="cursor-pointer text-base font-semibold text-white hover:text-accent"
            >
              {day.name}
            </h3>
          )}
          {day.weekday_label && <p className="mt-1 text-xs text-muted">{day.weekday_label}</p>}
          {day.session_label && <p className="mt-1 text-xs text-muted">{day.session_label}</p>}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className="h-10 w-10 rounded text-muted transition-colors hover:bg-surface hover:text-white active:bg-surface-hover"
              title="Move day up"
              aria-label="Move day up"
            >
              ^
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className="h-10 w-10 rounded text-muted transition-colors hover:bg-surface hover:text-white active:bg-surface-hover"
              title="Move day down"
              aria-label="Move day down"
            >
              v
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 w-10 rounded text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 active:bg-red-500/20"
              title="Delete day"
              aria-label="Delete day"
            >
              x
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border bg-card/40 p-4 space-y-4">
          {/* Weekday picker */}
          {onWeekdayChange && (
            <div>
              <p className="text-xs text-muted mb-2">Weekday</p>
              <div className="flex gap-1">
                {WEEKDAYS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onWeekdayChange(i)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      day.day_of_week === i
                        ? "bg-accent text-on-accent"
                        : "bg-surface text-muted active:bg-surface-hover"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {children && <div>{children}</div>}
        </div>
      )}
    </div>
  );
}
