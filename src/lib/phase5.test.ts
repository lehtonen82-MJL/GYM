import { filterWorkouts } from "./historyFilter";
import { platesFor, DEFAULT_PLATES } from "./plates";
import { sessionVolume } from "./volume";

describe("platesFor", () => {
  it("loads 100 kg on a 20 kg bar", () => {
    expect(platesFor(100, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [25, 15], loaded: 100, remainder: 0 });
  });

  it("uses small plates", () => {
    expect(platesFor(62.5, 20, DEFAULT_PLATES.kg).perSide).toEqual([20, 1.25]);
  });

  it("works in lb", () => {
    expect(platesFor(225, 45, DEFAULT_PLATES.lb).perSide).toEqual([45, 45]);
    expect(platesFor(135, 45, DEFAULT_PLATES.lb).perSide).toEqual([45]);
  });

  it("finds exact loads greedy would miss", () => {
    // 80 on a 20 bar = 30 per side; greedy 20 + (10 unavailable) fails, 15 + 15 works
    expect(platesFor(80, 20, [20, 15])).toEqual({ perSide: [15, 15], loaded: 80, remainder: 0 });
  });

  it("rounds down to the nearest loadable weight", () => {
    expect(platesFor(101, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [25, 15], loaded: 100, remainder: 1 });
  });

  it("handles an empty or too-light bar", () => {
    expect(platesFor(20, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [], loaded: 20, remainder: 0 });
    expect(platesFor(15, 20, DEFAULT_PLATES.kg)).toEqual({ perSide: [], loaded: 20, remainder: -5 });
  });
});

describe("sessionVolume", () => {
  it("sums weight × reps of work sets with data", () => {
    expect(
      sessionVolume([
        { weight_kg: 60, reps: 10, is_warmup: true },
        { weight_kg: 100, reps: 5, is_warmup: false },
        { weight_kg: 100, reps: 5 },
        { weight_kg: 100, reps: null },
        { weight_kg: null, reps: 12 },
        { weight_kg: 102.5, reps: 3 },
      ])
    ).toBe(1307.5);
  });

  it("is 0 for bodyweight-only sessions", () => {
    expect(sessionVolume([{ weight_kg: 0, reps: 10 }])).toBe(0);
  });
});

describe("filterWorkouts", () => {
  const workouts = [
    { id: 1, started_at: "2026-10-24T09:00:00Z", title: "Legs", exercise_names: ["Back Squat", "Leg Curl"], notes: null },
    { id: 2, started_at: "2026-10-20T09:00:00Z", title: "Push", exercise_names: ["Bench Press"], notes: "felt strong" },
  ];
  const fmt = (iso: string) => (iso.startsWith("2026-10-24") ? "Oct 24" : "Oct 20");
  const ids = (q: string) => filterWorkouts(workouts, q, fmt).map((w) => w.id);

  it("returns everything for an empty query", () => {
    expect(ids("  ")).toEqual([1, 2]);
  });

  it("matches exercise names, titles, notes and dates", () => {
    expect(ids("squat")).toEqual([1]);
    expect(ids("PUSH")).toEqual([2]);
    expect(ids("strong")).toEqual([2]);
    expect(ids("oct 24")).toEqual([1]);
    expect(ids("2026-10-20")).toEqual([2]);
  });

  it("requires every word to match", () => {
    expect(ids("bench squat")).toEqual([]);
    expect(ids("leg curl")).toEqual([1]);
  });
});
