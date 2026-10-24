"use client";

import { useEffect, useState } from "react";
import { formatPace } from "@/lib/format";

type Props = {
  /** Epoch ms when the rest is over; a new value restarts the countdown. */
  endsAt: number;
  onAdd: (seconds: number) => void;
  onDismiss: () => void;
};

/** Rest countdown shown in the active exercise card (Phase 5.2). */
export default function RestTimer({ endsAt, onAdd, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = remaining === 0;

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        clearInterval(id);
        try { navigator.vibrate?.([200, 100, 200]); } catch {}
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div
      role="timer"
      aria-live={done ? "assertive" : "off"}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
        done ? "bg-green-950/40 border-green-800/60" : "bg-blue-950/40 border-blue-800/50"
      }`}
    >
      <span className={`text-sm font-semibold ${done ? "text-green-400" : "text-blue-300"}`}>
        {done ? "Rest over — go!" : "Rest"}
      </span>
      {!done && <span className="text-white font-mono font-bold text-lg tabular-nums">{formatPace(remaining)}</span>}
      <div className="ml-auto flex gap-2">
        {!done && (
          <button
            type="button"
            onClick={() => onAdd(15)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 active:bg-zinc-700"
          >
            +15s
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 active:bg-zinc-700"
        >
          {done ? "OK" : "Skip"}
        </button>
      </div>
    </div>
  );
}
