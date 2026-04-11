"use client";

import { useEffect, useRef, useState } from "react";
import type { SetEntry } from "@/lib/types";

type Phase = "config" | "countdown" | "running" | "paused" | "done";

type Props = {
  defaultRounds: number;
  exerciseId: string;
  sets: SetEntry[];
  targetReps: number;
  onSetsChange: (sets: SetEntry[]) => void;
  onClose: () => void;
};

const STORAGE_KEY_PREFIX = "interval-timer-";

function loadSaved(exerciseId: string): { rounds: number; intervalMins: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + exerciseId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.rounds === "number" && typeof parsed.intervalMins === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSetting(exerciseId: string, rounds: number, intervalMins: number) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + exerciseId, JSON.stringify({ rounds, intervalMins }));
  } catch {
    // storage unavailable
  }
}

function playBeep(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // AudioContext not available
  }
}

export default function IntervalTimer({ defaultRounds, exerciseId, sets, targetReps, onSetsChange, onClose }: Props) {
  const saved = loadSaved(exerciseId);

  // Config state (editable before start)
  const [rounds, setRounds] = useState(Math.max(1, saved?.rounds ?? defaultRounds));
  const [intervalMins, setIntervalMins] = useState(saved?.intervalMins ?? 2);

  // Runtime state
  const [phase, setPhase] = useState<Phase>("config");
  const [currentRound, setCurrentRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(intervalMins * 60);
  const [showGo, setShowGo] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState(10);

  // Snapshot of config at start — used for display during run (no ref-in-render)
  const [activeRounds, setActiveRounds] = useState(rounds);
  const [activeIntervalSecs, setActiveIntervalSecs] = useState(intervalMins * 60);

  // Refs for setInterval callback only (stale closure prevention)
  const totalRoundsRef = useRef(rounds);
  const intervalSecsRef = useRef(intervalMins * 60);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Acquire / release screen wake lock based on phase
  useEffect(() => {
    async function acquireWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        }
      } catch {
        // not supported or permission denied — silent fail
      }
    }
    function releaseWakeLock() {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }

    if (phase === "running" || phase === "countdown") {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => { releaseWakeLock(); };
  }, [phase]);

  // Re-acquire wake lock when tab becomes visible again (iOS Safari drops it on hide)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && phase === "running") {
        (async () => {
          try {
            if ("wakeLock" in navigator && !wakeLockRef.current) {
              wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
            }
          } catch {
            // ignore
          }
        })();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [phase]);

  function triggerGo() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    playBeep(audioCtxRef);
    setShowGo(true);
    setTimeout(() => setShowGo(false), 900);
  }

  function startTimer() {
    saveSetting(exerciseId, rounds, intervalMins);

    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {
        // ignore
      }
    }

    const secs = intervalMins * 60;
    totalRoundsRef.current = rounds;
    intervalSecsRef.current = secs;

    setActiveRounds(rounds);
    setActiveIntervalSecs(secs);
    setCurrentRound(1);
    setSecondsLeft(secs);
    setCountdownLeft(10);
    setPhase("countdown");
  }

  function pauseTimer() {
    setPhase("paused");
  }

  function resumeTimer() {
    setPhase("running");
  }

  function stopTimer() {
    setPhase("config");
    setCurrentRound(1);
    setSecondsLeft(intervalMins * 60);
  }

  // 10-second get-ready countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    const id = setInterval(() => {
      setCountdownLeft((prev) => {
        if (prev <= 1) {
          setPhase("running");
          triggerGo();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]); // triggerGo is stable

  useEffect(() => {
    if (phase !== "running") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Round finished — advance
          setCurrentRound((r) => {
            const next = r + 1;
            if (next > totalRoundsRef.current) {
              setPhase("done");
              triggerGo();
              return r;
            }
            triggerGo();
            return next;
          });
          return intervalSecsRef.current;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]); // triggerGo is stable; refs are intentionally excluded

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = activeIntervalSecs > 0 ? 1 - secondsLeft / activeIntervalSecs : 0;
  const circumference = 2 * Math.PI * 54;

  // ── Countdown screen ────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-6">
        <p className="text-zinc-400 text-lg tracking-widest uppercase">Get ready</p>
        <div className="relative w-44 h-44 sm:w-60 sm:h-60">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#27272a" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="#f59e0b"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - countdownLeft / 10)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-6xl sm:text-7xl font-mono font-bold">{countdownLeft}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={stopTimer}
          className="w-28 h-14 bg-red-900/50 rounded-2xl text-red-400 font-bold active:bg-red-900/70"
        >
          Cancel
        </button>
      </div>
    );
  }
  const strokeDashoffset = circumference * (1 - progress);

  // ── Config screen ────────────────────────────────────────────
  if (phase === "config") {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
        <div className="bg-zinc-900 rounded-t-3xl w-full max-w-md p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-xl font-bold">Interval Timer</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 text-2xl w-10 h-10 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* Rounds */}
          <div>
            <p className="text-zinc-400 text-sm mb-2">Rounds</p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setRounds((r) => Math.max(1, r - 1))}
                className="w-11 h-11 bg-zinc-800 rounded-xl text-white text-2xl active:bg-zinc-700"
              >
                −
              </button>
              <span className="text-white text-3xl font-bold w-12 text-center">
                {rounds}
              </span>
              <button
                type="button"
                onClick={() => setRounds((r) => r + 1)}
                className="w-11 h-11 bg-zinc-800 rounded-xl text-white text-2xl active:bg-zinc-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Interval */}
          <div>
            <p className="text-zinc-400 text-sm mb-2">Interval (minutes)</p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIntervalMins((m) => Math.max(1, m - 1))}
                className="w-11 h-11 bg-zinc-800 rounded-xl text-white text-2xl active:bg-zinc-700"
              >
                −
              </button>
              <span className="text-white text-3xl font-bold w-12 text-center">
                {intervalMins}
              </span>
              <button
                type="button"
                onClick={() => setIntervalMins((m) => m + 1)}
                className="w-11 h-11 bg-zinc-800 rounded-xl text-white text-2xl active:bg-zinc-700"
              >
                +
              </button>
            </div>
          </div>

          <p className="text-zinc-500 text-sm">
            Starts rep 1 immediately, then signals every {intervalMins} min until {rounds} reps done.
          </p>

          <button
            type="button"
            onClick={startTimer}
            className="w-full h-14 bg-blue-600 rounded-2xl text-white font-bold text-lg active:bg-blue-700"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  // ── Set log helper (shared between running/paused/done) ────
  function renderSetLog(highlightRound: number | null) {
    return (
      <div className="w-full max-w-sm px-4 space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Sets</p>
        {sets.map((set) => {
          const isActive = highlightRound === set.set_number;
          return (
            <div
              key={set.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                set.completed
                  ? "bg-green-950/40 border border-green-800/50"
                  : isActive
                  ? "bg-blue-950/50 border border-blue-700/60"
                  : "bg-zinc-900 border border-transparent"
              }`}
            >
              {/* Set number */}
              <span className="text-zinc-500 text-sm w-4 shrink-0">{set.set_number}</span>

              {/* Weight */}
              <input
                type="number"
                inputMode="decimal"
                value={set.weight_kg ?? ""}
                placeholder="kg"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onSetsChange(
                    sets.map((s) =>
                      s.id === set.id ? { ...s, weight_kg: isNaN(val) ? null : val } : s
                    )
                  );
                }}
                className="w-16 h-9 text-center text-sm font-semibold bg-zinc-800 rounded-lg text-white border border-zinc-700 focus:border-blue-500 focus:outline-none"
              />

              <span className="text-zinc-600 text-xs">kg ×</span>

              {/* Reps */}
              <input
                type="number"
                inputMode="numeric"
                value={set.reps || ""}
                placeholder={String(targetReps)}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onSetsChange(
                    sets.map((s) =>
                      s.id === set.id ? { ...s, reps: isNaN(val) ? null : val } : s
                    )
                  );
                }}
                className="w-14 h-9 text-center text-sm font-semibold bg-zinc-800 rounded-lg text-white border border-zinc-700 focus:border-blue-500 focus:outline-none"
              />

              {/* Pass / Fail toggle */}
              <button
                type="button"
                onClick={() =>
                  onSetsChange(
                    sets.map((s) =>
                      s.id === set.id ? { ...s, completed: !s.completed } : s
                    )
                  )
                }
                className={`ml-auto w-9 h-9 rounded-lg text-sm font-bold shrink-0 ${
                  set.completed
                    ? "bg-green-600 text-white"
                    : "bg-zinc-800 text-zinc-500 active:bg-zinc-700"
                }`}
              >
                {set.completed ? "✓" : "✗"}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto flex flex-col items-center justify-start pt-12 pb-[max(2.5rem,env(safe-area-inset-bottom))] px-4 gap-5">
        <div className="text-center space-y-1">
          <div className="text-5xl">✓</div>
          <h2 className="text-white text-2xl font-bold">Done!</h2>
          <p className="text-zinc-400">
            {activeRounds} round{activeRounds !== 1 ? "s" : ""} completed
          </p>
        </div>

        {renderSetLog(null)}

        <button
          type="button"
          onClick={onClose}
          className="w-full max-w-sm h-12 bg-green-600 rounded-2xl text-white font-bold active:bg-green-700"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Running / Paused screen ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto flex flex-col items-center justify-start pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] gap-4">
      {/* Go flash */}
      {showGo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-green-400 text-7xl font-black animate-pulse">
            GO!
          </span>
        </div>
      )}

      <p className="text-zinc-400 text-lg">
        Round{" "}
        <span className="text-white font-bold text-2xl">{currentRound}</span>
        <span className="text-zinc-500"> / {activeRounds}</span>
      </p>

      {/* Circular countdown */}
      <div className="relative w-44 h-44 sm:w-60 sm:h-60">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={phase === "paused" ? "#71717a" : "#3b82f6"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-white text-4xl sm:text-5xl font-mono font-bold tracking-tight">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          {phase === "paused" && (
            <span className="text-zinc-500 text-xs uppercase tracking-widest">
              paused
            </span>
          )}
        </div>
      </div>

      {/* Next round hint */}
      <p className="text-zinc-500 text-sm">
        {currentRound < activeRounds
          ? `Rep ${currentRound + 1} in ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
          : "Last round"}
      </p>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={phase === "running" ? pauseTimer : resumeTimer}
          className="w-28 h-14 bg-zinc-800 rounded-2xl text-white font-bold active:bg-zinc-700"
        >
          {phase === "running" ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={stopTimer}
          className="w-28 h-14 bg-red-900/50 rounded-2xl text-red-400 font-bold active:bg-red-900/70"
        >
          Stop
        </button>
      </div>

      {/* Set log */}
      {renderSetLog(currentRound)}
    </div>
  );
}
