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
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] pb-3 pt-safe border-b border-zinc-800">
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
        <div className="scrollbar-hidden flex-1 overflow-y-auto p-4 flex flex-col gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {/* Format guide */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 px-3 py-2.5 text-xs text-muted space-y-0.5">
            <p className="text-white font-medium text-sm mb-1">Format</p>
            <p><span className="text-accent">17.2.2024 Chest Day</span> — date + session name</p>
            <p><span className="text-white font-mono">Bench Press 4x5@90kg</span> — sets×reps@weight</p>
            <p><span className="text-white font-mono">Squat 5x100kg</span> — sets×weight (no reps)</p>
            <p><span className="text-white font-mono">Pull-up 3x8</span> — sets×reps (no weight)</p>
          </div>

          {/* Auto-grow textarea via CSS grid overlay trick */}
          <div className="grid">
            {/* Hidden mirror div — same styling, content drives the height */}
            <div
              className="invisible whitespace-pre-wrap break-words px-3 py-2.5 text-sm font-mono border rounded-xl min-h-[100px]"
              style={{ gridArea: "1/1" }}
              aria-hidden="true"
            >
              {text || "17.2.2024 Chest Day\nBench Press 4x5@90kg"}
              {"\n"}
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(""); }}
              placeholder={"17.2.2024 Chest Day\nBench Press 4x5@90kg\nSquat 5x100kg"}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 text-white border border-zinc-800 focus:border-accent focus:outline-none text-sm resize-none font-mono min-h-[100px]"
              style={{ gridArea: "1/1" }}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="button"
            onClick={handlePreview}
            disabled={!text.trim()}
            className="w-full py-3 rounded-xl bg-accent text-white font-bold text-base active:opacity-80 disabled:opacity-40"
          >
            Preview →
          </button>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Summary bar */}
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[env(safe-area-inset-bottom)]">
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
              <div key={si} className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div>
                  <p className="text-white font-semibold">
                    {session.sessionName ?? "Workout"}
                  </p>
                  <p className="text-muted text-xs">
                    {session.date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  {session.exercises.map((ex, ei) => (
                    <div key={ei} className="border-t border-zinc-800 pt-2 first:border-0 first:pt-0">
                      <p className="text-white text-sm font-medium">{ex.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {ex.sets.map((s, si2) => (
                          <span
                            key={si2}
                            className="text-xs font-mono bg-zinc-800 text-muted rounded px-2 py-0.5"
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
                        <span className="text-xs text-muted self-center">
                          ({ex.sets.length} set{ex.sets.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom action bar */}
          <div className="p-4 border-t border-zinc-800 space-y-3 pb-[env(safe-area-inset-bottom)]">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing}
              className="w-full py-4 rounded-xl bg-accent text-white font-bold text-base active:opacity-80 disabled:opacity-50"
            >
              {importing
                ? "Importing..."
                : `Import ${totalSessions} Workout${totalSessions !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
