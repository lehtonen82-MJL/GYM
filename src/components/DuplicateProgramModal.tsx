"use client";

import { useState } from "react";

interface DuplicateProgramModalProps {
  currentName: string;
  isOpen: boolean;
  isLoading?: boolean;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}

export function DuplicateProgramModal({
  currentName,
  isOpen,
  isLoading = false,
  onSubmit,
  onCancel,
}: DuplicateProgramModalProps) {
  const [name, setName] = useState(`${currentName} (Copy)`);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Program name is required");
      return;
    }

    onSubmit(name.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70">
      <div className="max-h-96 w-full overflow-y-auto rounded-t-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-2xl font-bold text-white">Duplicate Program</h2>

        {error && (
          <div className="mb-4 rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-muted">
              New Program Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border bg-zinc-900 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-muted">Original: {currentName}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border bg-zinc-700 py-3 font-medium text-white hover:bg-zinc-600 active:bg-zinc-500 disabled:bg-zinc-700/60"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-accent py-3 font-medium text-white hover:bg-accent-hover active:bg-accent-hover disabled:bg-zinc-600"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Copy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
