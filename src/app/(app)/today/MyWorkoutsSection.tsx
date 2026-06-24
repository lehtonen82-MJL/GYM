"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        const serialized = JSON.stringify(result);
        sessionStorage.setItem(`workout-${result.id}`, serialized);
        localStorage.setItem(`workout-${result.id}`, serialized);
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
            <div key={t.id} className="rounded-xl border border-zinc-700 overflow-hidden">
              {/* Row: name + exercise count + expand toggle */}
              <button
                type="button"
                onClick={() => void handleExpand(t.id)}
                className="w-full text-left px-4 py-3 bg-zinc-800 active:bg-zinc-700 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{t.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
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
                  className={`text-zinc-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Expanded: preview + actions */}
              {isExpanded && (
                <div className="px-4 py-3 bg-zinc-900 space-y-3 border-t border-zinc-700">
                  {previewLoading || !preview ? (
                    <p className="text-zinc-500 text-sm">Loading…</p>
                  ) : (
                    <div className="space-y-1">
                      {preview.exercises.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between text-sm">
                          <span className="text-white">{ex.exercise_name_snapshot}</span>
                          <span className="text-zinc-500 tabular-nums">
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
                        className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-white border border-zinc-600 focus:border-blue-500 focus:outline-none text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(t.id)}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold active:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="px-3 py-2 rounded-lg bg-zinc-700 text-white text-sm active:bg-zinc-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : confirmDeleteId === t.id ? (
                    <div className="flex gap-2">
                      <p className="flex-1 text-zinc-400 text-sm self-center">Delete &ldquo;{t.name}&rdquo;?</p>
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
                        className="px-3 py-2 rounded-lg bg-zinc-700 text-white text-sm active:bg-zinc-600"
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
                        className="flex-1 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm active:bg-accent-hover disabled:opacity-50"
                      >
                        {starting === t.id ? "Starting…" : "Start"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRenamingId(t.id); setRenameValue(t.name); }}
                        className="px-3 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm active:bg-zinc-700"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="px-3 py-2.5 rounded-lg bg-zinc-800 text-red-400 text-sm active:bg-zinc-700"
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
