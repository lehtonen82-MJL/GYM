"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserStorage, saveStartResult } from "@/lib/workoutSession";
import { startDeloadWorkout } from "@/lib/actions";
import { useSettings } from "@/lib/settings";
import type { WorkoutDay } from "@/lib/types";
import { formatShortDate } from "@/lib/format";

type DeloadTemplate = {
  mode: "normal" | "compact";
  additionalDayIds: string[];
  savedAt: string;
};

function templateKey(programId: string) {
  return `deload-template-${programId}`;
}

function loadTemplate(programId: string): DeloadTemplate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(templateKey(programId));
    if (!raw) return null;
    return JSON.parse(raw) as DeloadTemplate;
  } catch {
    return null;
  }
}

function saveTemplate(programId: string, t: DeloadTemplate) {
  localStorage.setItem(templateKey(programId), JSON.stringify(t));
}

type Props = {
  programId: string;
  allDays: WorkoutDay[];
  /** The day that is scheduled for today (if any) — used as primary anchor */
  primaryDayId: string;
  onClose: () => void;
};

export default function DeloadSetupModal({ programId, allDays, primaryDayId, onClose }: Props) {
  const router = useRouter();
  const { deloadWeightPct, deloadSetPct, deloadReduceWarmups } = useSettings();
  const [loading, setLoading] = useState(false);

  // Setup state
  const [mode, setMode] = useState<"normal" | "compact">("normal");
  const [additionalDayIds, setAdditionalDayIds] = useState<string[]>([]);
  const [remember, setRemember] = useState(true);

  // Template flow
  const [savedTemplate, setSavedTemplate] = useState<DeloadTemplate | null>(null);
  const [showModify, setShowModify] = useState(false);

  useEffect(() => {
    const t = loadTemplate(programId);
    setSavedTemplate(t);
    if (t) {
      setMode(t.mode);
      setAdditionalDayIds(t.additionalDayIds);
    }
  }, [programId]);

  // Other days = all days except the primary anchor
  const otherDays = allDays.filter((d) => d.id !== primaryDayId);
  const primaryDay = allDays.find((d) => d.id === primaryDayId);

  function toggleDay(dayId: string) {
    setAdditionalDayIds((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  }

  async function handleStart() {
    setLoading(true);
    try {
      if (remember) {
        saveTemplate(programId, {
          mode,
          additionalDayIds: mode === "compact" ? additionalDayIds : [],
          savedAt: new Date().toISOString(),
        });
      }
      const extra = mode === "compact" ? additionalDayIds : [];
      const result = await startDeloadWorkout(primaryDayId, extra, deloadWeightPct, deloadSetPct, deloadReduceWarmups);
      if (result) {
        saveStartResult(browserStorage, result);
        // Mark additional merged days as done for this week so ProgramSlotsGrid can flag them
        if (extra.length > 0) {
          const now = new Date();
          const dow = now.getDay();
          const daysFromMonday = dow === 0 ? 6 : dow - 1;
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - daysFromMonday);
          weekStart.setHours(0, 0, 0, 0);
          localStorage.setItem(
            `week-compact-done-${programId}`,
            JSON.stringify({ weekStart: weekStart.toISOString(), dayIds: extra }),
          );
        }
        router.push(`/workout/${result.id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  // Quick-start from saved template
  function handleQuickStart() {
    void handleStart();
  }

  // Determine if we show the quick-start view or the setup view
  const isSetupView = !savedTemplate || showModify;

  const selectedDayNames = [
    primaryDay?.name ?? "Today",
    ...otherDays.filter((d) => additionalDayIds.includes(d.id)).map((d) => d.name),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl w-full max-w-md flex flex-col pb-6 max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div>
            <h2 className="text-white text-lg font-bold">🔄 Easy Week</h2>
            <p className="text-zinc-400 text-xs mt-0.5">{deloadSetPct}% fewer sets · {deloadWeightPct}% weight</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 active:text-white text-sm font-medium"
          >
            Cancel
          </button>
        </div>

        <div className="px-5 space-y-4 pb-2">
          {/* ── Quick-start view ── */}
          {!isSetupView && savedTemplate && (
            <>
              <div className="bg-zinc-800 rounded-2xl p-4 space-y-1">
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">
                  Saved setup
                </p>
                <p className="text-white font-semibold">
                  {savedTemplate.mode === "compact" && savedTemplate.additionalDayIds.length > 0
                    ? `Compact — ${selectedDayNames.join(" + ")}`
                    : "Normal schedule"}
                </p>
                <p className="text-zinc-500 text-xs">
                  Saved {formatShortDate(savedTemplate.savedAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleQuickStart}
                disabled={loading}
                className="w-full py-4 rounded-xl bg-amber-500 text-black font-bold text-base active:opacity-80 disabled:opacity-50"
              >
                {loading ? "Starting…" : "Start Easy Week"}
              </button>

              <button
                type="button"
                onClick={() => setShowModify(true)}
                className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-sm active:bg-zinc-700"
              >
                Modify Setup
              </button>
            </>
          )}

          {/* ── Setup view ── */}
          {isSetupView && (
            <>
              {/* Mode picker */}
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">
                  Schedule
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["normal", "compact"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-colors ${
                        mode === m
                          ? "bg-amber-500/20 border-amber-500/60 text-amber-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 active:bg-zinc-700"
                      }`}
                    >
                      {m === "normal" ? "Normal days" : "Compact"}
                    </button>
                  ))}
                </div>
                <p className="text-zinc-500 text-xs">
                  {mode === "normal"
                    ? "Same training days, lighter loads. Train on the usual schedule."
                    : "Combine multiple days into one session — great if you want to finish the week faster."}
                </p>
              </div>

              {/* Compact: day selector */}
              {mode === "compact" && otherDays.length > 0 && (
                <div className="space-y-2">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">
                    Add to today&apos;s session
                  </p>
                  <div className="space-y-1.5">
                    {/* Primary day — always included, not togglable */}
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-black stroke-[2]">
                          <polyline points="1,5 4,8 11,1" />
                        </svg>
                      </div>
                      <span className="text-amber-300 font-medium text-sm">
                        {primaryDay?.name ?? "Today"} <span className="text-amber-500/60 font-normal">(primary)</span>
                      </span>
                    </div>
                    {/* Other days */}
                    {otherDays.map((day) => {
                      const selected = additionalDayIds.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                            selected
                              ? "bg-zinc-700 border-zinc-500 text-white"
                              : "bg-zinc-800 border-zinc-700 text-zinc-400 active:bg-zinc-700"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected ? "border-white bg-white" : "border-zinc-600"
                            }`}
                          >
                            {selected && (
                              <svg viewBox="0 0 12 10" className="w-3 h-3 fill-none stroke-zinc-900 stroke-[2]">
                                <polyline points="1,5 4,8 11,1" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">{day.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {additionalDayIds.length > 0 && (
                    <p className="text-zinc-500 text-xs">
                      Combined: {selectedDayNames.join(" + ")}
                    </p>
                  )}
                </div>
              )}

              {/* Remember toggle */}
              <button
                type="button"
                onClick={() => setRemember((v) => !v)}
                className="flex items-center gap-3 w-full"
              >
                <div
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                    remember ? "bg-amber-500" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      remember ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-zinc-300 text-sm">Remember this setup for next time</span>
              </button>

              {/* Start button */}
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={
                  loading || (mode === "compact" && additionalDayIds.length === 0 && otherDays.length > 0)
                }
                className="w-full py-4 rounded-xl bg-amber-500 text-black font-bold text-base active:opacity-80 disabled:opacity-40"
              >
                {loading
                  ? "Starting…"
                  : mode === "compact" && additionalDayIds.length > 0
                  ? `Start — ${selectedDayNames.join(" + ")}`
                  : "Start Easy Week"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
