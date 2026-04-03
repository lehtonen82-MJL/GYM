"use client";

import { useSettings } from "@/lib/settings";

export default function SettingsPage() {
  const { navPosition, setNavPosition } = useSettings();

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
    </div>
  );
}
