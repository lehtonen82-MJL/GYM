import { planSets, wantsAutoWarmup } from "./plannedSets";

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

  it("carries previous results: warmups first, the program's set count, prescription wins", () => {
    const previous = [
      { weight_kg: 40, reps: 8, is_warmup: true, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
      { weight_kg: 100, reps: 5, is_warmup: false, too_heavy: false },
      { weight_kg: 100, reps: 4, is_warmup: false, too_heavy: false },
    ];
    expect(planSets({ prescription: [], targetSets: 2, previous })).toEqual([
      { set_number: 1, weight_kg: 40, reps: 8, is_warmup: true },
      { set_number: 2, weight_kg: 100, reps: 5, is_warmup: false },
      { set_number: 3, weight_kg: 100, reps: 5, is_warmup: false },
    ]);
    expect(planSets({ prescription: [{ reps: 6 }, { reps: 6 }], targetSets: 2, previous }).slice(1).map((s) => s.reps)).toEqual([6, 6]);
  });

  it("gives sets beyond last time's the last previous work set's weight and reps", () => {
    const previous = [
      { weight_kg: 40, reps: 2, is_warmup: false, too_heavy: false },
      { weight_kg: 42.5, reps: 2, is_warmup: false, too_heavy: false },
    ];
    expect(planSets({ prescription: [], targetSets: 4, previous }).map((s) => [s.weight_kg, s.reps])).toEqual([
      [40, 2], [42.5, 2], [42.5, 2], [42.5, 2],
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

  describe("automatic warmups", () => {
    const work = (weight_kg: number) => ({ weight_kg, reps: 5, is_warmup: false, too_heavy: false });
    const warmups = (sets: ReturnType<typeof planSets>) => sets.filter((s) => s.is_warmup).map((s) => [s.weight_kg, s.reps]);

    it("ramps 50/70/85 % of the first work set × 8/5/3 before the work sets", () => {
      const sets = planSets({ prescription: [], targetSets: 2, previous: [work(100), work(100)], autoWarmup: true });
      expect(warmups(sets)).toEqual([[50, 8], [70, 5], [85, 3]]);
      expect(sets.map((s) => s.set_number)).toEqual([1, 2, 3, 4, 5]);
      expect(sets.slice(3).every((s) => !s.is_warmup && s.weight_kg === 100)).toBe(true);
    });

    it("rounds to 2.5 kg, drops sets lighter than the empty bar and merges equal weights", () => {
      expect(warmups(planSets({ prescription: [], targetSets: 1, previous: [work(45)], autoWarmup: true })))
        .toEqual([[22.5, 8], [32.5, 5], [37.5, 3]]);
      expect(warmups(planSets({ prescription: [], targetSets: 1, previous: [work(40)], autoWarmup: true })))
        .toEqual([[20, 8], [27.5, 5], [35, 3]]);
      expect(warmups(planSets({ prescription: [{ weightKg: 41, reps: 5 }], targetSets: 1, previous: [], autoWarmup: true })))
        .toEqual([[20, 8], [27.5, 5], [35, 3]]);
    });

    it("skips the ramp under 40 kg, without a work weight, or when not asked for", () => {
      expect(warmups(planSets({ prescription: [], targetSets: 1, previous: [work(37.5)], autoWarmup: true }))).toEqual([]);
      expect(warmups(planSets({ prescription: [], targetSets: 2, previous: [], autoWarmup: true }))).toEqual([]);
      expect(warmups(planSets({ prescription: [], targetSets: 1, previous: [work(100)] }))).toEqual([]);
    });

    it("keeps last time's own warmups instead", () => {
      const previous = [{ weight_kg: 60, reps: 5, is_warmup: true, too_heavy: false }, work(100)];
      expect(warmups(planSets({ prescription: [], targetSets: 1, previous, autoWarmup: true }))).toEqual([[60, 5]]);
    });

    it("ramps from the Easy Week weight", () => {
      const sets = planSets({
        prescription: [], targetSets: 1, previous: [work(100)], autoWarmup: true,
        deload: { weightPct: 80, setPct: 100, reduceWarmups: false },
      });
      expect(warmups(sets)).toEqual([[40, 8], [55, 5], [67.5, 3]]);
    });
  });

  it("auto warmups are for main lifts with a barbell, trap bar or Smith machine", () => {
    expect(wantsAutoWarmup({ isMainLift: true, equipment: "barbell" })).toBe(true);
    expect(wantsAutoWarmup({ isMainLift: true, equipment: "trap_bar" })).toBe(true);
    expect(wantsAutoWarmup({ isMainLift: true, equipment: "dumbbell" })).toBe(false);
    expect(wantsAutoWarmup({ isMainLift: false, equipment: "barbell" })).toBe(false);
    expect(wantsAutoWarmup(undefined)).toBe(false);
  });
});
