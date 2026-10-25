"use client";

import { useEffect, useState } from "react";
import { getMuscleEntries } from "@/lib/actions";
import { formatVolume } from "@/lib/format";
import { MUSCLE_LABELS, weeklyMuscleSets, type MuscleEntry } from "@/lib/muscleVolume";
import { useSettings } from "@/lib/settings";

const WEEKS = 8;

/** Weekly sets per muscle: this week's sets as bars, the last 8 weeks as a small trend per muscle. */
export default function MusclesTab() {
  const { unit } = useSettings();
  const [entries, setEntries] = useState<MuscleEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const since = weeklyMuscleSets([], new Date(), WEEKS).weekStarts[0];
    getMuscleEntries(since)
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch((err) => {
        console.error("[MusclesTab] getMuscleEntries error:", err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return <Card><p className="text-muted text-center py-8">Could not load weekly sets.</p></Card>;
  }
  if (!entries) {
    return <Card><p className="text-muted text-center py-8">Loading...</p></Card>;
  }

  const { muscles } = weeklyMuscleSets(entries, new Date(), WEEKS);
  if (muscles.length === 0) {
    return <Card><p className="text-muted text-center py-8">No completed sets in the last {WEEKS} weeks.</p></Card>;
  }

  const thisWeek = (m: (typeof muscles)[number]) => m.weeklySets[WEEKS - 1];
  const maxThisWeek = Math.max(1, ...muscles.map(thisWeek));
  const maxAnyWeek = Math.max(1, ...muscles.flatMap((m) => m.weeklySets));

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-semibold">Weekly sets per muscle</h2>
        <span className="text-muted text-xs">this week · last {WEEKS} weeks</span>
      </div>
      <ul className="space-y-3">
        {muscles.map((m) => (
          <li key={m.muscle ?? "unlinked"}>
            <div className="flex items-baseline justify-between text-sm">
              <span className={m.muscle ? "text-white" : "text-muted"}>
                {m.muscle ? (MUSCLE_LABELS[m.muscle] ?? m.muscle) : "Unlinked"}
              </span>
              <span className="text-muted text-xs">
                <span className="text-white text-sm font-semibold">{thisWeek(m)}</span> sets
                {m.kgThisWeek > 0 && <> · {formatVolume(m.kgThisWeek, unit)}</>}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(thisWeek(m) / maxThisWeek) * 100}%` }}
                />
              </div>
              <div className="flex items-end gap-0.5 h-5" aria-label={`Sets per week: ${m.weeklySets.join(", ")}`}>
                {m.weeklySets.map((n, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-sm ${i === WEEKS - 1 ? "bg-accent" : "bg-surface-strong"}`}
                    style={{ height: `${Math.max(8, (n / maxAnyWeek) * 100)}%`, opacity: n === 0 ? 0.3 : 1 }}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted text-xs mt-4">
        Completed work sets of exercises whose primary muscle it is (Monday–Sunday).
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-card rounded-2xl border border-border p-4">{children}</div>;
}
