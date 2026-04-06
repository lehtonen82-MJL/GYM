// ============================================================
// workoutImportParser.ts
//
// Parses free-form text into structured past workout sessions.
//
// Supported formats (flexible):
//
//   17.2.2024 Chest Day           ← date header, optional session name
//   Bench Press 4x5@90kg          ← exercise with sets x reps @ weight
//   Squat 5x100kg                 ← sets x weight (reps omitted)
//   Deadlift 3x5 140kg            ← space-separated weight
//   Incline 3x8                   ← no weight
//   Row 6000m 24:10 1:57/500m     ← skipped (no weight/reps — parser ignores)
//
//   Multiple sessions in one paste — each date header starts a new session.
//   Multiple lines for the same exercise on the same date → multiple entries.
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

// Fallback: "Bench Press 5x90kg" where weight is after x, no reps
// e.g. "Bench 5x90kg" → sets=5, weight=90, reps=null
const SETS_WEIGHT_ONLY_RE = /^(.+?)\s+(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*k?gs?\s*$/i;

// Full pattern with @: "Bench Press 4x5@90kg" or "4x5 @ 90"
const FULL_SCHEME_RE =
  /^(.+?)\s+(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:[@]\s*(\d+(?:\.\d+)?)\s*k?gs?)?\s*$/i;

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
  // Strip the date prefix, remainder is session name
  const remainder = line.replace(DATE_RE, "").trim();
  return { date, sessionName: remainder || null };
}

function parseExerciseLine(
  line: string
): { name: string; sets: ParsedImportSet[] } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try "Name NxR@Wkg" or "Name NxR Wkg"
  // e.g. "Bench Press 4x5@90kg", "Bench Press 4x5 90kg", "Bench Press 4x5"
  const fullMatch = FULL_SCHEME_RE.exec(trimmed);
  if (fullMatch) {
    const name = fullMatch[1].trim();
    const numSets = parseInt(fullMatch[2], 10);
    const repsOrWeight = parseFloat(fullMatch[3]);
    const explicitWeight = fullMatch[4] ? parseFloat(fullMatch[4]) : null;

    // Decide: if there's an explicit weight after @, those are reps + weight
    // Otherwise: check if the number after x is suspiciously large (>30) — likely weight, not reps
    let reps: number | null;
    let weightKg: number | null;
    if (explicitWeight !== null) {
      reps = repsOrWeight;
      weightKg = explicitWeight;
    } else {
      // "4x90kg" → no reps, just weight per set (sets=4, weight=90, reps=null)
      // "4x5" → sets=4, reps=5, no weight
      // Heuristic: if value ends with kg indicator it was already consumed by regex
      reps = repsOrWeight;
      weightKg = null;
    }

    if (!name || numSets < 1 || numSets > 100) return null;

    const sets: ParsedImportSet[] = Array.from({ length: numSets }, () => ({
      weightKg,
      reps,
    }));
    return { name, sets };
  }

  // Try "Name NxWkg" (weight-only, no reps)
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

    // Try date header first
    const header = parseDateHeader(line);
    if (header) {
      // Flush current and start new session
      currentSession = {
        date: header.date,
        sessionName: header.sessionName,
        exercises: [],
      };
      sessions.push(currentSession);
      continue;
    }

    // Try exercise line
    const exercise = parseExerciseLine(line);
    if (exercise) {
      if (!currentSession) {
        // Exercise without a date header — use today as date
        currentSession = {
          date: new Date(),
          sessionName: null,
          exercises: [],
        };
        sessions.push(currentSession);
        warnings.push({
          line: lineNum,
          text: line,
          message: "No date found before this exercise — using today's date",
        });
      }
      currentSession.exercises.push({ ...exercise, line: lineNum });
      continue;
    }

    // Couldn't parse — warn if it looks like it was intended as an exercise
    if (line.length > 2 && !/^[#\/\-]/.test(line)) {
      warnings.push({
        line: lineNum,
        text: line,
        message: "Could not parse this line — skipped",
      });
    }
  }

  // Drop sessions with no exercises
  const validSessions = sessions.filter((s) => s.exercises.length > 0);

  return { sessions: validSessions, warnings };
}
