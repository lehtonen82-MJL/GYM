"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProgramCard } from "@/components/ProgramCard";
import { getPrograms, setActiveProgram, deleteProgram } from "@/lib/actions";
import type { Program } from "@/lib/types";

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadPrograms() {
      try {
        const data = await getPrograms();
        setPrograms(data);
        // Mock day counts for demo
        const counts: Record<string, number> = {};
        for (const prog of data) {
          counts[prog.id] = prog.id === "prog-demo-1" ? 2 : 0;
        }
        setDayCounts(counts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load programs");
      } finally {
        setLoading(false);
      }
    }
    loadPrograms();
  }, []);

  const handleSetActive = async (id: string) => {
    try {
      await setActiveProgram(id);
      setPrograms((prev) =>
        prev.map((p) => ({ ...p, is_active: p.id === id }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set active program");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this program? This cannot be undone.")) return;
    try {
      await deleteProgram(id);
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete program");
    }
  };

  const activeProgram = programs.find((p) => p.is_active);
  const otherPrograms = programs.filter((p) => !p.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading programs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your workout programs</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => router.push("/programs/new")}
            className="bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 active:bg-blue-700 text-center transition-colors"
          >
            + New
          </button>
          <button
            onClick={() => router.push("/programs/import")}
            className="bg-purple-500 text-white font-medium py-3 rounded-lg hover:bg-purple-600 active:bg-purple-700 text-center transition-colors"
          >
            📥 Import
          </button>
        </div>

        {/* Active Program */}
        {activeProgram && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Active Program
            </h2>
            <ProgramCard
              program={activeProgram}
              daysCount={dayCounts[activeProgram.id] || 0}
              onEdit={() => router.push(`/programs/${activeProgram.id}/edit`)}
              onDuplicate={() => router.push(`/programs/${activeProgram.id}/edit?duplicate=true`)}
              onDelete={() => handleDelete(activeProgram.id)}
            />
          </div>
        )}

        {/* Other Programs */}
        {otherPrograms.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Other Programs
            </h2>
            {otherPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                daysCount={dayCounts[program.id] || 0}
                onEdit={() => router.push(`/programs/${program.id}/edit`)}
                onDuplicate={() => router.push(`/programs/${program.id}/edit?duplicate=true`)}
                onSetActive={() => handleSetActive(program.id)}
                onDelete={() => handleDelete(program.id)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {programs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">🗂️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No programs yet</h3>
            <p className="text-gray-600 mb-6">Create your first program to get started</p>
            <button
              onClick={() => router.push("/programs/new")}
              className="inline-block bg-blue-500 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Create Program
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
