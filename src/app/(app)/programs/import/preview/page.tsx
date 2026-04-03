"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WarningBadge, ImportPreviewCard } from "@/components/ImportPreviewCard";
import { saveImportedProgram, setActiveProgram } from "@/lib/actions";
import type { ParsedDay, ParserWarning } from "@/lib/programParser";
import type { ProgramMode } from "@/lib/types";

interface PreviewData {
  text: string;
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: ProgramMode;
}

export default function ImportPreviewPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [programName, setProgramName] = useState("");
  const [setAsActive, setSetAsActive] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem("__import_preview");
    if (!data) {
      setError("No preview data found. Please start from the import page.");
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(data);
      setPreview(parsed);
      setProgramName(`Imported Program ${new Date().toLocaleDateString()}`);
    } catch (err) {
      setError("Failed to load preview data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !programName.trim()) return;

    setIsSaving(true);
    setError("");

    try {
      const prog = await saveImportedProgram(
        programName.trim(),
        null,
        preview.detectedMode,
        preview.days
      );

      if (setAsActive) {
        await setActiveProgram(prog.id);
      }

      // Clear preview data
      sessionStorage.removeItem("__import_preview");

      // Redirect to programs list
      router.push("/programs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save program");
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading preview...</div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error || "Preview not available"}</p>
          <button
            onClick={() => router.push("/programs/import")}
            className="bg-blue-500 text-white font-medium px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const hasWarnings = preview.warnings.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/programs/import")}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Preview</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-2xl">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Mode & Stats */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-semibold text-blue-900">Import Summary</h2>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {preview.detectedMode === "weekday" ? "📅 Weekday" : "🔄 Sessions"}
            </span>
          </div>
          <p className="text-sm text-blue-800">
            {preview.days.length} days • {preview.days.reduce((sum, d) => sum + d.exercises.length, 0)} exercises
          </p>
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Warnings ({preview.warnings.length})</h3>
            <div className="space-y-2">
              {preview.warnings.map((w, idx) => (
                <WarningBadge key={idx} type={w.type} message={w.message} />
              ))}
            </div>
          </div>
        )}

        {/* Program Name Input */}
        <div className="mb-6 bg-white rounded-lg p-4 border border-gray-200">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Program Name *
          </label>
          <input
            id="name"
            type="text"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving}
          />
        </div>

        {/* Set as Active Checkbox */}
        <div className="mb-6 bg-white rounded-lg p-4 border border-gray-200">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="w-4 h-4"
              disabled={isSaving}
            />
            <span className="text-sm text-gray-700">Set as active program immediately</span>
          </label>
        </div>

        {/* Days Preview */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Program Structure</h3>
          {preview.days.map((day, dayIdx) => (
            <ImportPreviewCard
              key={dayIdx}
              dayIndex={dayIdx}
              dayName={day.name}
              exerciseCount={day.exercises.length}
            >
              <div className="space-y-2">
                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="bg-gray-50 rounded p-3 text-sm">
                    <div className="font-medium text-gray-900">{ex.name}</div>
                    <div className="text-xs text-gray-600 mt-1 flex gap-3">
                      {ex.targetSets && <span>{ex.targetSets} sets</span>}
                      {ex.schemeText && <span>{ex.schemeText}</span>}
                      {ex.targetRepsText && <span>{ex.targetRepsText} reps</span>}
                      {ex.notes && <span className="italic">{ex.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ImportPreviewCard>
          ))}
        </div>

        {/* Buttons */}
        <form onSubmit={handleSave} className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/programs/import")}
            className="flex-1 bg-gray-500 text-white font-medium py-3 rounded-lg hover:bg-gray-600 active:bg-gray-700 disabled:bg-gray-400 text-base transition-colors"
            disabled={isSaving}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSaving || !programName.trim()}
            className="flex-1 bg-green-500 text-white font-medium py-3 rounded-lg hover:bg-green-600 active:bg-green-700 disabled:bg-gray-400 text-base transition-colors"
          >
            {isSaving ? "Saving..." : "Save Program"}
          </button>
        </form>
      </div>
    </div>
  );
}
