// Test cases for program parser

import { parseProgram } from "./programParser";

const testCases = [
  {
    name: "Weekday mode with scheme and notes",
    input: `[Monday]
Back Squat | 4x2
Bench Press | 5x5 | Top set heavy

[Wednesday]
Deadlift | 1x5 + 5x3
Pull-ups | 3x8`,
    expectedMode: "weekday",
    expectedDays: 2,
    expectedExercises: [2, 2],
  },
  {
    name: "Session mode",
    input: `[Workout 1]
Snatch | 4x2
Clean & Jerk | 4x2
Back Squat | 1x5 + 2x5 | top set + backoff
Calves | 3x12

[Workout 2]
Pull-up | 3x8
Row | 3x10
Face Pull | 3x15
RDL | 3x8`,
    expectedMode: "session",
    expectedDays: 2,
    expectedExercises: [4, 4],
  },
  {
    name: "Simple exercises without scheme",
    input: `[Chest Day]
Bench Press
Incline Dumbbell Press | 3x8
Dips`,
    expectedMode: "session",
    expectedDays: 1,
    expectedExercises: [3],
  },
  {
    name: "Inline session mode with workout headings and weighted sets",
    input:
      "Sessions Mode - Program name: 4-day program (kevennetty) Workout 1 - Oly - Snatch | 42x2, 42x2, 42x2, 42x2 - Clean & Jerk | 45x2, 45x2, 45x2, 45x2 - Calves | 3x12 Workout 2 - Back - Pull-up | 3x8 - Row | 3x8 - Face Pull | 3x15 - Romanian Deadlift | 80x8, 80x8, 80x8 Workout 3 - Legs - Back Squat | 100x5, 92.5x5, 92.5x5 - Front Squat | 62.5x5, 62.5x5, 62.5x5 - Leg Curl | 3x12 - Calves | 3x15 Workout 4 - Chest - Bench Press | 87.5x5, 87.5x5, 87.5x5, 87.5x5 - Incline Bench Press | 3x8 - Dips | 3x8 - Fly | 2x12 - Triceps | 2x12 - Light Row | 2x12",
    expectedMode: "session",
    expectedDays: 4,
    expectedExercises: [3, 4, 4, 6],
  },
];

export function runTests() {
  console.log("=== Program Parser Tests ===\n");

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const result = parseProgram(test.input);

    const modeMatch = result.detectedMode === test.expectedMode;
    const daysMatch = result.days.length === test.expectedDays;
    const exercisesMatch =
      result.days.every(
        (d, i) => d.exercises.length === test.expectedExercises[i]
      );

    const success = modeMatch && daysMatch && exercisesMatch;

    console.log(`${success ? "✓" : "✗"} ${test.name}`);
    if (!success) {
      console.log(
        `  Expected: mode=${test.expectedMode}, days=${test.expectedDays}, exercises=${test.expectedExercises}`
      );
      console.log(
        `  Got: mode=${result.detectedMode}, days=${result.days.length}, exercises=${result.days.map((d) => d.exercises.length)}`
      );
    }

    if (result.warnings.length > 0) {
      console.log(`  Warnings: ${result.warnings.length}`);
      result.warnings.forEach((w) => console.log(`    - ${w.message}`));
    }

    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
}
