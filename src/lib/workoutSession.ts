// The in-progress workout on the lifter's device (see GLOSSARY.md): its start result and workout
// draft in storage, and the set transitions the workout screen applies.

import type { SetSyncEntry, StartWorkoutResult } from "@/lib/actions";
import type { SetEntry, WorkoutExerciseEntry } from "@/lib/types";
import { planSets, type PlanInput } from "@/lib/plannedSets";

/** Sets per exercise entry id */
export type SetMap = Record<string, SetEntry[]>;

// ── Storage seam ───────────────────────────────────────────

/** Key/value storage the session lives in: the browser in the app, memory in tests. */
export interface SessionStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * Browser adapter. Writes go to localStorage only; reads also check sessionStorage, where older
 * versions wrote start results too.
 */
export const browserStorage: SessionStorage = {
  read: (key) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
  write: (key, value) => localStorage.setItem(key, value),
  remove: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

/** In-memory adapter, optionally pre-filled. */
export function memoryStorage(initial: Record<string, string> = {}): SessionStorage {
  const data = new Map(Object.entries(initial));
  return {
    read: (key) => data.get(key) ?? null,
    write: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

// Keys are unchanged from earlier versions so an in-progress workout survives an app update.
const startKey = (workoutId: string) => `workout-${workoutId}`;
const draftKey = (workoutId: string) => `workout-draft-${workoutId}`;

// ── Start result ───────────────────────────────────────────

export function saveStartResult(storage: SessionStorage, result: StartWorkoutResult): void {
  storage.write(startKey(result.id), JSON.stringify(result));
}

type TooHeavyFlags = StartWorkoutResult["tooHeavyFlags"];

/** Older versions stored too-heavy flags as a boolean or a list of set numbers. */
function normalizeTooHeavyFlags(raw: Record<string, unknown>): TooHeavyFlags {
  const flags: TooHeavyFlags = {};
  for (const [exerciseId, val] of Object.entries(raw)) {
    if (!Array.isArray(val) || val.length === 0) flags[exerciseId] = [];
    else if (typeof val[0] === "number") flags[exerciseId] = (val as number[]).map((n) => ({ setNumber: n, achievedReps: null }));
    else flags[exerciseId] = val as TooHeavyFlags[string];
  }
  return flags;
}

export function loadStartResult(storage: SessionStorage, workoutId: string): StartWorkoutResult | null {
  const raw = storage.read(startKey(workoutId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      suggestions: parsed.suggestions ?? {},
      tooHeavyFlags: normalizeTooHeavyFlags(parsed.tooHeavyFlags ?? {}),
    } as StartWorkoutResult;
  } catch {
    return null;
  }
}

/** Forget the in-progress workout on this device: its start result and its workout draft. */
export function clearSession(storage: SessionStorage, workoutId: string): void {
  storage.remove(startKey(workoutId));
  storage.remove(draftKey(workoutId));
}

// ── Workout draft ──────────────────────────────────────────

type DraftSet = Pick<SetEntry, "id" | "weight_kg" | "reps" | "completed" | "is_warmup" | "too_heavy" | "too_heavy_reps" | "rpe" | "set_number" | "workout_exercise_entry_id" | "user_id">;

/** What the workout screen keeps on the device while a workout is in progress. */
export type WorkoutDraft<Cardio = unknown> = {
  setsByEntryId: Record<string, DraftSet[]>;
  notes: string;
  bonusCardioDraft: Cardio;
  showSummary: boolean;
  activeEntryId: string | null;
};

type StoredDraft<Cardio> = WorkoutDraft<Cardio> & { version: 1; updatedAt: string };

export function saveDraft<Cardio>(storage: SessionStorage, workoutId: string, draft: WorkoutDraft<Cardio>): void {
  const stored: StoredDraft<Cardio> = {
    ...draft,
    setsByEntryId: Object.fromEntries(
      Object.entries(draft.setsByEntryId).map(([entryId, sets]) => [
        entryId,
        sets.map((set) => ({
          id: set.id,
          weight_kg: set.weight_kg,
          reps: set.reps,
          completed: set.completed,
          is_warmup: set.is_warmup ?? false,
          too_heavy: set.too_heavy ?? false,
          too_heavy_reps: set.too_heavy_reps ?? null,
          rpe: set.rpe ?? null,
          set_number: set.set_number,
          workout_exercise_entry_id: set.workout_exercise_entry_id,
          user_id: set.user_id,
        })),
      ])
    ),
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  storage.write(draftKey(workoutId), JSON.stringify(stored));
}

/** The saved workout draft, or null when there is none (or it is from an unknown version). */
export function loadDraft<Cardio>(storage: SessionStorage, workoutId: string): WorkoutDraft<Cardio> | null {
  const raw = storage.read(draftKey(workoutId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft<Cardio>;
    return parsed?.version === 1 ? { ...parsed, setsByEntryId: parsed.setsByEntryId ?? {} } : null;
  } catch {
    return null;
  }
}

/**
 * The server's sets with the workout draft applied. For an exercise the draft has sets for, the draft
 * decides which sets exist and in what order: server sets get the draft's values, sets added during
 * the workout come from the draft, and server sets missing from it were deleted during the workout.
 */
export function mergeDraftSets(current: SetMap, draft: Record<string, DraftSet[]>): SetMap {
  const next: SetMap = {};
  for (const [entryId, sets] of Object.entries(current)) {
    const draftSets = draft[entryId] ?? [];
    if (draftSets.length === 0) {
      next[entryId] = sets.map((set) => ({ ...set }));
      continue;
    }
    const serverById = new Map(sets.map((set) => [set.id, set]));
    const merged: SetEntry[] = [];
    for (const d of draftSets) {
      const server = serverById.get(d.id);
      if (server) {
        merged.push({
          ...server,
          set_number: d.set_number ?? server.set_number,
          weight_kg: d.weight_kg,
          reps: d.reps,
          completed: d.completed,
          is_warmup: d.is_warmup ?? server.is_warmup,
          too_heavy: d.too_heavy ?? server.too_heavy,
          too_heavy_reps: d.too_heavy_reps ?? server.too_heavy_reps,
          rpe: d.rpe !== undefined ? d.rpe : server.rpe,
        });
      } else if (d.workout_exercise_entry_id && d.user_id) {
        merged.push({
          id: d.id,
          workout_exercise_entry_id: d.workout_exercise_entry_id,
          user_id: d.user_id,
          set_number: d.set_number ?? merged.length + 1,
          weight_kg: d.weight_kg,
          reps: d.reps,
          completed: d.completed,
          is_warmup: d.is_warmup ?? false,
          too_heavy: d.too_heavy ?? false,
          too_heavy_reps: d.too_heavy_reps ?? null,
          rpe: d.rpe ?? null,
          created_at: new Date().toISOString(),
        });
      }
    }
    next[entryId] = merged;
  }
  return next;
}

// ── Set transitions ────────────────────────────────────────

/** Check a set off or undo it. Checking off a set with no reps entered counts the target reps as done. */
export function toggleSetCompleted(sets: SetEntry[], setId: string, targetReps: number): SetEntry[] {
  return sets.map((s) => {
    if (s.id !== setId) return s;
    const completing = !s.completed;
    return { ...s, completed: completing, ...(completing && s.reps === null ? { reps: targetReps } : {}) };
  });
}

/** Append a planned work set that copies the last set's weight and reps. */
export function addSet(
  sets: SetEntry[],
  owner: { entryId: string; userId: string },
  newId: () => string = () => crypto.randomUUID()
): SetEntry[] {
  const last = sets[sets.length - 1];
  return [
    ...sets,
    {
      id: newId(),
      workout_exercise_entry_id: owner.entryId,
      user_id: owner.userId,
      set_number: sets.length + 1,
      weight_kg: last?.weight_kg ?? null,
      reps: last?.reps ?? null,
      completed: false,
      is_warmup: false,
      created_at: new Date().toISOString(),
    },
  ];
}

/** Rate a completed work set's RPE (null clears it); warmups and planned sets aren't rated. */
export function setRpe(sets: SetEntry[], setId: string, rpe: number | null): SetEntry[] {
  return sets.map((s) => (s.id === setId && s.completed && !s.is_warmup ? { ...s, rpe } : s));
}

/**
 * Flag sets as too heavy (checking them off, with the reps actually achieved when given) or clear
 * the flag again.
 */
export function markTooHeavy(sets: SetEntry[], setIds: string[], value: boolean, achievedReps?: number | null): SetEntry[] {
  return sets.map((s) => {
    if (!setIds.includes(s.id)) return s;
    if (!value) return { ...s, too_heavy: false, too_heavy_reps: null };
    return { ...s, too_heavy: true, too_heavy_reps: achievedReps ?? null, completed: true, reps: achievedReps ?? s.reps };
  });
}

/** The planned sets of an exercise swapped in mid-workout, from that exercise's previous results. */
export function swapSets(
  owner: { entryId: string; userId: string; targetSets: number },
  previous: PlanInput["previous"],
  newId: () => string = () => crypto.randomUUID()
): SetEntry[] {
  return planSets({ prescription: [], targetSets: owner.targetSets, previous }).map((planned) => ({
    ...planned,
    id: newId(),
    workout_exercise_entry_id: owner.entryId,
    user_id: owner.userId,
    completed: false,
    too_heavy: false,
    too_heavy_reps: null,
    created_at: new Date().toISOString(),
  }));
}

// ── Finishing ──────────────────────────────────────────────

/** Whether finishing would leave planned sets that have a weight or reps entered (empty ones don't count). */
export function hasIncompleteSets(setsMap: SetMap): boolean {
  return Object.values(setsMap).some((sets) => sets.some((s) => !s.completed && (s.weight_kg !== null || s.reps !== null)));
}

/** The sets to save when the workout is finished, per exercise entry. */
export function finishPayload(
  entries: Pick<WorkoutExerciseEntry, "id" | "workout_day_exercise_id" | "user_id">[],
  setsMap: SetMap
): SetSyncEntry[] {
  return entries.map((entry) => ({
    entryId: entry.id,
    workoutDayExerciseId: entry.workout_day_exercise_id ?? null,
    userId: entry.user_id,
    sets: (setsMap[entry.id] ?? []).map((s) => ({
      id: s.id,
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
      completed: s.completed,
      is_warmup: s.is_warmup ?? false,
      too_heavy: s.too_heavy ?? false,
      too_heavy_reps: s.too_heavy_reps ?? null,
      rpe: s.rpe ?? null,
    })),
  }));
}

// ── Supersets ──────────────────────────────────────────────

type SessionEntry = { id: string; superset_group?: string | null };

const hasSetsLeft = (setsMap: SetMap, entryId: string) => (setsMap[entryId] ?? []).some((s) => !s.completed);

/**
 * The exercise to open after a set of `entryId` is checked off. In a superset: the next exercise of
 * the group (in order, wrapping) that still has sets, else the exercise after the group. Otherwise: the
 * same exercise until all its sets are done, then the next one. Null when nothing follows.
 */
export function nextActiveEntry(entries: SessionEntry[], setsMap: SetMap, entryId: string): string | null {
  const index = entries.findIndex((e) => e.id === entryId);
  if (index === -1) return entryId;
  const group = entries[index].superset_group;
  if (!group) return hasSetsLeft(setsMap, entryId) ? entryId : (entries[index + 1]?.id ?? null);

  const members = entries.filter((e) => e.superset_group === group);
  const at = members.findIndex((e) => e.id === entryId);
  for (let k = 1; k <= members.length; k++) {
    const candidate = members[(at + k) % members.length];
    if (hasSetsLeft(setsMap, candidate.id)) return candidate.id;
  }
  const lastMember = entries.findIndex((e) => e.id === members[members.length - 1].id);
  return entries[lastMember + 1]?.id ?? null;
}

/** Whether checking off a set of `entryId` should start the rest timer: in a superset only after a round. */
export function restAfterSet(entries: SessionEntry[], setsMap: SetMap, entryId: string): boolean {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry?.superset_group) return true;
  const members = entries.filter((e) => e.superset_group === entry.superset_group);
  const at = members.findIndex((e) => e.id === entryId);
  return !members.slice(at + 1).some((e) => hasSetsLeft(setsMap, e.id));
}

/** Entries split into display blocks: consecutive members of one superset together, others alone. */
export function supersetBlocks<E extends SessionEntry>(entries: E[]): { group: string | null; entries: E[] }[] {
  const blocks: { group: string | null; entries: E[] }[] = [];
  for (const entry of entries) {
    const group = entry.superset_group ?? null;
    const last = blocks[blocks.length - 1];
    if (group && last?.group === group) last.entries.push(entry);
    else blocks.push({ group, entries: [entry] });
  }
  return blocks;
}
