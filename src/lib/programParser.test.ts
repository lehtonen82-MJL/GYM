import { parseProgram } from "./programParser";

describe("parseProgram", () => {
  it("weekday mode with scheme and notes", () => {
    const result = parseProgram(`[Monday]
Back Squat | 4x2
Bench Press | 5x5 | Top set heavy

[Wednesday]
Deadlift | 1x5 + 5x3
Pull-ups | 3x8`);

    expect(result.detectedMode).toBe("weekday");
    expect(result.days).toHaveLength(2);
    expect(result.days[0].exercises).toHaveLength(2);
    expect(result.days[1].exercises).toHaveLength(2);
  });

  it("session mode", () => {
    const result = parseProgram(`[Workout 1]
Snatch | 4x2
Clean & Jerk | 4x2
Back Squat | 1x5 + 2x5 | top set + backoff
Calves | 3x12

[Workout 2]
Pull-up | 3x8
Row | 3x10
Face Pull | 3x15
RDL | 3x8`);

    expect(result.detectedMode).toBe("session");
    expect(result.days).toHaveLength(2);
    expect(result.days[0].exercises).toHaveLength(4);
    expect(result.days[1].exercises).toHaveLength(4);
  });

  it("simple exercises without scheme", () => {
    const result = parseProgram(`[Chest Day]
Bench Press
Incline Dumbbell Press | 3x8
Dips`);

    expect(result.detectedMode).toBe("session");
    expect(result.days).toHaveLength(1);
    expect(result.days[0].exercises).toHaveLength(3);
  });

  it("inline session mode with workout headings and weighted sets", () => {
    const result = parseProgram(
      "Sessions Mode - Program name: 4-day program (kevennetty) Workout 1 - Oly - Snatch | 42x2, 42x2, 42x2, 42x2 - Clean & Jerk | 45x2, 45x2, 45x2, 45x2 - Calves | 3x12 Workout 2 - Back - Pull-up | 3x8 - Row | 3x8 - Face Pull | 3x15 - Romanian Deadlift | 80x8, 80x8, 80x8 Workout 3 - Legs - Back Squat | 100x5, 92.5x5, 92.5x5 - Front Squat | 62.5x5, 62.5x5, 62.5x5 - Leg Curl | 3x12 - Calves | 3x15 Workout 4 - Chest - Bench Press | 87.5x5, 87.5x5, 87.5x5, 87.5x5 - Incline Bench Press | 3x8 - Dips | 3x8 - Fly | 2x12 - Triceps | 2x12 - Light Row | 2x12"
    );

    expect(result.detectedMode).toBe("session");
    expect(result.days).toHaveLength(4);
    expect(result.days[0].exercises).toHaveLength(3);
    expect(result.days[1].exercises).toHaveLength(4);
    expect(result.days[2].exercises).toHaveLength(4);
    expect(result.days[3].exercises).toHaveLength(6);
  });
});
