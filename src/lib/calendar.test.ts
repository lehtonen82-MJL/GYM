import { localDay, monthGrid, weekStreak } from "./calendar";

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h, 0).toISOString();

describe("localDay", () => {
  it("is the calendar day in local time", () => {
    expect(localDay(new Date(2026, 9, 25, 0, 30))).toBe("2026-10-25");
    expect(localDay(at(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("weekStreak", () => {
  // Sunday 2026-10-25; this week starts Monday 2026-10-19
  const now = new Date(2026, 9, 25, 12);

  it("counts consecutive Monday–Sunday weeks with a workout, up to this week", () => {
    expect(weekStreak([at(2026, 10, 20), at(2026, 10, 14), at(2026, 10, 6), at(2026, 9, 20)], now)).toBe(3);
  });

  it("doesn't break on a current week that has no workout yet", () => {
    expect(weekStreak([at(2026, 10, 14), at(2026, 10, 6)], now)).toBe(2);
  });

  it("is 0 when last week and this week have no workout", () => {
    expect(weekStreak([at(2026, 10, 6)], now)).toBe(0);
    expect(weekStreak([], now)).toBe(0);
  });

  it("counts a week once however many workouts it has", () => {
    expect(weekStreak([at(2026, 10, 19), at(2026, 10, 21), at(2026, 10, 25, 20)], now)).toBe(1);
  });
});

describe("monthGrid", () => {
  it("lists the month's days in Monday-first weeks, padding with null", () => {
    // October 2026 starts on a Thursday and has 31 days
    const grid = monthGrid(2026, 9);
    expect(grid[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(grid[grid.length - 1]).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});
