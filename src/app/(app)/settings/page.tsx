"use client";

import { useSettings } from "@/lib/settings";

export default function SettingsPage() {
  const {
    navPosition, setNavPosition,
    debugBorders, setDebugBorders,
    deloadWeightPct, setDeloadWeightPct,
    deloadSetPct, setDeloadSetPct,
    deloadReduceWarmups, setDeloadReduceWarmups,
  } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-muted text-sm mt-1">Adjust app preferences</p>
      </div>

      {/* Navigation */}
      <section className="bg-card rounded-2xl border border-border divide-y divide-border">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Navigation</h2>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-white font-medium">Tab bar position</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setNavPosition("bottom")}
              className={`py-3 rounded-xl border-2 text-sm font-medium transition ${
                navPosition === "bottom"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted"
              }`}
            >
              ⬇ Bottom
            </button>
            <button
              onClick={() => setNavPosition("top")}
              className={`py-3 rounded-xl border-2 text-sm font-medium transition ${
                navPosition === "top"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted"
              }`}
            >
              ⬆ Top
            </button>
          </div>
        </div>
      </section>

      {/* Easy Week */}
      <section className="bg-card rounded-2xl border border-border divide-y divide-border">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">🔄 Easy Week</h2>
          <p className="text-muted text-xs mt-1">Applied when you start a recovery week workout</p>
        </div>

        {/* Weight % */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-white font-medium">Weight</p>
            <p className="text-muted text-xs mt-0.5">Use this % of your usual load</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDeloadWeightPct(Math.max(50, deloadWeightPct - 5))}
              className="w-9 h-9 rounded-xl bg-zinc-800 text-white font-bold text-lg active:bg-zinc-700 flex items-center justify-center"
            >
              −
            </button>
            <span className="w-12 text-center text-white font-semibold tabular-nums">{deloadWeightPct}%</span>
            <button
              onClick={() => setDeloadWeightPct(Math.min(95, deloadWeightPct + 5))}
              className="w-9 h-9 rounded-xl bg-zinc-800 text-white font-bold text-lg active:bg-zinc-700 flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Set % */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-white font-medium">Sets</p>
            <p className="text-muted text-xs mt-0.5">Keep this % of your normal set count</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDeloadSetPct(Math.max(25, deloadSetPct - 5))}
              className="w-9 h-9 rounded-xl bg-zinc-800 text-white font-bold text-lg active:bg-zinc-700 flex items-center justify-center"
            >
              −
            </button>
            <span className="w-12 text-center text-white font-semibold tabular-nums">{deloadSetPct}%</span>
            <button
              onClick={() => setDeloadSetPct(Math.min(90, deloadSetPct + 5))}
              className="w-9 h-9 rounded-xl bg-zinc-800 text-white font-bold text-lg active:bg-zinc-700 flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="px-4 py-3 bg-amber-500/5">
          <p className="text-amber-400 text-xs">
            Example: 2 warmup + 4 work sets × 100 kg →{" "}
            <strong>
              {deloadReduceWarmups ? Math.max(0, Math.ceil(2 * deloadSetPct / 100)) : 2} warmup
              {" + "}
              {Math.max(1, Math.ceil(4 * deloadSetPct / 100))} work sets × {Math.round(100 * deloadWeightPct / 100 / 2.5) * 2.5} kg
            </strong>
          </p>
        </div>

        {/* Reduce warmup sets toggle */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-white font-medium">Reduce warmup sets</p>
            <p className="text-muted text-xs mt-0.5">
              {deloadReduceWarmups
                ? "Warmup count is also cut by the sets %"
                : "Warmup weight is reduced, count stays the same"}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={deloadReduceWarmups}
            onClick={() => setDeloadReduceWarmups(!deloadReduceWarmups)}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${deloadReduceWarmups ? "bg-amber-500" : "bg-zinc-700"}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                deloadReduceWarmups ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Developer */}
      <section className="bg-card rounded-2xl border border-border divide-y divide-border">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Developer</h2>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Debug borders</p>
            <p className="text-muted text-xs mt-0.5">Highlight layout areas with coloured outlines</p>
          </div>
          <button
            role="switch"
            aria-checked={debugBorders}
            onClick={() => setDebugBorders(!debugBorders)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              debugBorders ? "bg-accent" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                debugBorders ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
