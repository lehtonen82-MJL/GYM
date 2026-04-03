"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseProgram } from "@/lib/programParser";

export default function ImportPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleParse = async () => {
    setError("");

    if (!text.trim()) {
      setError("Please paste a program text");
      return;
    }

    try {
      setIsLoading(true);
      const result = parseProgram(text);

      if (result.days.length === 0) {
        setError("No days found in the text. Make sure to use [Day Name] format.");
        return;
      }

      // Store in sessionStorage for preview page
      sessionStorage.setItem(
        "__import_preview",
        JSON.stringify({
          text,
          ...result,
        })
      );

      router.push("/programs/import/preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse program");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/programs")}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Import Program</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-2xl">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-3">How to Format</h2>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Start each day with <code className="bg-white px-1 rounded font-mono text-xs">[Day Name]</code></li>
            <li>Format exercises as: <code className="bg-white px-1 rounded font-mono text-xs">Exercise | Scheme | Notes</code></li>
            <li>Scheme and notes are optional</li>
            <li>Each line is one exercise</li>
          </ol>
        </div>

        {/* Sample */}
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">Sample Format:</h3>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-mono bg-white p-3 rounded border border-gray-300">
{`[Monday]
Back Squat | 4x2
Bench Press | 5x5
Rows | 3x8

[Wednesday]
Deadlift | 1x5 + 5x3
Pull-ups | 3x8 | Assisted if needed`}
          </pre>
        </div>

        {/* Textarea */}
        <div className="mb-6">
          <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
            Paste your program text
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="[Day Name]&#10;Exercise Name | Scheme | Notes&#10;..."
            rows={10}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            disabled={isLoading}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/programs")}
            className="flex-1 bg-gray-500 text-white font-medium py-3 rounded-lg hover:bg-gray-600 active:bg-gray-700 disabled:bg-gray-400 text-base transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            className="flex-1 bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 text-base transition-colors"
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? "Parsing..." : "Preview"}
          </button>
        </div>
      </div>
    </div>
  );
}
