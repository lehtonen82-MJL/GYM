"use client";

import { useEffect, useState } from "react";
import { getBodyWeights, saveBodyWeight } from "@/lib/actions";
import { bodyWeightSummary, type BodyWeight } from "@/lib/bodyWeight";
import { localDay } from "@/lib/calendar";
import { formatShortDate, formatWeight, fromDisplay, toDisplay } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import MiniChart from "./MiniChart";

/** Body weight log: today's entry, latest weight with its changes, and the trend. */
export default function BodyTab() {
  const { unit } = useSettings();
  const [entries, setEntries] = useState<BodyWeight[] | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getBodyWeights()
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch(() => { if (!cancelled) setError("Could not load your body weight."); });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    const value = Number(input.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter your weight as a number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const day = localDay(new Date());
      const weightKg = fromDisplay(value, unit);
      await saveBodyWeight(day, weightKg);
      setEntries((prev) => [...(prev ?? []).filter((e) => e.measured_on !== day), { measured_on: day, weight_kg: weightKg }]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const summary = entries ? bodyWeightSummary(entries) : null;
  const sorted = entries ? [...entries].sort((a, b) => a.measured_on.localeCompare(b.measured_on)) : [];
  const change = (kg: number | null) =>
    kg === null ? "–" : `${kg > 0 ? "+" : kg < 0 ? "−" : "±"}${formatWeight(Math.abs(kg), unit)}`;
  const dayLabel = (day: string) => formatShortDate(`${day}T00:00`);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <h2 className="text-white font-semibold">Today&apos;s weight</h2>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={unit === "kg" ? "e.g. 82.4" : "e.g. 181.6"}
            aria-label={`Body weight in ${unit}`}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 text-white border border-zinc-800 focus:border-blue-500 focus:outline-none text-base placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || input.trim() === ""}
            className="px-5 rounded-xl bg-accent text-white font-semibold disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-muted text-xs">One entry per day; saving again today replaces it.</p>
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
      </div>

      {!entries ? (
        !error && <div className="bg-card rounded-2xl border border-border p-4"><p className="text-muted text-center py-8">Loading...</p></div>
      ) : !summary ? (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-muted text-center py-8">No entries yet. Log your weight above to start the trend.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Latest", value: formatWeight(summary.latest.weight_kg, unit), sub: dayLabel(summary.latest.measured_on) },
              { label: "Since last", value: change(summary.sincePrevious), sub: "previous entry" },
              { label: "30 days", value: change(summary.since30Days), sub: "about a month" },
            ].map((tile) => (
              <div key={tile.label} className="bg-card rounded-xl border border-border p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted">{tile.label}</p>
                <p className="text-white font-semibold">{tile.value}</p>
                <p className="text-[10px] text-muted">{tile.sub}</p>
              </div>
            ))}
          </div>

          {sorted.length >= 2 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="text-white font-semibold mb-2">Trend</h3>
              <MiniChart
                data={sorted.map((e) => ({ date: e.measured_on, weight_kg: e.weight_kg }))}
                getValue={(d) => toDisplay(d.weight_kg, unit)}
                color="#3b82f6"
                unit={unit}
                formatLabel={(v) => `${Math.round(v * 10) / 10}`}
              />
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="text-white font-semibold mb-2">Entries</h3>
            <ul className="divide-y divide-zinc-800">
              {[...sorted].reverse().slice(0, 10).map((e) => (
                <li key={e.measured_on} className="flex justify-between py-2 text-sm">
                  <span className="text-muted">{dayLabel(e.measured_on)}</span>
                  <span className="text-white">{formatWeight(e.weight_kg, unit)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
