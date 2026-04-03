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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Program Name *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Strength A/B"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Classic strength split"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      {/* Mode Selector */}
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">
          Program Type *
        </legend>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="mode"
              value="weekday"
              checked={mode === "weekday"}
              onChange={(e) => setMode(e.target.value as ProgramMode)}
              className="w-4 h-4"
              disabled={isLoading}
            />
            <span className="ml-2 text-base text-gray-700">
              Weekday Mode (Mon, Tue, Wed, ...)
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="mode"
              value="session"
              checked={mode === "session"}
              onChange={(e) => setMode(e.target.value as ProgramMode)}
              className="w-4 h-4"
              disabled={isLoading}
            />
            <span className="ml-2 text-base text-gray-700">
              Session Mode (Workout 1, Workout 2, ...)
            </span>
          </label>
        </div>
      </fieldset>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 text-base"
      >
        {isLoading ? "Creating..." : "Create Program"}
      </button>
    </form>
  );
}
