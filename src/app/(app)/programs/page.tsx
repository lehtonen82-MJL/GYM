"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProgramCard } from "@/components/ProgramCard";
import {
  getPrograms,
  getProgramDays,
  setActiveProgram,
  deleteProgram,
} from "@/lib/actions";
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

        const countsEntries = await Promise.all(
          data.map(async (prog) => {
            const days = await getProgramDays(prog.id);
            return [prog.id, days.length] as const;
          })
        );
        const counts = Object.fromEntries(countsEntries);
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
      setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === id })));
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted">Loading programs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Programs</h1>
          <p className="mt-1 text-sm text-muted">Manage your workout programs</p>
        </div>
      </div>

      <div className="px-4 py-4">
        {error && (
          <div className="mb-4 rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/programs/new")}
            className="rounded-lg bg-accent py-3 text-center font-medium text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-hover"
          >
            + New
          </button>
          <button
            onClick={() => router.push("/programs/import")}
            className="rounded-lg border border-border bg-card py-3 text-center font-medium text-white transition-colors hover:bg-card-hover active:bg-surface-hover"
          >
            Import
          </button>
        </div>

        {activeProgram && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Active Program</h2>
            <ProgramCard
              program={activeProgram}
              daysCount={dayCounts[activeProgram.id] || 0}
              onEdit={() => router.push(`/programs/${activeProgram.id}/edit`)}
              onDuplicate={() => router.push(`/programs/${activeProgram.id}/edit?duplicate=true`)}
              onSetActive={() => handleSetActive(activeProgram.id)}
              onDelete={() => handleDelete(activeProgram.id)}
            />
          </div>
        )}

        {otherPrograms.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Other Programs</h2>
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

        {programs.length === 0 && (
          <div className="py-12 text-center">
            <h3 className="mb-2 text-lg font-semibold text-white">No programs yet</h3>
            <p className="mb-6 text-muted">Create your first program to get started</p>
            <button
              onClick={() => router.push("/programs/new")}
              className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-on-accent hover:bg-accent-hover"
            >
              Create Program
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
