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
  const [exercisesByDay, setExercisesByDay] = useState<
    Record<string, ProgramExercise[]>
  >({});
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

        // Load exercises for each day
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading program...</div>
      </div>
    );
  }

  if (!program || error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 py-4 flex items-center gap-3 bg-white border-b">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Program</h1>
        </div>
        <div className="px-4 py-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error || "Program not found"}
          </div>
        </div>
      </div>
    );
  }

  const modeLabel = program.mode === "weekday" ? "Weekday" : "Sessions";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 text-2xl"
            >
              ←
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{program.description}</p>
            </div>
          </div>
          <Link
            href={`/programs/${programId}/edit`}
            className="bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-2xl">
        {/* Program Info */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-gray-900">{days.length}</div>
              <div className="text-sm text-gray-600">Days</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {Object.values(exercisesByDay).flat().length}
              </div>
              <div className="text-sm text-gray-600">Exercises</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{modeLabel}</div>
              <div className="text-sm text-gray-600">Mode</div>
            </div>
          </div>
        </div>

        {/* Days */}
        {days.length > 0 ? (
          <div className="space-y-4">
            {days.map((day) => {
              const dayExercises = exercisesByDay[day.id] || [];
              return (
                <div key={day.id} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {day.name}
                    </h2>
                    {program.mode === "weekday" && day.weekday_label && (
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {day.weekday_label}
                      </span>
                    )}
                    {program.mode === "session" && day.session_label && (
                      <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {day.session_label}
                      </span>
                    )}
                  </div>

                  {dayExercises.length > 0 ? (
                    <ul className="space-y-2">
                      {dayExercises.map((ex) => (
                        <li
                          key={ex.id}
                          className="flex items-start justify-between text-sm py-2 border-t border-gray-200 first:border-t-0"
                        >
                          <div>
                            <div className="font-medium text-gray-900">
                              {ex.exercise_name_snapshot}
                            </div>
                            {ex.scheme_text && (
                              <div className="text-xs text-gray-600">
                                {ex.scheme_text}
                              </div>
                            )}
                            {ex.target_reps_text && (
                              <div className="text-xs text-gray-600">
                                {ex.target_reps_text} reps
                              </div>
                            )}
                            {ex.notes && (
                              <div className="text-xs text-gray-500 italic">
                                {ex.notes}
                              </div>
                            )}
                          </div>
                          {ex.target_sets && (
                            <div className="text-xs text-gray-600 ml-2">
                              {ex.target_sets}x
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600">No exercises yet</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-6 text-center shadow-sm">
            <p className="text-gray-600 mb-4">No days added yet</p>
            <Link
              href={`/programs/${programId}/edit`}
              className="inline-block bg-blue-500 text-white px-4 py-2 rounded font-medium hover:bg-blue-600"
            >
              Add Days
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
