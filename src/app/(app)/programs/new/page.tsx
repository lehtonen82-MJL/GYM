"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgramForm } from "@/components/ProgramForm";
import { createProgram } from "@/lib/actions";
import type { ProgramMode } from "@/lib/types";

export default function NewProgramPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (name: string, description: string | null, mode: ProgramMode) => {
    setIsLoading(true);
    setError("");

    try {
      const program = await createProgram(name, description, mode);
      router.push(`/programs/${program.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create program");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.back()}
            className="text-2xl text-muted hover:text-white"
            aria-label="Back"
          >
            {"<"}
          </button>
          <h1 className="text-2xl font-bold text-white">New Program</h1>
        </div>
      </div>

      <div className="max-w-2xl px-4 py-6">
        <div className="rounded-lg border border-border bg-card p-6">
          {error && (
            <div className="mb-4 rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
              {error}
            </div>
          )}
          <ProgramForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
