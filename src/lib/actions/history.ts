"use server";

import type { Workout } from "@/lib/types";
import { DEMO_MODE, db, getUserId, mockStore, mockBonusCardio } from "./_shared";
import { MOCK_DAYS } from "./_mocks";
import { linkExerciseToLibraryInternal } from "./exercises";

// MOCK_HISTORY is only used in history functions
const MOCK_HISTORY: Workout[] = [
  {
    id: "past-1", user_id: "mock-user", workout_day_id: "day-6",
    started_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 3 * 86400000 + 75 * 60000).toISOString(),
    notes: "Felt strong today", created_at: "",
    workout_day: MOCK_DAYS.find((d) => d.id === "day-6"),
  },
  {
    id: "past-2", user_id: "mock-user", workout_day_id: "day-4",
    started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 5 * 86400000 + 60 * 60000).toISOString(),
    notes: null, created_at: "",
    workout_day: MOCK_DAYS.find((d) => d.id === "day-4"),
  },
  {
    id: "past-3", user_id: "mock-user", workout_day_id: "day-2",
    started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    completed_at: new Date(Date.now() - 7 * 86400000 + 90 * 60000).toISOString(),
    notes: "PR on snatch", created_at: "",
    workout_day: MOCK_DAYS.find((d) => d.id === "day-2"),
  },
];

export async function getWorkoutHistory(): Promise<Workout[]> {
  if (DEMO_MODE) {
    const completed = Array.from(mockStore.values())
      .filter((s) => s.workout.completed_at)
      .map((s) => s.workout)
      .reverse();
    return [...completed, ...MOCK_HISTORY];
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workouts")
    .select("*, workout_day:workout_days(*)")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(50);

  return data ?? [];
}

/**
 * Export complete workout history as structured JSON for AI analysis.
 */
export async function exportWorkoutHistory(): Promise<string> {
  const supabase = await db();
  const userId = await getUserId();

  // Fetch ALL completed workouts (no limit)
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, started_at, completed_at, notes, is_deload, workout_day:workout_days(name, day_label)")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: true });

  if (!workouts || workouts.length === 0) return JSON.stringify({ workouts: [], summary: {} }, null, 2);

  const workoutIds = workouts.map((w: { id: string }) => w.id);

  // Fetch all exercise entries with sets in one query
  const { data: entries } = await supabase
    .from("workout_exercise_entries")
    .select("id, workout_id, exercise_id, original_exercise_id, exercise:exercises!workout_exercise_entries_exercise_id_fkey(name), original_exercise:exercises!workout_exercise_entries_original_exercise_id_fkey(name), set_entries(set_number, weight_kg, reps, completed, is_warmup, too_heavy, too_heavy_reps)")
    .eq("user_id", userId)
    .in("workout_id", workoutIds);

  // Fetch bonus cardio
  const { data: cardioRows } = await supabase
    .from("workout_bonus_cardio")
    .select("workout_id, machine_type, distance_m, duration_seconds, pace_per_500_seconds, calories, stroke_rate, avg_watts")
    .eq("user_id", userId)
    .in("workout_id", workoutIds);

  // Group entries by workout
  type RawEntry = {
    id: string;
    workout_id: string;
    exercise_id: string;
    original_exercise_id: string | null;
    exercise: { name: string } | null;
    original_exercise: { name: string } | null;
    set_entries: {
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      completed: boolean;
      is_warmup: boolean | null;
      too_heavy: boolean | null;
      too_heavy_reps: number | null;
    }[];
  };
  const entriesByWorkout = new Map<string, RawEntry[]>();
  for (const e of (entries ?? []) as unknown as RawEntry[]) {
    const list = entriesByWorkout.get(e.workout_id) ?? [];
    list.push(e);
    entriesByWorkout.set(e.workout_id, list);
  }

  type CardioRow = { workout_id: string; machine_type: string; distance_m: number | null; duration_seconds: number | null; pace_per_500_seconds: number | null; calories: number | null; stroke_rate: number | null; avg_watts: number | null };
  const cardioByWorkout = new Map<string, CardioRow>();
  for (const c of (cardioRows ?? []) as CardioRow[]) {
    cardioByWorkout.set(c.workout_id, c);
  }

  // Build per-exercise progression tracking
  const exerciseProgression: Record<string, string[]> = {};
  const exercisePRs: Record<string, { weight: number; reps: number; date: string }> = {};

  // Build workout records
  type RawWorkout = { id: string; started_at: string; completed_at: string | null; notes: string | null; is_deload: boolean | null; workout_day: { name: string; day_label: string } | null };
  const workoutRecords = (workouts as unknown as RawWorkout[]).map((w) => {
    const wEntries = entriesByWorkout.get(w.id) ?? [];
    const startDate = new Date(w.started_at);
    const endDate = w.completed_at ? new Date(w.completed_at) : null;
    const durationMin = endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : null;

    const exercises = wEntries.map((e) => {
      const sets = (e.set_entries ?? []).sort((a, b) => a.set_number - b.set_number);
      const workSets = sets.filter((s) => !s.is_warmup);
      const warmupSets = sets.filter((s) => s.is_warmup);

      // Volume = sum(weight * reps) for work sets
      const totalVolume = workSets.reduce((sum, s) => sum + ((s.weight_kg ?? 0) * (s.reps ?? 0)), 0);
      const topWorkSet = workSets.reduce((best, s) => ((s.weight_kg ?? 0) > (best.weight_kg ?? 0) ? s : best), workSets[0]);
      const tooHeavyCount = workSets.filter((s) => s.too_heavy).length;

      const exName = e.exercise?.name ?? "Unknown";
      const dateStr = startDate.toISOString().split("T")[0];

      // Track progression — compact: "date:topWeight×reps:vol:sets(:⚠N)"
      if (!exerciseProgression[exName]) exerciseProgression[exName] = [];
      if (workSets.length > 0) {
        let entry = `${dateStr}:${topWorkSet?.weight_kg ?? 0}×${topWorkSet?.reps ?? 0}:${totalVolume}:${workSets.length}`;
        if (tooHeavyCount > 0) entry += `:⚠${tooHeavyCount}`;
        exerciseProgression[exName].push(entry);
      }

      // Track PRs (heaviest weight successfully lifted with at least 1 rep)
      const completedWorkSets = workSets.filter((s) => s.completed && !s.too_heavy && (s.weight_kg ?? 0) > 0 && (s.reps ?? 0) > 0);
      if (completedWorkSets.length > 0) {
        const best = completedWorkSets.reduce((b, s) => ((s.weight_kg ?? 0) > (b.weight_kg ?? 0) ? s : b));
        const currentPR = exercisePRs[exName];
        if (!currentPR || (best.weight_kg ?? 0) > currentPR.weight) {
          exercisePRs[exName] = { weight: best.weight_kg ?? 0, reps: best.reps ?? 0, date: dateStr };
        }
      }

      // Compact set notation: "80×5", "80×4/5⚠" (too heavy, achieved 4 of target 5)
      const fmtSet = (s: typeof sets[number]) => {
        const wt = s.weight_kg ?? 0;
        const r = s.reps ?? 0;
        if (s.too_heavy) {
          const achieved = s.too_heavy_reps;
          return achieved != null ? `${wt}×${achieved}/${r}⚠` : `${wt}×${r}⚠`;
        }
        return `${wt}×${r}`;
      };

      return {
        exercise: exName,
        ...(e.original_exercise ? { swapped_from: e.original_exercise.name } : {}),
        ...(warmupSets.length > 0 ? { warmup: warmupSets.map(fmtSet) } : {}),
        sets: workSets.map(fmtSet),
        volume: totalVolume,
        top: topWorkSet ? `${topWorkSet.weight_kg}×${topWorkSet.reps}` : null,
      };
    });

    const cardio = cardioByWorkout.get(w.id);

    return {
      date: startDate.toISOString().split("T")[0],
      day: w.workout_day?.name ?? null,
      ...(durationMin ? { mins: durationMin } : {}),
      exercises,
      ...(cardio ? {
        cardio: `${cardio.machine_type} ${cardio.distance_m}m ${cardio.duration_seconds}s${cardio.pace_per_500_seconds ? ` pace:${cardio.pace_per_500_seconds}` : ""}${cardio.calories ? ` cal:${cardio.calories}` : ""}${cardio.avg_watts ? ` watts:${cardio.avg_watts}` : ""}`,
      } : {}),
      ...(w.is_deload ? { deload: true } : {}),
      ...(w.notes ? { notes: w.notes } : {}),
    };
  });

  // Overall stats
  const firstDate = (workouts as unknown as RawWorkout[])[0]?.started_at;
  const lastDate = (workouts as unknown as RawWorkout[])[workouts.length - 1]?.started_at;
  const totalDays = firstDate && lastDate
    ? Math.max(1, Math.round((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000))
    : 0;

  const summary = {
    total_workouts: workouts.length,
    date_range: `${firstDate ? new Date(firstDate).toISOString().split("T")[0] : "?"} to ${lastDate ? new Date(lastDate).toISOString().split("T")[0] : "?"} (${totalDays}d)`,
    avg_workouts_per_week: totalDays > 0 ? Math.round((workouts.length / totalDays) * 7 * 10) / 10 : 0,
    personal_records: Object.entries(exercisePRs).map(([ex, pr]) => `${ex}: ${pr.weight}kg×${pr.reps} (${pr.date})`),
    progression_format: "date:topWeight×reps:volume:sets(:⚠tooHeavyCount)",
    exercise_progression: exerciseProgression,
  };

  return JSON.stringify({ exported_at: new Date().toISOString(), workouts: workoutRecords, summary }, null, 2);
}

export async function deleteWorkoutFromHistory(workoutId: string): Promise<void> {
  if (DEMO_MODE) {
    mockStore.delete(workoutId);
    mockBonusCardio.delete(workoutId);
    const idx = MOCK_HISTORY.findIndex((w) => w.id === workoutId);
    if (idx >= 0) MOCK_HISTORY.splice(idx, 1);
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  // All child tables (workout_exercise_entries, set_entries, workout_bonus_cardio)
  // have ON DELETE CASCADE on their workout_id / workout_exercise_entry_id FKs,
  // so a single delete on the parent row handles everything at the DB level.
  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete workout: ${error.message}`);
  }
}

export async function deleteWorkoutsBulk(workoutIds: string[]): Promise<void> {
  if (workoutIds.length === 0) return;
  if (DEMO_MODE) {
    workoutIds.forEach((id) => {
      mockStore.delete(id);
      mockBonusCardio.delete(id);
      const idx = MOCK_HISTORY.findIndex((w) => w.id === id);
      if (idx >= 0) MOCK_HISTORY.splice(idx, 1);
    });
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { error } = await supabase
    .from("workouts")
    .delete()
    .in("id", workoutIds)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete workouts: ${error.message}`);
  }
}

export async function deleteAllImportedWorkouts(): Promise<{ deleted: number }> {
  if (DEMO_MODE) return { deleted: 0 };

  const supabase = await db();
  const userId = await getUserId();

  // Identify imported workouts: those linked to the __imports__ program OR with import_session_name set
  // First get IDs of workouts via the __imports__ program path (fallback)
  const { data: importProgram } = await supabase
    .from("programs")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "__imports__")
    .maybeSingle();

  const ids: string[] = [];

  if (importProgram) {
    const { data: days } = await supabase
      .from("workout_days")
      .select("id")
      .eq("program_id", importProgram.id)
      .eq("user_id", userId);

    if (days && days.length > 0) {
      const dayIds = days.map((d) => d.id);
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id")
        .in("workout_day_id", dayIds)
        .eq("user_id", userId);
      if (workouts) ids.push(...workouts.map((w) => w.id));
    }
  }

  // Also catch migration-applied path: workout_day_id is null (imported without FK)
  // Check if import_session_name column exists first
  const { error: probeErr } = await supabase
    .from("workouts")
    .select("import_session_name")
    .limit(0);
  if (!probeErr) {
    const { data: nullDayWorkouts } = await supabase
      .from("workouts")
      .select("id")
      .is("workout_day_id", null)
      .eq("user_id", userId);
    if (nullDayWorkouts) ids.push(...nullDayWorkouts.map((w) => w.id));
  }

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { deleted: 0 };

  const { error } = await supabase
    .from("workouts")
    .delete()
    .in("id", uniqueIds)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete imported workouts: ${error.message}`);

  return { deleted: uniqueIds.length };
}

export type ImportSessionInput = {
  date: string; // ISO string
  sessionName: string | null;
  exercises: Array<{
    name: string;
    sets: Array<{ weightKg: number | null; reps: number | null }>;
  }>;
};

export async function importPastWorkouts(
  sessions: ImportSessionInput[]
): Promise<{ imported: number; error?: string }> {
  if (DEMO_MODE) return { imported: 0 };

  const supabase = await db();
  const userId = await getUserId();

  // Detect whether migration 004 has been applied (import_session_name column exists)
  const { error: probeErr } = await supabase
    .from("workouts")
    .select("import_session_name")
    .limit(0);
  const migrationApplied = !probeErr;

  // Fallback: if migration not applied, we need real FK values
  let importDayId: string | null = null;
  // Cache: exercise_id → workout_day_exercise_id
  const exerciseSlotCache = new Map<string, string>();

  if (!migrationApplied) {
    // Find or create a hidden "__imports__" program + single workout_day
    const { data: existingProg } = await supabase
      .from("programs")
      .select("id")
      .eq("user_id", userId)
      .eq("name", "__imports__")
      .maybeSingle();

    let programId: string;
    if (existingProg) {
      programId = existingProg.id;
    } else {
      const { data: created, error: cpErr } = await supabase
        .from("programs")
        .insert({ user_id: userId, name: "__imports__", mode: "session", is_active: false })
        .select("id")
        .single();
      if (cpErr || !created) return { imported: 0, error: cpErr?.message ?? "Failed to create import program" };
      programId = created.id;
    }

    const { data: existingDay } = await supabase
      .from("workout_days")
      .select("id")
      .eq("program_id", programId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingDay) {
      importDayId = existingDay.id;
    } else {
      const { data: day, error: dayErr } = await supabase
        .from("workout_days")
        .insert({ program_id: programId, user_id: userId, name: "Imported", kind: "session", day_order: 0, day_of_week: 0, day_label: "" })
        .select("id")
        .single();
      if (dayErr || !day) return { imported: 0, error: dayErr?.message ?? "Failed to create import day" };
      importDayId = day.id;
    }
  }

  let imported = 0;

  for (const session of sessions) {
    const startedAt = new Date(session.date);
    startedAt.setHours(12, 0, 0, 0);

    // 1. Create the workout row
    let workoutId: string;
    if (migrationApplied) {
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          workout_day_id: null,
          import_session_name: session.sessionName ?? null,
          started_at: startedAt.toISOString(),
          completed_at: startedAt.toISOString(),
        })
        .select("id")
        .single();
      if (wErr || !workout) return { imported, error: wErr?.message ?? "Failed to create workout row" };
      workoutId = workout.id;
    } else {
      // Fallback: use real workout_day_id, store session name in notes
      const { data: workout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          workout_day_id: importDayId,
          notes: session.sessionName ? `[Import] ${session.sessionName}` : "[Import]",
          started_at: startedAt.toISOString(),
          completed_at: startedAt.toISOString(),
        })
        .select("id")
        .single();
      if (wErr || !workout) return { imported, error: wErr?.message ?? "Failed to create workout row" };
      workoutId = workout.id;
    }

    // 2. For each exercise: find-or-create by normalized name, then insert entry + sets
    for (const ex of session.exercises) {
      const normalized = ex.name.toLowerCase().trim();

      // Find existing exercise
      let exerciseId: string | null = null;
      const { data: existing } = await supabase
        .from("exercises")
        .select("id")
        .eq("user_id", userId)
        .eq("normalized_name", normalized)
        .limit(1)
        .maybeSingle();

      if (existing) {
        exerciseId = existing.id as string;
      } else {
        const { data: created } = await supabase
          .from("exercises")
          .insert({
            user_id: userId,
            name: ex.name.trim(),
            normalized_name: normalized,
          })
          .select("id")
          .single();
        exerciseId = created?.id ?? null;
        // Link new exercise to global library for enriched metadata
        if (exerciseId) {
          await linkExerciseToLibraryInternal(supabase, userId, exerciseId, ex.name.trim());
        }
      }

      if (!exerciseId) continue;

      // Resolve workout_day_exercise_id for fallback path
      let slotId: string | null = null;
      if (!migrationApplied && importDayId) {
        if (exerciseSlotCache.has(exerciseId)) {
          slotId = exerciseSlotCache.get(exerciseId)!;
        } else {
          const { data: existingSlot } = await supabase
            .from("workout_day_exercises")
            .select("id")
            .eq("workout_day_id", importDayId)
            .eq("exercise_id", exerciseId)
            .eq("user_id", userId)
            .maybeSingle();
          if (existingSlot) {
            slotId = existingSlot.id;
          } else {
            const { data: newSlot } = await supabase
              .from("workout_day_exercises")
              .insert({ workout_day_id: importDayId, exercise_id: exerciseId, user_id: userId, order_index: 0, target_sets: 3, target_reps: 5 })
              .select("id")
              .single();
            slotId = newSlot?.id ?? null;
          }
          if (slotId) exerciseSlotCache.set(exerciseId, slotId);
        }
      }

      // Create exercise entry
      const { data: entry, error: entryErr } = await supabase
        .from("workout_exercise_entries")
        .insert({
          workout_id: workoutId,
          exercise_id: exerciseId,
          workout_day_exercise_id: migrationApplied ? null : slotId,
          user_id: userId,
        })
        .select("id")
        .single();

      if (entryErr || !entry) continue;

      // Create set entries
      if (ex.sets.length > 0) {
        const setRows = ex.sets.map((s, i) => ({
          workout_exercise_entry_id: entry.id,
          user_id: userId,
          set_number: i + 1,
          weight_kg: s.weightKg ?? null,
          reps: s.reps ?? null,
          completed: true,
        }));

        await supabase.from("set_entries").insert(setRows);
      }
    }

    imported++;
  }

  return { imported };
}
