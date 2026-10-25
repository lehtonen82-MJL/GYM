import { planSets, warmupKind, warmupPlans } from "./plannedSets";

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

  it("plans straight sets at last time's heaviest work set, sets beyond last time's repeating its reps", () => {
    const previous = [
      { weight_kg: 40, reps: 2, is_warmup: false, too_heavy: false },
      { weight_kg: 42.5, reps: 2, is_warmup: false, too_heavy: false },
    ];
    expect(planSets({ prescription: [], targetSets: 4, previous }).map((s) => [s.weight_kg, s.reps])).toEqual([
      [42.5, 2], [42.5, 2], [42.5, 2], [42.5, 2],
    ]);
  });

  it("turns last time's pyramid into straight sets, and warms up to the top weight", () => {
    const pyramid = [20, 30, 35, 40].map((weight_kg) => ({ weight_kg, reps: 5, is_warmup: false, too_heavy: false }));
    const sets = planSets({
      prescription: [{ reps: 2 }, { reps: 2 }, { reps: 2 }, { reps: 2 }],
      targetSets: 4,
      previous: pyramid,
      warmup: { kind: "olympic", equipment: "barbell" },
    });
    expect(sets.map((s) => [s.is_warmup ? "W" : "", s.weight_kg, s.reps])).toEqual([
      ["W", 20, 3], ["W", 27.5, 2], ["W", 35, 1],
      ["", 40, 2], ["", 40, 2], ["", 40, 2], ["", 40, 2],
    ]);
  });

  it("keeps explicit per-set weights from the scheme", () => {
    const sets = planSets({ prescription: [{ weightKg: 42, reps: 2 }, { weightKg: 45, reps: 2 }], targetSets: 2, previous: [] });
    expect(sets.map((s) => s.weight_kg)).toEqual([42, 45]);
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

  describe("warmups by kind", () => {
    const work = (weight_kg: number, reps = 5) => ({ weight_kg, reps, is_warmup: false, too_heavy: false });
    const warmups = (sets: ReturnType<typeof planSets>) => sets.filter((s) => s.is_warmup).map((s) => [s.weight_kg, s.reps]);
    const plan = (warmup: Parameters<typeof planSets>[0]["warmup"], previous: ReturnType<typeof work>[], targetSets = 3) =>
      warmups(planSets({ prescription: [], targetSets, previous, warmup }));

    it("main lift: 50/70/85 % × 5/3/1 of the first work set, before the work sets", () => {
      const sets = planSets({ prescription: [], targetSets: 2, previous: [work(100), work(100)], warmup: { kind: "main", equipment: "barbell" } });
      expect(warmups(sets)).toEqual([[50, 5], [70, 3], [85, 1]]);
      expect(sets.map((s) => s.set_number)).toEqual([1, 2, 3, 4, 5]);
    });

    it("main lift with the muscle already warm: 60/80 % × 3/1", () => {
      expect(plan({ kind: "main", equipment: "barbell", muscleWarm: true }, [work(100)])).toEqual([[60, 3], [80, 1]]);
    });

    it("olympic lift: 50/70/85 % × 3/2/1", () => {
      expect(plan({ kind: "olympic", equipment: "barbell" }, [work(60, 2)])).toEqual([[30, 3], [42.5, 2], [50, 1]]);
    });

    it("other compound: 50/75 % × 6/3, or one set at 70 % × 4 when the muscle is warm", () => {
      expect(plan({ kind: "compound", equipment: "barbell" }, [work(80, 8)])).toEqual([[40, 6], [60, 3]]);
      expect(plan({ kind: "compound", equipment: "barbell", muscleWarm: true }, [work(80, 8)])).toEqual([[55, 4]]);
    });

    it("isolation: one set at 50 % × 10, none when the muscle is warm", () => {
      expect(plan({ kind: "isolation", equipment: "machine_stack" }, [work(70, 12)])).toEqual([[35, 10]]);
      expect(plan({ kind: "isolation", equipment: "cable", muscleWarm: true }, [work(70, 12)])).toEqual([]);
    });

    it("bodyweight pull: one set of half the reps, no added weight", () => {
      expect(plan({ kind: "bodyweight", equipment: "bodyweight" }, [work(0, 8)])).toEqual([[null, 4]]);
    });

    it("rounds to the equipment's step, drops sets under the empty bar or one step, merges equal weights", () => {
      expect(plan({ kind: "main", equipment: "barbell" }, [work(45)])).toEqual([[22.5, 5], [32.5, 3], [37.5, 1]]);
      expect(plan({ kind: "main", equipment: "barbell" }, [work(30)])).toEqual([[20, 3], [25, 1]]);
      expect(plan({ kind: "isolation", equipment: "cable" }, [work(7.5, 12)])).toEqual([]);
      expect(plan({ kind: "isolation", equipment: "dumbbell" }, [work(14, 12)])).toEqual([[8, 10]]);
    });

    it("skips warmups without a work weight, and keeps last time's own warmups instead", () => {
      expect(plan({ kind: "main", equipment: "barbell" }, [], 2)).toEqual([]);
      const own = [{ weight_kg: 60, reps: 5, is_warmup: true, too_heavy: false }, work(100)];
      expect(warmups(planSets({ prescription: [], targetSets: 1, previous: own, warmup: { kind: "main", equipment: "barbell" } }))).toEqual([[60, 5]]);
    });

    it("ramps from the Easy Week weight", () => {
      const sets = planSets({
        prescription: [], targetSets: 1, previous: [work(100)], warmup: { kind: "main", equipment: "barbell" },
        deload: { weightPct: 80, setPct: 100, reduceWarmups: false },
      });
      expect(warmups(sets)).toEqual([[40, 5], [55, 3], [67.5, 1]]);
    });
  });

  it("warmupKind sorts exercises by what they are", () => {
    const k = (info: Parameters<typeof warmupKind>[0]) => warmupKind(info);
    expect(k({ movementPattern: "olympic", isMainLift: true, isBodyweight: false, equipment: "barbell" })).toBe("olympic");
    expect(k({ movementPattern: "squat", isMainLift: true, isBodyweight: false, equipment: "barbell" })).toBe("main");
    expect(k({ movementPattern: "hinge", isMainLift: false, isBodyweight: false, equipment: "barbell" })).toBe("compound");
    expect(k({ movementPattern: "isolation", isMainLift: false, isBodyweight: false, equipment: "cable" })).toBe("isolation");
    expect(k({ movementPattern: "vertical_pull", isMainLift: true, isBodyweight: true, equipment: "bodyweight" })).toBe("bodyweight");
    expect(k({ movementPattern: "core", isMainLift: false, isBodyweight: true, equipment: "bodyweight" })).toBeNull();
    expect(k(undefined)).toBe("isolation");
  });

  it("warmupPlans marks a muscle warm once an earlier exercise in the workout trained it", () => {
    const lib = (movementPattern: string, primaryMuscle: string, equipment = "barbell", isMainLift = false) =>
      ({ movementPattern, primaryMuscle, equipment, isMainLift, isBodyweight: false });
    const plans = warmupPlans([
      lib("horizontal_push", "chest", "barbell", true),
      lib("vertical_push", "shoulders", "barbell", true),
      lib("horizontal_push", "chest"),
      undefined,
    ]);
    expect(plans.map((p) => p && [p.kind, !!p.muscleWarm])).toEqual([
      ["main", false], ["main", false], ["compound", true], ["isolation", false],
    ]);
  });
});
