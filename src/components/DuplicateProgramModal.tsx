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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-lg p-6 max-h-96 overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Duplicate Program</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              New Program Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-600 mt-1">Original: {currentName}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-500 text-white font-medium py-3 rounded-lg hover:bg-gray-600 active:bg-gray-700 disabled:bg-gray-400"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400"
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
