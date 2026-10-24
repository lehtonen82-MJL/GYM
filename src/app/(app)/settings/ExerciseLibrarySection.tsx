"use client";

import { useEffect, useState } from "react";
import { getUnlinkedExercises, relinkAllExercises } from "@/lib/actions";

/**
 * Settings → Exercise library (Phase E.6/E.7): lists exercises the library doesn't
 * recognize (no equipment / muscle data) and re-runs matching after library updates.
 */
export default function ExerciseLibrarySection() {
  const [unlinked, setUnlinked] = useState<{ id: string; name: string }[] | null>(null);
  const [relinking, setRelinking] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUnlinkedExercises()
      .then((list) => { if (!cancelled) setUnlinked(list); })
      .catch(() => { if (!cancelled) setUnlinked([]); });
    return () => { cancelled = true; };
  }, []);

  async function handleRelink() {
    setRelinking(true);
    setResult(null);
    try {
      const { linked, remaining } = await relinkAllExercises();
      setResult(linked === 0 ? "No new matches." : `Linked ${linked} exercise${linked === 1 ? "" : "s"}.`);
      setUnlinked(remaining === 0 ? [] : await getUnlinkedExercises());
    } catch {
      setResult("Re-link failed. Please try again.");
    } finally {
      setRelinking(false);
    }
  }

  return (
    <section className="bg-card rounded-2xl border border-border divide-y divide-border">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Exercise library</h2>
        <p className="text-muted text-xs mt-1">
          Recognized exercises get equipment and muscle data for history and suggestions
        </p>
      </div>

      <div className="p-4 space-y-3">
        {unlinked === null ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : unlinked.length === 0 ? (
          <p className="text-white text-sm">All your exercises are recognized.</p>
        ) : (
          <>
            <p className="text-white text-sm">
              {unlinked.length} exercise{unlinked.length === 1 ? " is" : "s are"} not in the library:
            </p>
            <ul className="scrollbar-hidden max-h-40 overflow-y-auto text-sm text-muted space-y-1">
              {unlinked.map((ex) => (
                <li key={ex.id}>{ex.name}</li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={handleRelink}
          disabled={relinking || unlinked === null || unlinked.length === 0}
          className="w-full py-3 rounded-xl border-2 border-border text-sm font-medium text-white active:bg-zinc-800 disabled:opacity-40"
        >
          {relinking ? "Re-linking…" : "Re-link exercises"}
        </button>
        {result && <p className="text-muted text-xs" role="status">{result}</p>}
      </div>
    </section>
  );
}
