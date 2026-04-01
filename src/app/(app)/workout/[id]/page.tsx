"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import WorkoutClient from "./WorkoutClient";
import type { StartWorkoutResult } from "@/lib/actions";
import { getWorkout } from "@/lib/actions";

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StartWorkoutResult | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1. Try sessionStorage (active workout)
      const stored = sessionStorage.getItem(`workout-${id}`);
      if (stored) {
        try {
          setData(JSON.parse(stored));
          setLoading(false);
          return;
        } catch { /* fall through */ }
      }

      // 2. Try fetching from server (viewing history)
      const result = await getWorkout(id);
      if (result) {
        setData({
          id,
          workout: result.workout,
          entries: result.entries,
          suggestions: {},
        });
        setReadOnly(true);
        setLoading(false);
        return;
      }

      // 3. Not found — redirect
      router.replace("/today");
    }
    load();
  }, [id, router]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted text-lg">Loading workout...</div>
      </div>
    );
  }

  return (
    <WorkoutClient
      workout={data.workout}
      entries={data.entries}
      suggestions={data.suggestions}
      readOnly={readOnly}
    />
  );
}
