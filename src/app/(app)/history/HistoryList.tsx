"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deleteWorkoutFromHistory,
  deleteWorkoutsBulk,
  deleteAllImportedWorkouts,
  exportWorkoutHistory,
  type WorkoutHistoryItem,
} from "@/lib/actions";
import type { Workout } from "@/lib/types";
import { formatDuration, formatShortDate, formatVolume } from "@/lib/format";
import { filterWorkouts, visibleSelection } from "@/lib/historyFilter";
import { useSettings } from "@/lib/settings";
import ImportWorkoutModal from "./ImportWorkoutModal";

function isImported(w: Workout) {
  return (
    (w.workout_day?.name === "Imported" && w.notes?.startsWith("[Import]")) ||
    (!w.workout_day && w.import_session_name !== undefined)
  );
}

function workoutTitle(w: Workout): string {
  return w.workout_day?.name === "Imported" && w.notes?.startsWith("[Import]")
    ? w.notes.replace(/^\[Import\]\s*/, "") || "Imported"
    : (w.workout_day?.name ?? w.import_session_name ?? "Workout");
}

export default function HistoryList({ workouts: allWorkouts }: { workouts: WorkoutHistoryItem[] }) {
  const router = useRouter();
  const { unit } = useSettings();

  // Search (exercise, title, notes, date) — select/delete act on the visible rows
  const [query, setQuery] = useState("");
  const workouts = useMemo(
    () =>
      filterWorkouts(
        allWorkouts.map((w) => ({ ...w, title: workoutTitle(w) })),
        query,
        formatShortDate
      ),
    [allWorkouts, query]
  );

  // Normal-mode state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Select-mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmClearImported, setConfirmClearImported] = useState(false);

  const hasImported = allWorkouts.some(isImported);

  // ── Normal single delete ────────────────────────────────────────────────────
  const handleDeleteConfirmed = async (workoutId: string) => {
    try {
      setDeletingId(workoutId);
      setConfirmId(null);
      await deleteWorkoutFromHistory(workoutId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete workout.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Select mode helpers ────────────────────────────────────────────────────
  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
    setConfirmId(null);
    setConfirmBulk(false);
    setConfirmClearImported(false);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setConfirmBulk(false);
    setConfirmClearImported(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSelectedIds = visibleSelection(selectedIds, workouts);
  const allSelected = workouts.length > 0 && visibleSelectedIds.length === workouts.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(workouts.map((w) => w.id)));
    }
  };

  // ── Bulk delete selected ────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (visibleSelectedIds.length === 0) return;
    setBulkDeleting(true);
    setConfirmBulk(false);
    try {
      await deleteWorkoutsBulk(visibleSelectedIds);
      router.refresh();
      exitSelectMode();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete workouts.");
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Delete all imported ────────────────────────────────────────────────────
  const handleClearImported = async () => {
    setBulkDeleting(true);
    setConfirmClearImported(false);
    try {
      const { deleted } = await deleteAllImportedWorkouts();
      router.refresh();
      exitSelectMode();
      if (deleted === 0) alert("No imported workouts found.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete imported workouts.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await exportWorkoutHistory();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workout-history-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercise, workout, notes or date"
        aria-label="Search history"
        className="w-full px-4 py-3 rounded-xl bg-zinc-900 text-white border border-zinc-800 focus:border-blue-500 focus:outline-none text-base placeholder:text-zinc-600"
      />
      {query && (
        <p className="text-muted text-xs" role="status">
          {workouts.length} of {allWorkouts.length} workouts
        </p>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {!selectMode ? (
          <>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="flex-1 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-accent font-semibold text-sm active:bg-zinc-800"
            >
              + Import
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="flex-1 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-accent font-semibold text-sm active:bg-zinc-800 disabled:opacity-50"
            >
              {exporting ? "Exporting…" : "📤 Export"}
            </button>
            <button
              type="button"
              onClick={enterSelectMode}
              className="py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold text-sm active:bg-zinc-800"
              aria-label="Select workouts"
            >
              Select
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={exitSelectMode}
              className="py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold text-sm active:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold text-sm active:bg-zinc-800"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            {confirmBulk ? (
              <div className="flex gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => setConfirmBulk(false)}
                  className="flex-1 py-3 rounded-xl bg-zinc-700 text-white font-semibold text-sm active:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={bulkDeleting}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700 disabled:opacity-50"
                >
                  {bulkDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { if (visibleSelectedIds.length > 0) setConfirmBulk(true); }}
                disabled={visibleSelectedIds.length === 0 || bulkDeleting}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {bulkDeleting ? "Deleting…" : `Delete (${visibleSelectedIds.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Delete All Imported — shown when imported workouts exist */}
      {hasImported && !selectMode && (
        confirmClearImported ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmClearImported(false)}
              className="flex-1 py-3 rounded-xl bg-zinc-700 text-white font-semibold text-sm active:bg-zinc-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleClearImported()}
              disabled={bulkDeleting}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleting ? "Deleting…" : "Delete All"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClearImported(true)}
            className="w-full py-3 rounded-xl bg-zinc-900 border border-red-900/50 text-red-400 font-semibold text-sm active:bg-zinc-800"
          >
            Delete All Imported Workouts
          </button>
        )
      )}

      {showImport && (
        <ImportWorkoutModal onClose={() => setShowImport(false)} />
      )}

      {workouts.map((w) => {
        const imported = isImported(w);
        const selected = selectedIds.has(w.id);
        const duration = formatDuration(w.started_at, w.completed_at);

        return (
          <div
            key={w.id}
            className={`bg-card rounded-2xl border p-4 transition-colors ${
              selectMode && selected ? "border-accent/60 bg-accent/5" : "border-border"
            }`}
            onClick={selectMode ? () => toggleSelect(w.id) : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Checkbox in select mode */}
              {selectMode && (
                <div className="flex items-center pt-0.5 shrink-0">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selected ? "border-accent bg-accent" : "border-zinc-600"
                    }`}
                  >
                    {selected && (
                      <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-white stroke-[2]">
                        <polyline points="1,5 4,8 11,1" />
                      </svg>
                    )}
                  </div>
                </div>
              )}

              {selectMode ? (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold">
                      {workoutTitle(w)}
                    </p>
                    {imported && (
                      <span className="text-xs bg-zinc-700 text-zinc-300 rounded px-1.5 py-0.5">Imported</span>
                    )}
                    {w.is_deload && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5">🔄 Easy week</span>
                    )}
                  </div>
                  <p className="text-muted text-sm">{w.workout_day?.day_label}</p>
                  <p className="text-white text-sm mt-2">{formatShortDate(w.started_at)}</p>
                  <p className="text-muted text-xs">{duration}</p>
                </div>
              ) : (
                <Link href={`/workout/${w.id}`} className="min-w-0 flex-1 active:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold">
                      {workoutTitle(w)}
                    </p>
                    {imported && (
                      <span className="text-xs bg-zinc-700 text-zinc-300 rounded px-1.5 py-0.5">Imported</span>
                    )}
                    {w.is_deload && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5">🔄 Easy week</span>
                    )}
                  </div>
                  <p className="text-muted text-sm">{w.workout_day?.day_label}</p>
                  {w.exercise_names.length > 0 && (
                    <p className="text-muted text-xs mt-1 line-clamp-1">{w.exercise_names.join(" · ")}</p>
                  )}
                  <p className="text-white text-sm mt-2">{formatShortDate(w.started_at)}</p>
                  <p className="text-muted text-xs">
                    {duration}
                    {w.volume_kg > 0 && (
                      <>
                        {duration ? " · " : ""}
                        {formatVolume(w.volume_kg, unit)}
                      </>
                    )}
                  </p>
                  {w.notes && !w.notes.startsWith("[Import]") && (
                    <p className="text-muted text-sm mt-2 line-clamp-1">{w.notes}</p>
                  )}
                </Link>
              )}

              {/* Per-item delete buttons (normal mode only) */}
              {!selectMode && (
                <div className="flex items-center gap-2 shrink-0">
                  {confirmId === w.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-medium text-white active:bg-zinc-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteConfirmed(w.id)}
                        disabled={deletingId === w.id}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white active:bg-red-700 disabled:bg-zinc-600"
                      >
                        {deletingId === w.id ? "Deleting…" : "Confirm"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(w.id)}
                      disabled={deletingId === w.id}
                      className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-red-400 active:bg-zinc-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
