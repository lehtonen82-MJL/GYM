"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseWorkoutImport } from "@/lib/workoutImportParser";
import { importPastWorkouts } from "@/lib/actions";
import type { ParsedImportSession } from "@/lib/workoutImportParser";

type Step = "input" | "preview";

export default function ImportWorkoutModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [sessions, setSessions] = useState<ParsedImportSession[]>([]);
  const [warnings, setWarnings] = useState<{ line: number; text: string; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  function handlePreview() {
    if (!text.trim()) return;
    const result = parseWorkoutImport(text);
    if (result.sessions.length === 0) {
      setError("No workouts found. Check the format and try again.");
      return;
    }
    setError("");
    setSessions(result.sessions);
    setWarnings(result.warnings);
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const input = sessions.map((s) => ({
        date: s.date.toISOString(),
        sessionName: s.sessionName,
        exercises: s.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
        })),
      }));

      const result = await importPastWorkouts(input);
      if (result.error) {
        // Detect the most common root cause (migration not applied)
        const hint = result.error.toLowerCase().includes("null")
          ? " Make sure the database migration 004_past_workout_import.sql has been applied in Supabase."
          : "";
        setError(`Import failed: ${result.error}.${hint}`);
        return;
      }
      if (result.imported === 0) {
        setError("No workouts were imported. Please check the format and try again.");
        return;
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const totalSessions = sessions.length;
  const totalExercises = sessions.reduce((n, s) => n + s.exercises.length, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 sm:p-8">
      <div className="flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] pb-3 pt-safe border-b border-border">
        <h2 className="text-lg font-bold text-white">Import Past Workouts</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted text-2xl leading-none px-2 active:opacity-60"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {step === "input" && (
        <div className="flex flex-col flex-1 min-h-0 px-4 pt-4 pb-4 gap-4">
          {/* Format guide */}
          <div className="shrink-0 bg-card rounded-xl border border-border px-3 py-3 text-xs text-muted">
            <p className="text-white font-semibold text-sm mb-2">Format</p>
            <p className="leading-6"><span className="text-accent">17.2.2024 Chest Day</span> — date + session name</p>
            <p className="leading-6"><span className="text-white font-mono">Bench Press 4x5@90kg</span> — sets×reps@weight</p>
            <p className="leading-6"><span className="text-white font-mono">Squat 5x100kg</span> — sets×weight (no reps)</p>
            <p className="leading-6"><span className="text-white font-mono">Pull-up 3x8</span> — sets×reps (no weight)</p>
          </div>

          {/* Textarea — flex-1 grows, min-h ensures it is always visible */}
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            placeholder={"17.2.2024 Chest Day\nBench Press 4x5@90kg\nSquat 5x100kg"}
            className="scrollbar-hidden flex-1 w-full px-3 py-3 rounded-xl bg-card text-white border border-border focus:border-accent focus:outline-none text-sm resize-none font-mono"
            style={{ minHeight: "120px" }}
          />

          {error && <p className="shrink-0 text-red-400 text-sm">{error}</p>}

          <button
            type="button"
            onClick={handlePreview}
            disabled={!text.trim()}
            className="shrink-0 w-full py-3 rounded-xl bg-accent text-on-accent font-bold text-base active:opacity-80 disabled:opacity-40"
          >
            Preview →
          </button>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Summary bar */}
          <div className="shrink-0 px-4 py-2 bg-card border-b border-border flex items-center justify-between">
            <span className="text-sm text-muted">
              {totalSessions} workout{totalSessions !== 1 ? "s" : ""} · {totalExercises} exercise{totalExercises !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setStep("input")}
              className="text-sm text-accent active:opacity-60"
            >
              ← Edit
            </button>
          </div>

          {/* Scrollable session list */}
          <div className="scrollbar-hidden flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-[env(safe-area-inset-bottom)] space-y-2">
            {warnings.length > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl p-3 space-y-1">
                <p className="text-yellow-400 text-xs font-semibold">
                  {warnings.length} line{warnings.length !== 1 ? "s" : ""} skipped
                </p>
                {warnings.map((w) => (
                  <p key={w.line} className="text-yellow-300 text-xs">
                    Line {w.line}: {w.message} — <span className="opacity-70 font-mono">{w.text}</span>
                  </p>
                ))}
              </div>
            )}

            {sessions.map((session, si) => (
              <div key={si} className="bg-card rounded-xl border border-border px-3 py-2 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-white font-semibold text-sm">
                    {session.sessionName ?? "Workout"}
                  </p>
                  <p className="text-muted text-xs shrink-0 ml-2">
                    {session.date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="space-y-1">
                  {session.exercises.map((ex, ei) => (
                    <div key={ei} className="border-t border-border pt-1 first:border-0 first:pt-0">
                      <p className="text-white text-xs font-medium">{ex.name}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ex.sets.map((s, si2) => (
                          <span
                            key={si2}
                            className="text-xs font-mono bg-surface text-muted rounded px-1.5 py-0.5"
                          >
                            {s.weightKg != null && s.reps != null
                              ? `${s.weightKg}kg × ${s.reps}`
                              : s.weightKg != null
                              ? `${s.weightKg}kg`
                              : s.reps != null
                              ? `× ${s.reps}`
                              : "set"}
                          </span>
                        ))}
                        <span className="text-xs text-muted/60 self-center">
                          {ex.sets.length}×
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom action bar */}
          <div className="shrink-0 px-4 pt-3 pb-4 border-t border-border space-y-2 pb-[env(safe-area-inset-bottom)]">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing}
              className="w-full py-3 rounded-xl bg-accent text-on-accent font-bold text-base active:opacity-80 disabled:opacity-50"
            >
              {importing
                ? "Importing..."
                : `Import ${totalSessions} Workout${totalSessions !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
