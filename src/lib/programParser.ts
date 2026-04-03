// Parser utility for program text import

export interface ParsedDay {
  name: string;
  label?: string;
  exercises: ParsedExercise[];
}

export interface ParsedExercise {
  name: string;
  schemeText?: string;
  targetSets?: number;
  targetRepsText?: string;
  notes?: string;
}

export interface ParserWarning {
  line?: number;
  type: "unknown_exercise" | "malformed_line" | "empty_day" | "duplicate_day";
  message: string;
}

const WEEKDAY_NAMES = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
]);

/**
 * Parse workout program text
 * Supports both weekday and session headers
 * Format:
 *   [Day Name]
 *   Exercise Name | Scheme | Notes
 *   Exercise Name | Scheme
 */
export function parseProgram(text: string): {
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: "weekday" | "session";
} {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const days: ParsedDay[] = [];
  const warnings: ParserWarning[] = [];
  const seenDayNames = new Set<string>();

  let currentDay: ParsedDay | null = null;
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;

    // Check if it's a day header: [Something]
    if (line.startsWith("[") && line.endsWith("]")) {
      if (currentDay && currentDay.exercises.length === 0) {
        warnings.push({
          line: lineNum - 1,
          type: "empty_day",
          message: `Day "${currentDay.name}" has no exercises`,
        });
      }

      const dayName = line.slice(1, -1).trim();

      if (seenDayNames.has(dayName.toLowerCase())) {
        warnings.push({
          line: lineNum,
          type: "duplicate_day",
          message: `Duplicate day name: "${dayName}"`,
        });
      }

      seenDayNames.add(dayName.toLowerCase());

      currentDay = {
        name: dayName,
        exercises: [],
      };
      days.push(currentDay);
      continue;
    }

    // Parse exercise line: Name | Scheme | Notes
    if (line.includes("|")) {
      if (!currentDay) {
        warnings.push({
          line: lineNum,
          type: "malformed_line",
          message: "Exercise line found before any day header",
        });
        continue;
      }

      const parts = line.split("|").map((p) => p.trim());

      if (parts.length === 0 || !parts[0]) {
        warnings.push({
          line: lineNum,
          type: "malformed_line",
          message: "Empty exercise name",
        });
        continue;
      }

      const exerciseName = parts[0];
      const schemeText = parts[1];
      const notes = parts[2];

      const targetSets = extractTargetSets(schemeText);

      currentDay.exercises.push({
        name: exerciseName,
        schemeText: schemeText || undefined,
        targetSets,
        targetRepsText: undefined,
        notes: notes || undefined,
      });
      continue;
    }

    // Unrecognized line
    if (line && !line.startsWith("[")) {
      warnings.push({
        line: lineNum,
        type: "malformed_line",
        message: `Line not recognized (missing exercise format): "${line.substring(0, 50)}"`,
      });
    }
  }

  // Check last day
  if (currentDay && currentDay.exercises.length === 0) {
    warnings.push({
      line: lineNum,
      type: "empty_day",
      message: `Day "${currentDay.name}" has no exercises`,
    });
  }

  // Detect mode
  const detectedMode = detectMode(days);

  return {
    days,
    warnings,
    detectedMode,
  };
}

/**
 * Extract target sets from scheme text
 * Examples: "3x5" -> 3, "4x2" -> 4, "1x5 + 2x5" -> 3, "3x8-10" -> 3
 */
function extractTargetSets(schemeText?: string): number | undefined {
  if (!schemeText) return undefined;

  // Count number of set groups (separated by +)
  const groups = schemeText.split("+").length;
  if (groups > 1) return groups;

  // Extract first number from pattern like "3x5"
  const match = schemeText.match(/(\d+)x/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Detect if program is weekday-based or session-based
 */
function detectMode(days: ParsedDay[]): "weekday" | "session" {
  if (days.length === 0) return "session";

  const isWeekday = days.every((day) =>
    WEEKDAY_NAMES.has(day.name.toLowerCase())
  );

  return isWeekday ? "weekday" : "session";
}
