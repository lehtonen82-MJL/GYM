"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserStorage, saveStartResult } from "@/lib/workoutSession";
import {
  getWorkoutTemplate,
  startWorkoutFromTemplate,
  renameWorkoutTemplate,
  deleteWorkoutTemplate,
} from "@/lib/actions";
import type { WorkoutTemplateListItem, WorkoutTemplateWithExercises } from "@/lib/types";

type Props = {
  templates: WorkoutTemplateListItem[];
};

export default function MyWorkoutsSection({ templates: initialTemplates }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkoutTemplateWithExercises | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleExpand(templateId: string) {
    if (expandedId === templateId) {
      setExpandedId(null);
      setPreview(null);
      return;
    }
    setExpandedId(templateId);
    setPreview(null);
    setPreviewLoading(true);
    const full = await getWorkoutTemplate(templateId);
    setPreview(full);
    setPreviewLoading(false);
  }

  async function handleStart(templateId: string) {
    if (starting) return;
    setStarting(templateId);
    try {
      const result = await startWorkoutFromTemplate(templateId);
      if (result) {
        saveStartResult(browserStorage, result);
        router.push(`/workout/${result.id}`);
      }
    } finally {
      setStarting(null);
    }
  }

  async function handleRename(templateId: string) {
    if (!renameValue.trim()) return;
    await renameWorkoutTemplate(templateId, renameValue.trim());
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, name: renameValue.trim() } : t))
    );
    setRenamingId(null);
  }

  async function handleDelete(templateId: string) {
    await deleteWorkoutTemplate(templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setConfirmDeleteId(null);
    if (expandedId === templateId) setExpandedId(null);
  }

  if (templates.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div>
        <p className="text-muted text-sm">My Workouts</p>
        <h3 className="text-lg font-semibold text-white mt-0.5">Saved workouts</h3>
      </div>

      <div className="space-y-2">
        {templates.map((t) => {
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="rounded-xl border border-border-strong overflow-hidden">
              {/* Row: name + exercise count + expand toggle */}
              <button
                type="button"
                onClick={() => void handleExpand(t.id)}
                className="w-full text-left px-4 py-3 bg-surface active:bg-surface-hover flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{t.name}</p>
                  <p className="text-muted text-xs mt-0.5">
                    {t.exercise_count} exercise{t.exercise_count !== 1 ? "s" : ""}
                    {t.exercise_names.length > 0 && (
                      <> · {t.exercise_names.slice(0, 3).join(", ")}{t.exercise_count > 3 ? "…" : ""}</>
                    )}
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-muted shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Expanded: preview + actions */}
              {isExpanded && (
                <div className="px-4 py-3 bg-card space-y-3 border-t border-border-strong">
                  {previewLoading || !preview ? (
                    <p className="text-muted text-sm">Loading…</p>
                  ) : (
                    <div className="space-y-1">
                      {preview.exercises.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between text-sm">
                          <span className="text-white">{ex.exercise_name_snapshot}</span>
                          <span className="text-muted tabular-nums">
                            {ex.target_sets}×{ex.target_reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rename inline */}
                  {renamingId === t.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void handleRename(t.id); if (e.key === "Escape") setRenamingId(null); }}
                        className="flex-1 px-3 py-2 rounded-lg bg-surface text-white border border-border-strong focus:border-accent focus:outline-none text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(t.id)}
                        className="px-3 py-2 rounded-lg bg-accent text-on-accent text-sm font-semibold active:bg-accent"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="px-3 py-2 rounded-lg bg-surface-hover text-white text-sm active:bg-surface-strong"
                      >
                        ✕
                      </button>
                    </div>
                  ) : confirmDeleteId === t.id ? (
                    <div className="flex gap-2">
                      <p className="flex-1 text-muted text-sm self-center">Delete &ldquo;{t.name}&rdquo;?</p>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t.id)}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold active:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 rounded-lg bg-surface-hover text-white text-sm active:bg-surface-strong"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleStart(t.id)}
                        disabled={starting === t.id}
                        className="flex-1 py-2.5 rounded-lg bg-accent text-on-accent font-semibold text-sm active:bg-accent-hover disabled:opacity-50"
                      >
                        {starting === t.id ? "Starting…" : "Start"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRenamingId(t.id); setRenameValue(t.name); }}
                        className="px-3 py-2.5 rounded-lg bg-surface text-soft text-sm active:bg-surface-hover"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="px-3 py-2.5 rounded-lg bg-surface text-red-400 text-sm active:bg-surface-hover"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
