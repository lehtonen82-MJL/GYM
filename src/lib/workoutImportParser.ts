// ============================================================
// workoutImportParser.ts
//
// Parses free-form text into structured past workout sessions.
//
// Supported formats:
//
//   17.2.2024 Chest Day             DD.MM.YYYY date, optional session name
//   2026-04-02 - Workout 2          YYYY-MM-DD, dash/en-dash separator ok
//
//   Pull-up: 3x8                    colon format - N sets x R reps (no weight)
//   Row: 55x8, 55x8, 55x8          colon format - comma list, each WxR
//   Romanian Deadlift: 65x8, 65x8  same
//   Face Pull: 3x15                 colon format - N sets x R reps
//
//   Bench Press 4x5@90kg            no-colon, setsxreps@weight
//   Bench Press 4x5 90kg            no-colon, space-separated weight
//   Squat 5x100kg                   no-colon, setsxweight (kg suffix, no reps)
//   Pull-up 3x8                     no-colon, setsxreps, no weight
//
//   Multiple sessions in one paste - each date header starts a new session.
// ============================================================

export type ParsedImportSet = {
  weightKg: number | null;
  reps: number | null;
};

export type ParsedImportExercise = {
  name: string;
  sets: ParsedImportSet[];
  line: number;
};

export type ParsedImportSession = {
  date: Date;
  sessionName: string | null;
  exercises: ParsedImportExercise[];
};

export type ImportWarning = {
  line: number;
  text: string;
  message: string;
};

export type WorkoutImportResult = {
  sessions: ParsedImportSession[];
  warnings: ImportWarning[];
};

// DD.MM.YYYY  or  D.M.YYYY  or  YYYY-MM-DD
const DATE_RE = /^(?:(\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{4})-(\d{2})-(\d{2}))/;

// No-colon: "Name NxR@Wkg" or "Name NxR Wkg" or "Name NxR"
const FULL_SCHEME_RE =
  /^(.+?)\s+(\d+)\s*[x\xd7]\s*(\d+(?:\.\d+)?)\s*(?:[@]\s*(\d+(?:\.\d+)?)\s*k?gs?)?\s*$/i;

// No-colon: "Name NxWkg" (weight only, kg suffix required, no reps)
const SETS_WEIGHT_ONLY_RE = /^(.+?)\s+(\d+)\s*[x\xd7]\s*(\d+(?:\.\d+)?)\s*k?gs?\s*$/i;

function parseDate(line: string): Date | null {
  const m = DATE_RE.exec(line);
  if (!m) return null;
  let day: number, month: number, year: number;
  if (m[1]) {
    day = parseInt(m[1], 10);
    month = parseInt(m[2], 10) - 1;
    year = parseInt(m[3], 10);
  } else {
    year = parseInt(m[4], 10);
    month = parseInt(m[5], 10) - 1;
    day = parseInt(m[6], 10);
  }
  const d = new Date(year, month, day, 12, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseDateHeader(line: string): { date: Date; sessionName: string | null } | null {
  const date = parseDate(line);
  if (!date) return null;
  // Strip date prefix, then strip leading hyphens / en-dashes / em-dashes
  let remainder = line.replace(DATE_RE, "").trim();
  remainder = remainder.replace(/^[\u2013\u2014\-]+\s*/, "").trim();
  return { date, sessionName: remainder || null };
}

/** Parses a single "AxB" token, e.g. "55x8" -> {a:55, b:8} */
function parseAxB(s: string): { a: number; b: number } | null {
  const m = /^(\d+(?:\.\d+)?)\s*[x\xd7]\s*(\d+(?:\.\d+)?)$/i.exec(s.trim());
  if (!m) return null;
  return { a: parseFloat(m[1]), b: parseFloat(m[2]) };
}

/**
 * Parses the set specification after a colon:
 *   "3x8"        -> 3 sets x 8 reps, no weight     (a <= 20, integer)
 *   "55x8"       -> 1 set, weight=55, reps=8        (a > 20)
 *   "55x8, 55x8" -> 2 individual sets, WxR each
 */
function parseSetSpec(spec: string): ParsedImportSet[] | null {
  const parts = spec.split(",").map((s) => s.trim()).filter(Boolean);

  if (parts.length > 1) {
    // Comma-separated individual sets: each "WxR"
    const sets: ParsedImportSet[] = [];
    for (const part of parts) {
      const axb = parseAxB(part);
      if (!axb) return null;
      sets.push({ weightKg: axb.a, reps: axb.b });
    }
    return sets;
  }

  if (parts.length === 0) return null;
  const axb = parseAxB(parts[0]);
  if (!axb) return null;

  // Small integer 'a' -> treat as "N sets x R reps" (bodyweight / no weight)
  if (axb.a <= 20 && Number.isInteger(axb.a)) {
    return Array.from({ length: Math.round(axb.a) }, () => ({
      weightKg: null,
      reps: axb.b,
    }));
  }

  // Otherwise treat as 1 set: weight=a, reps=b
  return [{ weightKg: axb.a, reps: axb.b }];
}

function parseExerciseLine(
  line: string
): { name: string; sets: ParsedImportSet[] } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Format 1: "Name: SETSPEC" (colon separator)
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx > 0) {
    const name = trimmed.slice(0, colonIdx).trim();
    const specStr = trimmed.slice(colonIdx + 1).trim();
    if (name && specStr) {
      const sets = parseSetSpec(specStr);
      if (sets && sets.length > 0) return { name, sets };
    }
  }

  // Format 2: "Name NxR@Wkg" / "Name NxR Wkg" / "Name NxR"
  const fullMatch = FULL_SCHEME_RE.exec(trimmed);
  if (fullMatch) {
    const name = fullMatch[1].trim();
    const numSets = parseInt(fullMatch[2], 10);
    const reps = parseFloat(fullMatch[3]);
    const explicitWeight = fullMatch[4] ? parseFloat(fullMatch[4]) : null;
    if (!name || numSets < 1 || numSets > 100) return null;
    const sets: ParsedImportSet[] = Array.from({ length: numSets }, () => ({
      weightKg: explicitWeight,
      reps,
    }));
    return { name, sets };
  }

  // Format 3: "Name NxWkg" (weight only, kg suffix)
  const weightOnlyMatch = SETS_WEIGHT_ONLY_RE.exec(trimmed);
  if (weightOnlyMatch) {
    const name = weightOnlyMatch[1].trim();
    const numSets = parseInt(weightOnlyMatch[2], 10);
    const weightKg = parseFloat(weightOnlyMatch[3]);
    if (!name || numSets < 1 || numSets > 100) return null;
    const sets: ParsedImportSet[] = Array.from({ length: numSets }, () => ({
      weightKg,
      reps: null,
    }));
    return { name, sets };
  }

  return null;
}

export function parseWorkoutImport(text: string): WorkoutImportResult {
  const lines = text.split(/\r?\n/);
  const sessions: ParsedImportSession[] = [];
  const warnings: ImportWarning[] = [];
  let currentSession: ParsedImportSession | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();
    if (!line) continue;

    const header = parseDateHeader(line);
    if (header) {
      currentSession = {
        date: header.date,
        sessionName: header.sessionName,
        exercises: [],
      };
      sessions.push(currentSession);
      continue;
    }

    const exercise = parseExerciseLine(line);
    if (exercise) {
      if (!currentSession) {
        currentSession = {
          date: new Date(),
          sessionName: null,
          exercises: [],
        };
        sessions.push(currentSession);
        warnings.push({
          line: lineNum,
          text: line,
          message: "No date found before this exercise - using today's date",
        });
      }
      currentSession.exercises.push({ ...exercise, line: lineNum });
      continue;
    }

    // Warn for lines that look like they were intended as data
    if (line.length > 2 && !/^[#/\-\u2013\u2014]/.test(line)) {
      warnings.push({
        line: lineNum,
        text: line,
        message: "Could not parse this line - skipped",
      });
    }
  }

  return {
    sessions: sessions.filter((s) => s.exercises.length > 0),
    warnings,
  };
}