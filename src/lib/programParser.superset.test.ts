import { parseProgram } from "./programParser";

describe("supersets in program text", () => {
  it("reads A1/A2-style prefixes as a superset group and keeps the name clean", () => {
    const { days, warnings } = parseProgram(`Workout 2 – Pull
- Pull-up | 3x8
- A1 Biceps Curl | 2x12
- A2) Triceps Pushdown | 2x12
- B1. Face Pull | 3x15
- b2 Rear Delt Fly | 3x15`);
    expect(warnings).toEqual([]);
    expect(days[0].exercises.map((e) => [e.name, e.supersetGroup ?? null])).toEqual([
      ["Pull-up", null],
      ["Biceps Curl", "A"],
      ["Triceps Pushdown", "A"],
      ["Face Pull", "B"],
      ["Rear Delt Fly", "B"],
    ]);
  });

  it("doesn't mistake names that start with a letter and a number", () => {
    const { days } = parseProgram(`[Day]
T2 Bar Row | 3x8
A1 | 3x5`);
    expect(days[0].exercises.map((e) => [e.name, e.supersetGroup ?? null])).toEqual([["T2 Bar Row", null], ["A1", null]]);
  });
});
