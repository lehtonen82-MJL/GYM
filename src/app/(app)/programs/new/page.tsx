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
      // Redirect to edit page
      router.push(`/programs/${program.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create program");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">New Program</h1>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-6 max-w-2xl">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <ProgramForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
