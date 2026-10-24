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
  const warmup = { weight_kg: 120, reps: 2, is_warmup: true };
  const work = { weight_kg: 100, reps: 5, is_warmup: false };

  it("adds 2.5 kg once the target number of work sets was reached, ignoring warmups", () => {
    expect(suggestedWeight([warmup, work, work, work], 3)).toBe(102.5);
  });

  it("repeats the weight when fewer work sets than the target were done", () => {
    expect(suggestedWeight([warmup, work, work], 3)).toBe(100);
  });

  it("is null without previous work sets", () => {
    expect(suggestedWeight([warmup], 3)).toBeNull();
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
