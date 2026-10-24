import { addSet, clearSession, finishPayload, hasIncompleteSets, swapSets, loadDraft, markTooHeavy, toggleSetCompleted, loadStartResult, memoryStorage, mergeDraftSets, saveDraft, saveStartResult, type WorkoutDraft } from "./workoutSession";
import type { SetEntry } from "@/lib/types";
import type { StartWorkoutResult } from "@/lib/actions";

const start = (id: string, completed_at: string | null = null) =>
  ({ id, workout: { id, completed_at }, entries: [], suggestions: {}, tooHeavyFlags: {} }) as unknown as StartWorkoutResult;

describe("start result storage", () => {
  it("round-trips the start result of an in-progress workout", () => {
    const storage = memoryStorage();
    saveStartResult(storage, start("w1"));
    expect(loadStartResult(storage, "w1")?.id).toBe("w1");
  });

  it("upgrades old too-heavy flag formats", () => {
    const storage = memoryStorage({
      "workout-w1": JSON.stringify({ ...start("w1"), tooHeavyFlags: { a: [2, 3], b: true, c: [] } }),
    });
    expect(loadStartResult(storage, "w1")?.tooHeavyFlags).toEqual({
      a: [{ setNumber: 2, achievedReps: null }, { setNumber: 3, achievedReps: null }],
      b: [],
      c: [],
    });
  });

  it("clears both the start result and the workout draft", () => {
    const storage = memoryStorage({ "workout-w1": JSON.stringify(start("w1")), "workout-draft-w1": "{}" });
    clearSession(storage, "w1");
    expect(storage.read("workout-w1")).toBeNull();
    expect(storage.read("workout-draft-w1")).toBeNull();
  });
});

const set = (id: string, patch: Partial<SetEntry> = {}): SetEntry => ({
  id, workout_exercise_entry_id: "e1", user_id: "u1", set_number: 1,
  weight_kg: null, reps: null, completed: false, is_warmup: false, too_heavy: false, too_heavy_reps: null,
  created_at: "", ...patch,
});

describe("workout draft", () => {
  const draft: WorkoutDraft = {
    setsByEntryId: {
      e1: [{
        id: "s1", workout_exercise_entry_id: "e1", user_id: "u1", set_number: 1, weight_kg: 100, reps: 5,
        completed: true, is_warmup: false, too_heavy: false, too_heavy_reps: null,
      }],
    },
    notes: "felt good",
    bonusCardioDraft: { machine_type: "rower" } as WorkoutDraft["bonusCardioDraft"],
    showSummary: false,
    activeEntryId: "e1",
  };

  it("round-trips a draft and ignores other versions", () => {
    const storage = memoryStorage({ "workout-draft-w2": JSON.stringify({ version: 2 }) });
    saveDraft(storage, "w1", draft);
    expect(loadDraft(storage, "w1")).toMatchObject(draft);
    expect(loadDraft(storage, "w2")).toBeNull();
  });

  it("patches server sets with draft values and appends sets added during the workout", () => {
    const server = { e1: [set("s1")], e2: [set("s9", { workout_exercise_entry_id: "e2" })] };
    const merged = mergeDraftSets(server, {
      e1: [set("s1", { weight_kg: 100, reps: 5, completed: true }), set("new", { set_number: 2, weight_kg: 100 })],
    });
    expect(merged.e1.map((s) => [s.id, s.weight_kg, s.completed])).toEqual([["s1", 100, true], ["new", 100, false]]);
    expect(merged.e2).toEqual(server.e2);
  });

  it("drops server sets the lifter deleted during the workout, keeping the draft's order", () => {
    const server = { e1: [set("s1"), set("s2", { set_number: 2 }), set("s3", { set_number: 3 })] };
    const merged = mergeDraftSets(server, {
      e1: [set("s1", { completed: true }), set("s2", { set_number: 2 }), set("new", { set_number: 3, weight_kg: 40 })],
    });
    expect(merged.e1.map((s) => [s.id, s.set_number])).toEqual([["s1", 1], ["s2", 2], ["new", 3]]);
  });
});

describe("set transitions", () => {
  it("checking off a set without reps counts the target reps as done; unchecking keeps them", () => {
    const done = toggleSetCompleted([set("s1", { weight_kg: 100 })], "s1", 5);
    expect(done[0]).toMatchObject({ completed: true, reps: 5 });
    expect(toggleSetCompleted(done, "s1", 5)[0]).toMatchObject({ completed: false, reps: 5 });
  });

  it("a new set is a planned work set copying the last set's weight and reps", () => {
    const sets = addSet([set("s1", { weight_kg: 100, reps: 5, completed: true, is_warmup: true })], { entryId: "e1", userId: "u1" }, () => "s2");
    expect(sets[1]).toMatchObject({ id: "s2", set_number: 2, weight_kg: 100, reps: 5, completed: false, is_warmup: false });
  });

  it("marking sets too heavy checks them off with the achieved reps; unmarking clears the flag", () => {
    const heavy = markTooHeavy([set("s1", { reps: 5 }), set("s2", { reps: 5 })], ["s1"], true, 3);
    expect(heavy[0]).toMatchObject({ too_heavy: true, too_heavy_reps: 3, completed: true, reps: 3 });
    expect(heavy[1]).toMatchObject({ too_heavy: false, completed: false });
    expect(markTooHeavy(heavy, ["s1"], false)[0]).toMatchObject({ too_heavy: false, too_heavy_reps: null, completed: true });
  });
});

describe("swapping an exercise", () => {
  it("plans the new exercise's sets from its previous results, warmups first", () => {
    let n = 0;
    const sets = swapSets(
      { entryId: "e1", userId: "u1", targetSets: 2 },
      [
        { weight_kg: 40, reps: 8, is_warmup: true, too_heavy: false },
        { weight_kg: 80, reps: 6, is_warmup: false, too_heavy: false },
      ],
      () => `n${++n}`
    );
    expect(sets.map((s) => [s.id, s.is_warmup, s.weight_kg, s.reps, s.completed])).toEqual([
      ["n1", true, 40, 8, false],
      ["n2", false, 80, 6, false],
      ["n3", false, null, null, false],
    ]);
  });
});

describe("finishing", () => {
  it("warns only about planned sets that have something entered", () => {
    expect(hasIncompleteSets({ e1: [set("a", { completed: true }), set("b")] })).toBe(false);
    expect(hasIncompleteSets({ e1: [set("a", { completed: true }), set("b", { weight_kg: 100 })] })).toBe(true);
  });

  it("sends every entry's sets with defaults filled in", () => {
    const payload = finishPayload(
      [{ id: "e1", workout_day_exercise_id: null, user_id: "u1" }],
      { e1: [{ ...set("a", { weight_kg: 100, reps: 5 }), is_warmup: undefined, too_heavy: undefined }] }
    );
    expect(payload).toEqual([
      {
        entryId: "e1", workoutDayExerciseId: null, userId: "u1",
        sets: [{ id: "a", set_number: 1, weight_kg: 100, reps: 5, completed: false, is_warmup: false, too_heavy: false, too_heavy_reps: null }],
      },
    ]);
  });
});
