import { filterWorkouts, visibleSelection } from "./historyFilter";

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

describe("visibleSelection", () => {
  const visible = [{ id: "a" }, { id: "b" }];

  it("drops selected workouts that the search has hidden", () => {
    expect(visibleSelection(new Set(["a", "hidden"]), visible)).toEqual(["a"]);
  });

  it("is empty when only hidden workouts are selected", () => {
    expect(visibleSelection(new Set(["hidden"]), visible)).toEqual([]);
  });
});
