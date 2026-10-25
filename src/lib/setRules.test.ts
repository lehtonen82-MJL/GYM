import { exerciseSummary, previousResultSets, sessionVolume, suggestedWeight, topSet } from "./setRules";

describe("sessionVolume", () => {
  it("sums weight × reps of completed work sets", () => {
    expect(
      sessionVolume([
        { weight_kg: 60, reps: 10, completed: true, is_warmup: true },
        { weight_kg: 100, reps: 5, completed: true, is_warmup: false },
        { weight_kg: 100, reps: 5, completed: true },
        { weight_kg: 100, reps: null, completed: true },
        { weight_kg: null, reps: 12, completed: true },
        { weight_kg: 102.5, reps: 3, completed: true },
      ])
    ).toBe(1307.5);
  });

  it("leaves out planned sets, even when weight and reps are filled in", () => {
    expect(
      sessionVolume([
        { weight_kg: 100, reps: 5, completed: true },
        { weight_kg: 100, reps: 5, completed: false },
      ])
    ).toBe(500);
  });

  it("is 0 for bodyweight-only sessions", () => {
    expect(sessionVolume([{ weight_kg: 0, reps: 10, completed: true }])).toBe(0);
  });
});

describe("topSet", () => {
  it("is the heaviest completed work set, ignoring planned and warmup sets", () => {
    expect(
      topSet([
        { weight_kg: 120, reps: 3, completed: true, is_warmup: true },
        { weight_kg: 110, reps: 5, completed: false },
        { weight_kg: 100, reps: 5, completed: true },
        { weight_kg: 100, reps: 6, completed: true },
      ])
    ).toEqual({ weight_kg: 100, reps: 6 });
  });

  it("is null when no work set was completed", () => {
    expect(topSet([{ weight_kg: 100, reps: 5, completed: false }])).toBeNull();
  });
});

describe("previousResultSets", () => {
  it("keeps the completed sets, warmups included, and drops planned ones", () => {
    const warmup = { weight_kg: 60, reps: 8, completed: true, is_warmup: true };
    const done = { weight_kg: 100, reps: 5, completed: true };
    const planned = { weight_kg: 100, reps: 5, completed: false };
    expect(previousResultSets([warmup, done, planned])).toEqual([warmup, done]);
  });

  it("falls back to every set with data when none was checked off", () => {
    const a = { weight_kg: 100, reps: 5, completed: false };
    const b = { weight_kg: null, reps: 8, completed: false };
    const empty = { weight_kg: null, reps: null, completed: false };
    expect(previousResultSets([a, b, empty])).toEqual([a, b]);
  });
});

describe("suggestedWeight", () => {
  const warmup = { weight_kg: 120, reps: 2, is_warmup: true, too_heavy: false };
  const set = (weight_kg: number, reps: number, too_heavy = false) => ({ weight_kg, reps, is_warmup: false, too_heavy });
  const barbell3x5 = { targetSets: 3, targetReps: 5, equipment: "barbell" };

  it("goes up one step when every work set reached the target reps, ignoring warmups", () => {
    expect(suggestedWeight([warmup, set(100, 5), set(100, 5), set(100, 6)], barbell3x5)).toBe(102.5);
  });

  it("stays when reps were missed, or fewer work sets than the target were done", () => {
    expect(suggestedWeight([set(100, 5), set(100, 5), set(100, 3)], barbell3x5)).toBe(100);
    expect(suggestedWeight([set(100, 5), set(100, 5)], barbell3x5)).toBe(100);
  });

  it("goes down one step after a too-heavy set", () => {
    expect(suggestedWeight([set(100, 5), set(100, 5), set(100, 2, true)], barbell3x5)).toBe(97.5);
  });

  it("uses the equipment's progression step", () => {
    const done = [set(20, 10), set(20, 10), set(20, 10)];
    const at = (equipment: string | null) => suggestedWeight(done, { targetSets: 3, targetReps: 10, equipment });
    expect([at("dumbbell"), at("kettlebell"), at("cable"), at("machine_stack"), at("smith"), at(null), at("other")])
      .toEqual([22, 24, 25, 25, 22.5, 22.5, 22.5]);
  });

  it("has no suggestion for equipment moved by bodyweight or bands, or without previous work sets", () => {
    expect(suggestedWeight([set(0, 10)], { targetSets: 1, targetReps: 10, equipment: "bodyweight" })).toBeNull();
    expect(suggestedWeight([set(10, 10)], { targetSets: 1, targetReps: 10, equipment: "band" })).toBeNull();
    expect(suggestedWeight([warmup], barbell3x5)).toBeNull();
  });

  it("holds when a work set was rated RPE 9.5 or 10, even with every target met", () => {
    const rated = (rpe: number | null) => ({ ...set(100, 5), rpe });
    expect(suggestedWeight([rated(8), rated(9), rated(9.5)], barbell3x5)).toBe(100);
    expect(suggestedWeight([rated(8), rated(9), rated(10)], barbell3x5)).toBe(100);
    expect(suggestedWeight([rated(8), rated(9), rated(null)], barbell3x5)).toBe(102.5);
  });

  it("never goes up in an Easy Week", () => {
    expect(suggestedWeight([set(100, 5), set(100, 5), set(100, 5)], { ...barbell3x5, easyWeek: true })).toBe(100);
  });

  it("counts only the work sets when the target reps are unknown", () => {
    expect(suggestedWeight([set(100, 3), set(100, 3), set(100, 3)], { targetSets: 3, targetReps: null, equipment: "barbell" })).toBe(102.5);
  });
});


describe("exerciseSummary", () => {
  it("summarises completed work sets only", () => {
    expect(
      exerciseSummary([
        { weight_kg: 60, reps: 8, completed: true, is_warmup: true },
        { weight_kg: 100, reps: 5, completed: true },
        { weight_kg: 100, reps: 4, completed: true },
        { weight_kg: 100, reps: 5, completed: false },
      ])
    ).toEqual({ top: { weight_kg: 100, reps: 5 }, volume: 900, workSets: 2 });
  });

  it("counts a completed set without reps but adds no volume for it", () => {
    expect(exerciseSummary([{ weight_kg: 100, reps: null, completed: true }])).toEqual({
      top: { weight_kg: 100, reps: 0 },
      volume: 0,
      workSets: 1,
    });
  });
});
