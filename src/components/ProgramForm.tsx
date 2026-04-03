"use client";

import { useState } from "react";
import type { ProgramMode } from "@/lib/types";

interface ProgramFormProps {
  initialName?: string;
  initialDescription?: string;
  initialMode?: ProgramMode;
  onSubmit: (name: string, description: string | null, mode: ProgramMode) => Promise<void>;
  isLoading?: boolean;
}

export function ProgramForm({
  initialName = "",
  initialDescription = "",
  initialMode = "weekday",
  onSubmit,
  isLoading = false,
}: ProgramFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [mode, setMode] = useState<ProgramMode>(initialMode);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Program name is required");
      return;
    }

    try {
      await onSubmit(name.trim(), description.trim() || null, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save program");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Program Name *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Strength A/B"
          className="w-full rounded-lg border border-border bg-zinc-900 px-3 py-2 text-base text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-muted">
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Classic strength split"
          rows={2}
          className="w-full rounded-lg border border-border bg-zinc-900 px-3 py-2 text-base text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={isLoading}
        />
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-muted">Program Type *</legend>
        <div className="space-y-2">
          <label className="flex items-center text-white">
            <input
              type="radio"
              name="mode"
              value="weekday"
              checked={mode === "weekday"}
              onChange={(e) => setMode(e.target.value as ProgramMode)}
              className="h-4 w-4"
              disabled={isLoading}
            />
            <span className="ml-2 text-base">Weekday Mode (Mon, Tue, Wed, ...)</span>
          </label>
          <label className="flex items-center text-white">
            <input
              type="radio"
              name="mode"
              value="session"
              checked={mode === "session"}
              onChange={(e) => setMode(e.target.value as ProgramMode)}
              className="h-4 w-4"
              disabled={isLoading}
            />
            <span className="ml-2 text-base">Session Mode (Workout 1, Workout 2, ...)</span>
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-accent py-3 text-base font-medium text-white hover:bg-accent-hover disabled:bg-zinc-600"
      >
        {isLoading ? "Creating..." : "Create Program"}
      </button>
    </form>
  );
}
