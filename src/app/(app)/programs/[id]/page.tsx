"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getProgramById, getProgramDays, getProgramExercises } from "@/lib/actions";
import type { Program, ProgramDay, ProgramExercise } from "@/lib/types";
import Link from "next/link";

export default function ProgramDetailPage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [exercisesByDay, setExercisesByDay] = useState<Record<string, ProgramExercise[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [prog, daysList] = await Promise.all([
          getProgramById(programId),
          getProgramDays(programId),
        ]);

        if (!prog) {
          setError("Program not found");
          return;
        }

        setProgram(prog);
        setDays(daysList);

        const exByDay: Record<string, ProgramExercise[]> = {};
        for (const day of daysList) {
          exByDay[day.id] = await getProgramExercises(day.id);
        }
        setExercisesByDay(exByDay);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load program");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [programId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted">Loading program...</div>
      </div>
    );
  }

  if (!program || error) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="text-2xl text-muted hover:text-white"
            aria-label="Back"
          >
            {"<"}
          </button>
          <h1 className="text-2xl font-bold text-white">Program</h1>
        </div>
        <div className="px-4 py-6">
          <div className="rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
            {error || "Program not found"}
          </div>
        </div>
      </div>
    );
  }

  const modeLabel = program.mode === "weekday" ? "Weekday" : "Sessions";

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex flex-1 items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-2xl text-muted hover:text-white"
              aria-label="Back"
            >
              {"<"}
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{program.name}</h1>
              <p className="mt-1 text-sm text-muted">{program.description}</p>
            </div>
          </div>
          <Link
            href={`/programs/${programId}/edit`}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="max-w-2xl px-4 py-6">
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-white">{days.length}</div>
              <div className="text-sm text-muted">Days</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{Object.values(exercisesByDay).flat().length}</div>
              <div className="text-sm text-muted">Exercises</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">{modeLabel}</div>
              <div className="text-sm text-muted">Mode</div>
            </div>
          </div>
        </div>

        {days.length > 0 ? (
          <div className="space-y-4">
            {days.map((day) => {
              const dayExercises = exercisesByDay[day.id] || [];
              return (
                <div key={day.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">{day.name}</h2>
                    {program.mode === "weekday" && day.weekday_label && (
                      <span className="rounded bg-surface px-2 py-1 text-xs text-muted">{day.weekday_label}</span>
                    )}
                    {program.mode === "session" && day.session_label && (
                      <span className="rounded bg-surface px-2 py-1 text-xs text-muted">{day.session_label}</span>
                    )}
                  </div>

                  {dayExercises.length > 0 ? (
                    <ul className="space-y-2">
                      {dayExercises.map((ex) => (
                        <li
                          key={ex.id}
                          className="flex items-start justify-between border-t border-border py-2 first:border-t-0 text-sm"
                        >
                          <div>
                            <div className="font-medium text-white">{ex.exercise_name_snapshot}</div>
                            {ex.scheme_text && <div className="text-xs text-muted">{ex.scheme_text}</div>}
                            {ex.target_reps_text && <div className="text-xs text-muted">{ex.target_reps_text} reps</div>}
                            {ex.notes && <div className="text-xs italic text-muted">{ex.notes}</div>}
                          </div>
                          {ex.target_sets && <div className="ml-2 text-xs text-muted">{ex.target_sets}x</div>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No exercises yet</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="mb-4 text-muted">No days added yet</p>
            <Link
              href={`/programs/${programId}/edit`}
              className="inline-block rounded bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover"
            >
              Add Days
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
