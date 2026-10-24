import { sessionVolume } from "./volume";

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
