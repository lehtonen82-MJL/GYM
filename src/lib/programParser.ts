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
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
  "maanantai",
  "tiistai",
  "keskiviikko",
  "torstai",
  "perjantai",
  "lauantai",
  "sunnuntai",
]);

const WEEKDAY_REGEX =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

/**
 * Parse workout program text.
 *
 * Supports both:
 * 1) Bracket format:
 *    [Day Name]
 *    Exercise Name | Scheme | Notes
 *
 * 2) Inline weekday format:
 *    Tuesday - Oly - Snatch | 4x2 - Clean & Jerk | 4x2
 */
export function parseProgram(text: string): {
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: "weekday" | "session";
} {
  const normalized = normalizeText(text);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { days: [], warnings: [], detectedMode: "session" };
  }

  if (lines.some((line) => line.startsWith("[") && line.endsWith("]"))) {
    return parseBracketFormat(lines);
  }

  const inlineWeekdayResult = parseInlineWeekdayFormat(normalized);
  if (inlineWeekdayResult.days.length > 0) return inlineWeekdayResult;

  return {
    days: [],
    warnings: [
      {
        type: "malformed_line",
        message:
          'No day structure found. Use "[Day]" lines or weekday format like "Tuesday - ...".',
      },
    ],
    detectedMode: "session",
  };
}

function parseBracketFormat(lines: string[]): {
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: "weekday" | "session";
} {
  const days: ParsedDay[] = [];
  const warnings: ParserWarning[] = [];
  const seenDayNames = new Set<string>();

  let currentDay: ParsedDay | null = null;
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;

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

    if (!currentDay) {
      warnings.push({
        line: lineNum,
        type: "malformed_line",
        message: "Exercise line found before any day header",
      });
      continue;
    }

    const exercise = parseExerciseToken(line);
    if (exercise) {
      currentDay.exercises.push(exercise);
    } else {
      warnings.push({
        line: lineNum,
        type: "malformed_line",
        message: `Line not recognized: "${line.substring(0, 50)}"`,
      });
    }
  }

  if (currentDay && currentDay.exercises.length === 0) {
    warnings.push({
      line: lineNum,
      type: "empty_day",
      message: `Day "${currentDay.name}" has no exercises`,
    });
  }

  return {
    days,
    warnings,
    detectedMode: detectMode(days),
  };
}

function parseInlineWeekdayFormat(text: string): {
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: "weekday" | "session";
} {
  const warnings: ParserWarning[] = [];
  const days: ParsedDay[] = [];
  const matches = [...text.matchAll(WEEKDAY_REGEX)];

  if (matches.length === 0) {
    return { days: [], warnings, detectedMode: "session" };
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const weekday = (current[0] ?? "").trim();
    const start = current.index ?? 0;
    const end = next?.index ?? text.length;

    let segment = text.slice(start, end).trim();
    segment = segment.replace(new RegExp(`^${weekday}\\s*[-:|]?\\s*`, "i"), "");
    if (!segment) continue;

    const tokens = segment
      .split(/\s+-\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      warnings.push({
        type: "empty_day",
        message: `Day "${weekday}" has no exercises`,
      });
      continue;
    }

    let dayName = weekday;
    let firstExerciseIndex = 0;
    const first = tokens[0];

    if (first && !first.includes("|") && tokens.length > 1) {
      dayName = first;
      firstExerciseIndex = 1;
    }

    const exercises: ParsedExercise[] = [];

    for (
      let tokenIndex = firstExerciseIndex;
      tokenIndex < tokens.length;
      tokenIndex++
    ) {
      const parsed = parseExerciseToken(tokens[tokenIndex]);

      if (parsed) {
        exercises.push(parsed);
      } else {
        warnings.push({
          type: "malformed_line",
          message: `Could not parse exercise token "${tokens[tokenIndex].slice(0, 50)}"`,
        });
      }
    }

    if (exercises.length === 0) {
      warnings.push({
        type: "empty_day",
        message: `Day "${dayName}" has no exercises`,
      });
      continue;
    }

    days.push({
      name: dayName,
      label: weekday,
      exercises,
    });
  }

  return {
    days,
    warnings,
    detectedMode: days.length > 0 ? "weekday" : "session",
  };
}

function parseExerciseToken(token: string): ParsedExercise | null {
  const parts = token
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) return null;

  const exerciseName = parts[0];
  if (!exerciseName) return null;

  const schemeText = parts[1];
  const notes = parts.length > 2 ? parts.slice(2).join(" | ") : undefined;

  return {
    name: exerciseName,
    schemeText: schemeText || undefined,
    targetSets: extractTargetSets(schemeText),
    targetRepsText: undefined,
    notes: notes || undefined,
  };
}

function normalizeText(input: string): string {
  return input.replace(/[–—-]/g, "-");
}

/**
 * Extract target sets from scheme text.
 * Examples: "3x5" -> 3, "4x2" -> 4, "1x5 + 2x5" -> 3, "3x8-10" -> 3
 */
function extractTargetSets(schemeText?: string): number | undefined {
  if (!schemeText) return undefined;

  const matches = [...schemeText.matchAll(/(\d+)\s*x/gi)];
  if (matches.length > 0) {
    return matches.reduce((sum, m) => sum + parseInt(m[1], 10), 0);
  }

  return undefined;
}

/**
 * Detect if program is weekday-based or session-based.
 */
function detectMode(days: ParsedDay[]): "weekday" | "session" {
  if (days.length === 0) return "session";

  const isWeekday = days.every((day) => WEEKDAY_NAMES.has(day.name.toLowerCase()));

  return isWeekday ? "weekday" : "session";
}
