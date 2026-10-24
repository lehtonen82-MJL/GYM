import { planSets } from "./plannedSets";

describe("planSets", () => {
  it("follows the prescription when there are no previous results", () => {
    expect(planSets({ prescription: [{ weightKg: 60, reps: 5 }, { weightKg: 70, reps: 3 }], targetSets: 4, previous: [] })).toEqual([
      { set_number: 1, weight_kg: 60, reps: 5, is_warmup: false },
      { set_number: 2, weight_kg: 70, reps: 3, is_warmup: false },
    ]);
  });

  it("plans target-many empty work sets without a prescription", () => {
    expect(planSets({ prescription: [], targetSets: 2, previous: [] })).toEqual([
      { set_number: 1, weight_kg: null, reps: null, is_warmup: false },
      { set_number: 2, weight_kg: null, reps: null, is_warmup: false },
    ]);
  });

  it("carries previous results: warmups first, at least as many work sets, prescription wins", () => {
    const previous = [
      { weight_kg: 40, reps: 8, is_warmup: true, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
      { weight_kg: 100, reps: 4, is_warmup: false, too_heavy: false },
    ];
    expect(planSets({ prescription: [{ reps: 6 }], targetSets: 2, previous })).toEqual([
      { set_number: 1, weight_kg: 40, reps: 8, is_warmup: true },
      { set_number: 2, weight_kg: 100, reps: 6, is_warmup: false },
      { set_number: 3, weight_kg: 100, reps: 5, is_warmup: false },
      { set_number: 4, weight_kg: 100, reps: 4, is_warmup: false },
    ]);
  });

  it("leaves reps empty after a too-heavy work set, but keeps a too-heavy warmup's reps", () => {
    const previous = [
      { weight_kg: 60, reps: 5, is_warmup: true, too_heavy: true },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: true },
    ];
    expect(planSets({ prescription: [], targetSets: 1, previous })).toEqual([
      { set_number: 1, weight_kg: 60, reps: 5, is_warmup: true },
      { set_number: 2, weight_kg: 100, reps: null, is_warmup: false },
    ]);
  });

  describe("Easy Week (deload)", () => {
    const previous = [
      { weight_kg: 60, reps: 5, is_warmup: true, too_heavy: false },
      { weight_kg: 80, reps: 3, is_warmup: true, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
    ];

    it("cuts work sets by the set percentage (rounded up) and weights to the nearest 2.5 kg", () => {
      expect(
        planSets({ prescription: [], targetSets: 3, previous, deload: { weightPct: 83, setPct: 50, reduceWarmups: false } })
      ).toEqual([
        { set_number: 1, weight_kg: 50, reps: 5, is_warmup: true },
        { set_number: 2, weight_kg: 67.5, reps: 3, is_warmup: true },
        { set_number: 3, weight_kg: 82.5, reps: 5, is_warmup: false },
        { set_number: 4, weight_kg: 82.5, reps: 5, is_warmup: false },
      ]);
    });

    it("cuts warmups too when asked, keeping at least one work set", () => {
      const sets = planSets({ prescription: [], targetSets: 1, previous: previous.slice(0, 3), deload: { weightPct: 80, setPct: 10, reduceWarmups: true } });
      expect(sets.map((s) => s.is_warmup)).toEqual([true, false]);
    });
  });
});
