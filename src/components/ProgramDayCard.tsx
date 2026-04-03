"use client";

import { useState } from "react";
import type { ProgramDay } from "@/lib/types";

interface ProgramDayCardProps {
  day: ProgramDay;
  isExpanded?: boolean;
  onToggle?: () => void;
  onRename?: (newName: string) => void;
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
    <div className="border-l-4 border-blue-500 bg-white rounded-lg overflow-hidden shadow-sm mb-3">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        {/* Expand/Collapse */}
        <button
          onClick={onToggle}
          className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded transition-colors flex-shrink-0"
          aria-label={isExpanded ? "Collapse day" : "Expand day"}
        >
          {isExpanded ? "▼" : "▶"}
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
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
              className="w-full border border-blue-500 rounded px-2 py-1 text-base focus:outline-none"
            />
          ) : (
            <h3
              onClick={() => setIsEditing(true)}
              className="font-semibold text-base text-gray-900 cursor-pointer hover:text-blue-600"
            >
              {day.name}
            </h3>
          )}
          {day.weekday_label && (
            <p className="text-xs text-gray-600 mt-1">{day.weekday_label}</p>
          )}
          {day.session_label && (
            <p className="text-xs text-gray-600 mt-1">{day.session_label}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 items-center flex-shrink-0">
          {canMoveUp && (
            <button
              onClick={onMoveUp}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded transition-colors"
              title="Move day up"
              aria-label="Move day up"
            >
              ↑
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={onMoveDown}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded transition-colors"
              title="Move day down"
              aria-label="Move day down"
            >
              ↓
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 active:bg-red-100 rounded transition-colors"
              title="Delete day"
              aria-label="Delete day"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && children && <div className="border-t bg-gray-50 p-4">{children}</div>}
    </div>
  );
}
