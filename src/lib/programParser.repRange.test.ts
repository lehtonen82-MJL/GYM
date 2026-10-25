import { parseRepRange } from "./programParser";

describe("parseRepRange", () => {
  it("reads a single rep count or a min-max range", () => {
    expect(parseRepRange("12")).toEqual({ min: 12, max: 12 });
    expect(parseRepRange("10-12")).toEqual({ min: 10, max: 12 });
    expect(parseRepRange("6–8")).toEqual({ min: 6, max: 8 });
  });

  it("finds the reps in a scheme text", () => {
    expect(parseRepRange("3x10-12")).toEqual({ min: 10, max: 12 });
    expect(parseRepRange("4x2")).toEqual({ min: 2, max: 2 });
  });

  it("is null without a rep count", () => {
    expect(parseRepRange(undefined)).toBeNull();
    expect(parseRepRange("AMRAP")).toBeNull();
  });
});
