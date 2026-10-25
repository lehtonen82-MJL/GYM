import { weeklyMuscleSets } from "./muscleVolume";

// Sunday 2026-10-25 12:00 local; the current week starts Monday 2026-10-19
const now = new Date(2026, 9, 25, 12, 0);
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0).toISOString();
const done = (n: number, weight = 50) =>
  Array.from({ length: n }, () => ({ weight_kg: weight, reps: 10, completed: true, is_warmup: false }));

describe("weeklyMuscleSets", () => {
  it("counts completed work sets per primary muscle per Monday–Sunday week, oldest week first", () => {
    const result = weeklyMuscleSets(
      [
        { started_at: at(2026, 10, 19), primary_muscle: "chest", sets: done(3) },
        { started_at: at(2026, 10, 25), primary_muscle: "chest", sets: done(2) },
        { started_at: at(2026, 10, 18), primary_muscle: "chest", sets: done(4) },
      ],
      now,
      2
    );
    expect(result.weekStarts).toEqual([new Date(2026, 9, 12).toISOString(), new Date(2026, 9, 19).toISOString()]);
    expect(result.muscles).toEqual([{ muscle: "chest", weeklySets: [4, 5], kgThisWeek: 2500 }]);
  });

  it("leaves out planned and warmup sets", () => {
    const sets = [
      ...done(2),
      { weight_kg: 50, reps: 10, completed: false, is_warmup: false },
      { weight_kg: 30, reps: 10, completed: true, is_warmup: true },
    ];
    const result = weeklyMuscleSets([{ started_at: at(2026, 10, 20), primary_muscle: "quads", sets }], now, 1);
    expect(result.muscles[0].weeklySets).toEqual([2]);
  });

  it("puts exercises without a library link last as unlinked, sorts the rest by this week's sets", () => {
    const result = weeklyMuscleSets(
      [
        { started_at: at(2026, 10, 20), primary_muscle: null, sets: done(9) },
        { started_at: at(2026, 10, 20), primary_muscle: "biceps", sets: done(2) },
        { started_at: at(2026, 10, 20), primary_muscle: "back_lats", sets: done(6) },
      ],
      now,
      1
    );
    expect(result.muscles.map((m) => m.muscle)).toEqual(["back_lats", "biceps", null]);
  });

  it("ignores workouts outside the weeks shown (8 weeks back from Mon 19.10. starts Mon 31.8.)", () => {
    const result = weeklyMuscleSets([{ started_at: at(2026, 8, 30), primary_muscle: "chest", sets: done(3) }], now, 8);
    expect(result.muscles).toEqual([]);
  });
});
