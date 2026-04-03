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

export interface PrescribedSet {
  weightKg?: number;
  reps?: number;
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

  const inlineSessionResult = parseInlineSessionFormat(normalized);
  if (inlineSessionResult.days.length > 0) return inlineSessionResult;

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
      dayName = cleanLeadingJunk(first);
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

function parseInlineSessionFormat(text: string): {
  days: ParsedDay[];
  warnings: ParserWarning[];
  detectedMode: "weekday" | "session";
} {
  const warnings: ParserWarning[] = [];
  const days: ParsedDay[] = [];
  const workoutMatches = [...text.matchAll(/workout\s*\d+/gi)];

  if (workoutMatches.length === 0) {
    return { days: [], warnings, detectedMode: "session" };
  }

  for (let i = 0; i < workoutMatches.length; i++) {
    const current = workoutMatches[i];
    const next = workoutMatches[i + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? text.length;

    let segment = text.slice(start, end).trim();
    segment = segment.replace(/^workout\s*\d+\s*[-:|]?\s*/i, "");

    const tokens = segment
      .split(/\s+-\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (tokens.length === 0) continue;

    const workoutLabel = cleanLeadingJunk(current[0] || `Workout ${i + 1}`);
    let dayName = workoutLabel;
    let firstExerciseIndex = 0;
    const first = tokens[0];

    if (first && !first.includes("|") && tokens.length > 1) {
      dayName = cleanLeadingJunk(first) || workoutLabel;
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
        message: `Workout "${dayName}" has no exercises`,
      });
      continue;
    }

    days.push({
      name: dayName,
      label: workoutLabel,
      exercises,
    });
  }

  return {
    days,
    warnings,
    detectedMode: days.length > 0 ? "session" : "weekday",
  };
}

function parseExerciseToken(token: string): ParsedExercise | null {
  const parts = token
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) return null;

  const exerciseName = cleanLeadingJunk(parts[0]);
  if (!exerciseName) return null;

  const schemeText = parts[1];
  const notes = parts.length > 2 ? parts.slice(2).join(" | ") : undefined;
  const scheme = parseSchemeText(schemeText);

  return {
    name: exerciseName,
    schemeText: schemeText || undefined,
    targetSets: scheme.targetSets,
    targetRepsText: scheme.targetRepsText,
    notes: notes || undefined,
  };
}

function normalizeText(input: string): string {
  return input.replace(/[–—−]/g, "-");
}

function cleanLeadingJunk(value: string): string {
  return value.replace(/^[^A-Za-z0-9]+/, "").trim();
}

export function parseSchemeText(schemeText?: string): {
  targetSets?: number;
  targetRepsText?: string;
} {
  if (!schemeText) return {};

  const raw = schemeText.trim();
  if (!raw) return {};

  // Weighted set list: "42x2, 42x2, 42x2"
  const commaParts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (commaParts.length > 1) {
    const repsValues = commaParts
      .map((part) => {
        const match = part.match(/^\d+(?:\.\d+)?\s*x\s*(\d+(?:-\d+)?)$/i);
        return match ? match[1] : null;
      })
      .filter((v): v is string => Boolean(v));

    if (repsValues.length === commaParts.length) {
      return {
        targetSets: commaParts.length,
        targetRepsText:
          new Set(repsValues).size === 1 ? repsValues[0] : repsValues.join(","),
      };
    }
  }

  // Multi-block set expression: "1x5 + 2x5"
  const plusParts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);

  if (plusParts.length > 1) {
    const setCounts: number[] = [];
    const repsValues: string[] = [];

    for (const part of plusParts) {
      const match = part.match(/^(\d+)\s*x\s*(\d+(?:-\d+)?)$/i);
      if (!match) return {};
      setCounts.push(parseInt(match[1], 10));
      repsValues.push(match[2]);
    }

    return {
      targetSets: setCounts.reduce((sum, n) => sum + n, 0),
      targetRepsText:
        new Set(repsValues).size === 1 ? repsValues[0] : repsValues.join(","),
    };
  }

  // Single block: either sets x reps ("3x12") or weight x reps ("80x8")
  const single = raw.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:-\d+)?)$/i);
  if (!single) return {};

  const leftRaw = single[1];
  const left = parseFloat(leftRaw);
  const reps = single[2];
  const looksLikeWeight = leftRaw.includes(".") || left > 20;

  return {
    targetSets: looksLikeWeight ? 1 : Math.max(1, Math.round(left)),
    targetRepsText: reps,
  };
}

export function parseSchemePrescription(schemeText?: string): PrescribedSet[] {
  if (!schemeText) return [];
  const raw = schemeText.trim();
  if (!raw) return [];

  // Weighted set list: "42x2, 45x2, 45x2"
  const commaParts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (commaParts.length > 1) {
    const parsed = commaParts
      .map((part) => {
        const match = part.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+)$/i);
        if (!match) return null;
        return {
          weightKg: parseFloat(match[1]),
          reps: parseInt(match[2], 10),
        };
      })
      .filter((v): v is { weightKg: number; reps: number } => Boolean(v));

    if (parsed.length === commaParts.length) return parsed;
  }

  // Multi-block set expression: "1x5 + 2x5"
  const plusParts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (plusParts.length > 1) {
    const result: PrescribedSet[] = [];
    for (const part of plusParts) {
      const match = part.match(/^(\d+)\s*x\s*(\d+)$/i);
      if (!match) return [];
      const count = parseInt(match[1], 10);
      const reps = parseInt(match[2], 10);
      for (let i = 0; i < count; i++) {
        result.push({ reps });
      }
    }
    return result;
  }

  // Single pattern: sets x reps (3x12) or weight x reps (80x8).
  const single = raw.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+)$/i);
  if (!single) return [];

  const leftRaw = single[1];
  const left = parseFloat(leftRaw);
  const reps = parseInt(single[2], 10);
  const looksLikeWeight = leftRaw.includes(".") || left > 20;

  if (looksLikeWeight) return [{ weightKg: left, reps }];

  const sets = Math.max(1, Math.round(left));
  return Array.from({ length: sets }, () => ({ reps }));
}

/**
 * Detect if program is weekday-based or session-based.
 */
function detectMode(days: ParsedDay[]): "weekday" | "session" {
  if (days.length === 0) return "session";

  const isWeekday = days.every((day) => WEEKDAY_NAMES.has(day.name.toLowerCase()));

  return isWeekday ? "weekday" : "session";
}
