"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WarningBadge, ImportPreviewCard } from "@/components/ImportPreviewCard";
import { saveImportedProgram, setActiveProgram, validateProgram } from "@/lib/actions";
import type { ParsedDay, ParserWarning } from "@/lib/programParser";
import type { ProgramMode } from "@/lib/types";

interface PreviewData {
  text: string;
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: ProgramMode;
}

type ValidationWarningItem = {
  type?: string;
  message: string;
};

export default function ImportPreviewPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarningItem[] | null>(null);
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null);
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
    } catch {
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
      const prog = await saveImportedProgram(programName.trim(), null, preview.detectedMode, preview.days);
      setCreatedProgramId(prog.id);

      try {
        const res = await validateProgram(prog.id, preview.days);
        if (res.warnings && res.warnings.length > 0) {
          setValidationWarnings(res.warnings);
          setIsSaving(false);
          return;
        }
      } catch (vErr) {
        setValidationWarnings([{ message: vErr instanceof Error ? vErr.message : String(vErr) }]);
        setIsSaving(false);
        return;
      }

      if (setAsActive) {
        await setActiveProgram(prog.id);
      }

      sessionStorage.removeItem("__import_preview");
      router.push("/programs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save program");
      setIsSaving(false);
    }
  };

  const handleProceedAnyway = async () => {
    setIsSaving(true);
    try {
      const progId = createdProgramId;
      if (!progId) {
        setError("No created program found to proceed with");
        setIsSaving(false);
        return;
      }
      if (setAsActive) {
        await setActiveProgram(progId);
      }
      sessionStorage.removeItem("__import_preview");
      router.push("/programs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to proceed");
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted">Loading preview...</div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted">{error || "Preview not available"}</p>
          <button
            onClick={() => router.push("/programs/import")}
            className="rounded-lg bg-accent px-6 py-2 font-medium text-on-accent hover:bg-accent-hover"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const hasWarnings = preview.warnings.length > 0;

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.push("/programs/import")}
            className="text-2xl text-muted hover:text-white"
            aria-label="Back"
          >
            {"<"}
          </button>
          <h1 className="text-2xl font-bold text-white">Preview</h1>
        </div>
      </div>

      <div className="max-w-2xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg border border-accent/50 bg-accent/10 p-4">
          <div className="mb-2 flex items-start justify-between">
            <h2 className="font-semibold text-white">Import Summary</h2>
            <span className="rounded bg-accent/20 px-2 py-1 text-xs text-accent">
              {preview.detectedMode === "weekday" ? "Weekday" : "Sessions"}
            </span>
          </div>
          <p className="text-sm text-muted">
            {preview.days.length} days - {preview.days.reduce((sum, d) => sum + d.exercises.length, 0)} exercises
          </p>
        </div>

        {hasWarnings && (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold text-white">Warnings ({preview.warnings.length})</h3>
            <div className="space-y-2">
              {preview.warnings.map((w, idx) => (
                <WarningBadge key={idx} type={w.type} message={w.message} />
              ))}
            </div>
          </div>
        )}

        {validationWarnings && (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold text-red-300">
              Validation Warnings ({validationWarnings.length})
            </h3>
            <div className="mb-4 space-y-2">
              {validationWarnings.map((w, idx: number) => (
                <div key={idx} className="rounded border border-yellow-500/60 bg-yellow-500/10 p-3 text-sm">
                  <div className="font-medium text-yellow-200">{w.type ?? "Warning"}</div>
                  <div className="mt-1 text-xs text-yellow-100">{w.message}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setValidationWarnings(null);
                  router.push("/programs/import");
                }}
                className="flex-1 rounded-lg border border-border bg-surface-hover py-3 text-base font-medium text-white hover:bg-surface-strong active:bg-surface-strong"
              >
                Fix Import
              </button>
              <button
                onClick={handleProceedAnyway}
                disabled={isSaving}
                className="flex-1 rounded-lg bg-orange-500 py-3 text-base font-medium text-white hover:bg-orange-600 active:bg-orange-700"
              >
                {isSaving ? "Proceeding..." : "Proceed Anyway"}
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-muted">
            Program Name *
          </label>
          <input
            id="name"
            type="text"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="w-full rounded-lg border border-border bg-deep px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={isSaving}
          />
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="h-4 w-4"
              disabled={isSaving}
            />
            <span className="text-sm text-white">Set as active program immediately</span>
          </label>
        </div>

        <div className="mb-6">
          <h3 className="mb-3 font-semibold text-white">Program Structure</h3>
          {preview.days.map((day, dayIdx) => (
            <ImportPreviewCard
              key={dayIdx}
              dayIndex={dayIdx}
              dayName={day.name}
              exerciseCount={day.exercises.length}
            >
              <div className="space-y-2">
                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="rounded border border-border bg-card p-3 text-sm">
                    <div className="font-medium text-white">
                      {ex.name}
                      {ex.supersetGroup && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent align-middle">
                          Superset {ex.supersetGroup}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-muted">
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

        <form onSubmit={handleSave} className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/programs/import")}
            className="flex-1 rounded-lg border border-border bg-surface-hover py-3 text-base font-medium text-white transition-colors hover:bg-surface-strong active:bg-surface-strong disabled:bg-surface-hover/60"
            disabled={isSaving}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSaving || !programName.trim()}
            className="flex-1 rounded-lg bg-success py-3 text-base font-medium text-on-accent transition-colors hover:bg-accent active:bg-accent disabled:bg-surface-strong"
          >
            {isSaving ? "Saving..." : "Save Program"}
          </button>
        </form>
      </div>
    </div>
  );
}
