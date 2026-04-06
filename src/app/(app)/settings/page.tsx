"use client";

import { useSettings } from "@/lib/settings";

export default function SettingsPage() {
  const { navPosition, setNavPosition, debugBorders, setDebugBorders } = useSettings();

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
