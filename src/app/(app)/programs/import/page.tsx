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
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.push("/programs")}
            className="text-2xl text-muted hover:text-white"
            aria-label="Back"
          >
            {"<"}
          </button>
          <h1 className="text-2xl font-bold text-white">Import Program</h1>
        </div>
      </div>

      <div className="max-w-2xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg border border-accent/50 bg-accent/10 p-4">
          <h2 className="mb-3 font-semibold text-white">How to Format</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted">
            <li>Start each day with <code className="rounded bg-zinc-900 px-1 font-mono text-xs text-white">[Day Name]</code></li>
            <li>Format exercises as: <code className="rounded bg-zinc-900 px-1 font-mono text-xs text-white">Exercise | Scheme | Notes</code></li>
            <li>Scheme and notes are optional</li>
            <li>Each line is one exercise</li>
          </ol>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 font-semibold text-white">Sample Format:</h3>
          <pre className="whitespace-pre-wrap break-words rounded border border-border bg-zinc-950 p-3 font-mono text-xs text-muted">
{`[Monday]
Back Squat | 4x2
Bench Press | 5x5
Rows | 3x8

[Wednesday]
Deadlift | 1x5 + 5x3
Pull-ups | 3x8 | Assisted if needed`}
          </pre>
        </div>

        <div className="mb-6">
          <label htmlFor="text" className="mb-2 block text-sm font-medium text-muted">
            Paste your program text
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="[Day Name]&#10;Exercise Name | Scheme | Notes&#10;..."
            rows={10}
            className="w-full rounded-lg border border-border bg-zinc-950 px-4 py-3 font-mono text-base text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/programs")}
            className="flex-1 rounded-lg border border-border bg-zinc-700 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-600 active:bg-zinc-500 disabled:bg-zinc-700/60"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            className="flex-1 rounded-lg bg-accent py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent-hover disabled:bg-zinc-600"
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? "Parsing..." : "Preview"}
          </button>
        </div>
      </div>
    </div>
  );
}
