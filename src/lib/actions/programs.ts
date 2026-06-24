"use server";

import type { Program, ProgramDay, ProgramExercise, ProgramMode } from "@/lib/types";
import { DEMO_MODE, db, getUserId } from "./_shared";
import { MOCK_PROGRAMS, MOCK_PROGRAM_DAYS, MOCK_PROGRAM_EXERCISES, dayLabelFromIndex, getDemoProgramDays } from "./_mocks";

type ValidationExerciseRow = {
  exercise_name_snapshot?: string | null;
  target_sets?: number | null;
};

export type ValidationWarning = {
  type:
    | "missing_program"
    | "missing_days"
    | "missing_exercises"
    | "count_mismatch"
    | "missing_target_sets"
    | "duplicate_day"
    | "duplicate_exercise"
    | "mismatch_exercise_name";
  message: string;
  dayName?: string;
  exerciseName?: string;
};

export async function getPrograms(): Promise<Program[]> {
  if (DEMO_MODE) return MOCK_PROGRAMS;

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .neq("name", "__imports__")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getProgramsList() {
  const programs = await getPrograms();

  if (DEMO_MODE) {
    return programs.map((prog) => {
      const days = getDemoProgramDays(prog.id);
      const dayIds = new Set(days.map((d) => d.id));
      const exercisesCount = MOCK_PROGRAM_EXERCISES.filter((ex) =>
        dayIds.has(ex.workout_day_id)
      ).length;
      return {
        ...prog,
        days_count: days.length,
        exercises_count: exercisesCount,
      };
    });
  }

  const supabase = await db();
  const userId = await getUserId();

  // Fetch day and exercise counts for each program
  const result = await Promise.all(
    programs.map(async (prog) => {
      const [dayRes, exerciseRes] = await Promise.all([
        supabase
          .from("workout_days")
          .select("id", { count: "exact", head: true })
          .eq("program_id", prog.id)
          .eq("user_id", userId),
        supabase
          .from("program_exercises")
          .select("id", { count: "exact", head: true })
          .eq("program_id", prog.id)
          .eq("user_id", userId),
      ]);

      return {
        ...prog,
        days_count: dayRes.count ?? 0,
        exercises_count: exerciseRes.count ?? 0,
      };
    })
  );

  return result;
}

export async function getProgramById(id: string): Promise<Program | null> {
  if (DEMO_MODE) return MOCK_PROGRAMS.find((p) => p.id === id) ?? null;

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  return data ?? null;
}

export async function createProgram(
  name: string,
  description: string | null,
  mode: ProgramMode
): Promise<Program> {
  if (DEMO_MODE) {
    const prog: Program = {
      id: `prog-${Date.now()}`,
      user_id: "demo-user",
      name,
      description: description || undefined,
      mode,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAMS.push(prog);
    return prog;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name,
      description,
      mode,
      is_active: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create program: ${error.message}`);
  return data;
}

export async function updateProgram(
  id: string,
  updates: Partial<Program>
): Promise<Program> {
  if (DEMO_MODE) {
    const prog = MOCK_PROGRAMS.find((p) => p.id === id);
    if (!prog) throw new Error("Program not found");
    Object.assign(prog, updates);
    return prog;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("programs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update program: ${error.message}`);
  return data;
}

export async function setActiveProgram(id: string): Promise<void> {
  if (DEMO_MODE) {
    for (const p of MOCK_PROGRAMS) {
      p.is_active = p.id === id;
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Deactivate all programs for this user, then activate the selected one.
  // (Replaces the missing set_active_program RPC with direct SQL updates.)
  await supabase
    .from("programs")
    .update({ is_active: false })
    .eq("user_id", userId);

  await supabase
    .from("programs")
    .update({ is_active: true })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function getActiveProgram(): Promise<Program | null> {
  const programs = await getPrograms();
  return programs.find((p) => p.is_active) ?? null;
}

export async function deleteProgram(id: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = MOCK_PROGRAMS.findIndex((p) => p.id === id);
    if (idx >= 0) MOCK_PROGRAMS.splice(idx, 1);
    for (let i = MOCK_PROGRAM_DAYS.length - 1; i >= 0; i--) {
      if (MOCK_PROGRAM_DAYS[i].program_id === id) {
        const dayId = MOCK_PROGRAM_DAYS[i].id;
        MOCK_PROGRAM_DAYS.splice(i, 1);
        for (let j = MOCK_PROGRAM_EXERCISES.length - 1; j >= 0; j--) {
          if (MOCK_PROGRAM_EXERCISES[j].workout_day_id === dayId) {
            MOCK_PROGRAM_EXERCISES.splice(j, 1);
          }
        }
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  await supabase.from("programs").delete().eq("id", id).eq("user_id", userId);
}

// ────────────────────────────────────────────
// PROGRAM DAYS
// ────────────────────────────────────────────

export async function getProgramDays(programId: string): Promise<ProgramDay[]> {
  if (DEMO_MODE) {
    return getDemoProgramDays(programId);
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("workout_days")
    .select("*")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .order("day_order");

  return (data ?? []) as ProgramDay[];
}

export async function createProgramDay(
  programId: string,
  name: string,
  dayOrder: number,
  weekdayLabel?: string,
  sessionLabel?: string
): Promise<ProgramDay> {
  const kind: ProgramDay["kind"] = sessionLabel ? "session" : "weekday";
  const normalizedDayOfWeek = ((dayOrder % 7) + 7) % 7;
  const normalizedDayLabel = dayLabelFromIndex(normalizedDayOfWeek);

  if (DEMO_MODE) {
    const day: ProgramDay = {
      id: `day-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      program_id: programId,
      user_id: "demo-user",
      name,
      day_order: dayOrder,
      kind,
      day_of_week: normalizedDayOfWeek,
      day_label: normalizedDayLabel,
      weekday_label: weekdayLabel,
      session_label: sessionLabel,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAM_DAYS.push(day);
    return day;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_days")
    .insert({
      program_id: programId,
      user_id: userId,
      name,
      day_order: dayOrder,
      kind,
      weekday_label: weekdayLabel,
      session_label: sessionLabel,
      day_of_week: normalizedDayOfWeek,
      day_label: normalizedDayLabel,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create day: ${error.message}`);
  return data as ProgramDay;
}

export async function updateProgramDay(
  dayId: string,
  updates: Partial<ProgramDay>
): Promise<ProgramDay> {
  if (DEMO_MODE) {
    const day = MOCK_PROGRAM_DAYS.find((d) => d.id === dayId);
    if (!day) throw new Error("Day not found");
    Object.assign(day, updates);
    return day;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("workout_days")
    .update(updates)
    .eq("id", dayId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update day: ${error.message}`);
  return data as ProgramDay;
}

export async function deleteProgramDay(dayId: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = MOCK_PROGRAM_DAYS.findIndex((d) => d.id === dayId);
    if (idx >= 0) MOCK_PROGRAM_DAYS.splice(idx, 1);
    for (let i = MOCK_PROGRAM_EXERCISES.length - 1; i >= 0; i--) {
      if (MOCK_PROGRAM_EXERCISES[i].workout_day_id === dayId) {
        MOCK_PROGRAM_EXERCISES.splice(i, 1);
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("workout_days")
    .delete()
    .eq("id", dayId)
    .eq("user_id", userId);
}

export async function reorderProgramDays(
  programId: string,
  dayOrders: Array<{ id: string; day_order: number }>
): Promise<void> {
  if (DEMO_MODE) {
    for (const { id, day_order } of dayOrders) {
      const day = MOCK_PROGRAM_DAYS.find((d) => d.id === id && d.program_id === programId);
      if (day) {
        day.day_order = day_order;
        day.day_of_week = ((day_order % 7) + 7) % 7;
        day.day_label = dayLabelFromIndex(day.day_of_week);
      }
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  for (const { id, day_order } of dayOrders) {
    await supabase
      .from("workout_days")
      .update({ day_order, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
  }
}

// ────────────────────────────────────────────
// PROGRAM EXERCISES
// ────────────────────────────────────────────

export async function getProgramExercises(dayId: string): Promise<ProgramExercise[]> {
  if (DEMO_MODE) {
    return MOCK_PROGRAM_EXERCISES
      .filter((ex) => ex.workout_day_id === dayId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data } = await supabase
    .from("program_exercises")
    .select("*")
    .eq("program_day_id", dayId)
    .eq("user_id", userId)
    .order("sort_order");

  return (data ?? []) as ProgramExercise[];
}

export async function createProgramExercise(
  dayId: string,
  programId: string,
  exerciseName: string,
  schemeText?: string,
  targetSets?: number,
  targetRepsText?: string,
  notes?: string
): Promise<ProgramExercise> {
  if (DEMO_MODE) {
    const existing = MOCK_PROGRAM_EXERCISES
      .filter((ex) => ex.workout_day_id === dayId)
      .sort((a, b) => b.sort_order - a.sort_order);
    const maxSort = (existing[0]?.sort_order ?? -1) + 1;
    const ex: ProgramExercise = {
      id: `ex-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      program_id: programId,
      workout_day_id: dayId,
      user_id: "demo-user",
      exercise_name_snapshot: exerciseName,
      scheme_text: schemeText,
      target_sets: targetSets,
      target_reps_text: targetRepsText,
      notes,
      sort_order: maxSort,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAM_EXERCISES.push(ex);
    return ex;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Get max sort_order for this day
  const { data: existing } = await supabase
    .from("program_exercises")
    .select("sort_order")
    .eq("program_day_id", dayId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxSort = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("program_exercises")
    .insert({
      program_id: programId,
      program_day_id: dayId,
      user_id: userId,
      exercise_name_snapshot: exerciseName,
      scheme_text: schemeText,
      target_sets: targetSets,
      target_reps_text: targetRepsText,
      notes,
      sort_order: maxSort,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create exercise: ${error.message}`);
  return data as ProgramExercise;
}

export async function updateProgramExercise(
  exerciseId: string,
  updates: Partial<ProgramExercise>
): Promise<ProgramExercise> {
  if (DEMO_MODE) {
    const ex = MOCK_PROGRAM_EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) throw new Error("Exercise not found");
    Object.assign(ex, updates);
    return ex;
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("program_exercises")
    .update(updates)
    .eq("id", exerciseId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update exercise: ${error.message}`);
  return data as ProgramExercise;
}

export async function deleteProgramExercise(exerciseId: string): Promise<void> {
  if (DEMO_MODE) {
    const idx = MOCK_PROGRAM_EXERCISES.findIndex((e) => e.id === exerciseId);
    if (idx >= 0) MOCK_PROGRAM_EXERCISES.splice(idx, 1);
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  await supabase
    .from("program_exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("user_id", userId);
}

export async function reorderProgramExercises(
  dayId: string,
  exerciseOrders: Array<{ id: string; sort_order: number }>
): Promise<void> {
  if (DEMO_MODE) {
    for (const { id, sort_order } of exerciseOrders) {
      const ex = MOCK_PROGRAM_EXERCISES.find(
        (e) => e.id === id && e.workout_day_id === dayId
      );
      if (ex) ex.sort_order = sort_order;
    }
    return;
  }

  const supabase = await db();
  const userId = await getUserId();

  for (const { id, sort_order } of exerciseOrders) {
    await supabase
      .from("program_exercises")
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
  }
}

// ────────────────────────────────────────────
// DUPLICATE PROGRAM
// ────────────────────────────────────────────

export async function duplicateProgram(
  sourceId: string,
  newName: string
): Promise<Program> {
  if (DEMO_MODE) {
    const source = MOCK_PROGRAMS.find((p) => p.id === sourceId);
    if (!source) throw new Error("Program not found");
    const dup: Program = {
      ...source,
      id: `prog-${Date.now()}`,
      name: newName,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAMS.push(dup);

    const sourceDays = getDemoProgramDays(sourceId);
    for (const sourceDay of sourceDays) {
      const newDay: ProgramDay = {
        ...sourceDay,
        id: `day-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        program_id: dup.id,
        created_at: new Date().toISOString(),
      };
      MOCK_PROGRAM_DAYS.push(newDay);

      const sourceExercises = MOCK_PROGRAM_EXERCISES.filter(
        (e) => e.workout_day_id === sourceDay.id
      );
      for (const sourceEx of sourceExercises) {
        MOCK_PROGRAM_EXERCISES.push({
          ...sourceEx,
          id: `ex-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          program_id: dup.id,
          workout_day_id: newDay.id,
          created_at: new Date().toISOString(),
        });
      }
    }

    return dup;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Get source program
  const { data: source, error: sourceError } = await supabase
    .from("programs")
    .select("*")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .single();

  if (sourceError || !source)
    throw new Error("Source program not found");

  // Create new program
  const { data: newProg, error: createError } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name: newName,
      description: source.description,
      mode: source.mode,
      is_active: false,
    })
    .select()
    .single();

  if (createError || !newProg) throw new Error("Failed to create duplicate");

  // Get source days
  const { data: sourceDays } = await supabase
    .from("workout_days")
    .select("*")
    .eq("program_id", sourceId)
    .eq("user_id", userId)
    .order("day_order");

  // Duplicate days and exercises
  if (sourceDays && sourceDays.length > 0) {
    for (const sourceDay of sourceDays) {
      // Create new day
      const { data: newDay, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          program_id: newProg.id,
          user_id: userId,
          name: sourceDay.name,
          day_order: sourceDay.day_order,
          kind: sourceDay.kind,
          day_of_week: sourceDay.day_of_week,
          day_label: sourceDay.day_label,
          weekday_label: sourceDay.weekday_label,
          session_label: sourceDay.session_label,
        })
        .select()
        .single();

      if (dayError || !newDay) continue;

      // Get source exercises for this day
      const { data: sourceExercises } = await supabase
        .from("program_exercises")
        .select("*")
        .eq("program_day_id", sourceDay.id)
        .order("sort_order");

      // Duplicate exercises
      if (sourceExercises && sourceExercises.length > 0) {
        for (const sourceEx of sourceExercises) {
          await supabase.from("program_exercises").insert({
            program_id: newProg.id,
            program_day_id: newDay.id,
            user_id: userId,
            exercise_id: sourceEx.exercise_id,
            exercise_name_snapshot: sourceEx.exercise_name_snapshot,
            scheme_text: sourceEx.scheme_text,
            target_sets: sourceEx.target_sets,
            target_reps_text: sourceEx.target_reps_text,
            notes: sourceEx.notes,
            sort_order: sourceEx.sort_order,
          });
        }
      }
    }
  }

  return newProg as Program;
}

// ────────────────────────────────────────────
// SAVE IMPORTED PROGRAM
// ────────────────────────────────────────────

export async function saveImportedProgram(
  name: string,
  description: string | null,
  mode: ProgramMode,
  days: Array<{
    name: string;
    label?: string;
    exercises: Array<{
      name: string;
      schemeText?: string;
      targetSets?: number;
      targetRepsText?: string;
      notes?: string;
    }>;
  }>
): Promise<Program> {
  if (DEMO_MODE) {
    const prog: Program = {
      id: `prog-${Date.now()}`,
      user_id: "demo-user",
      name,
      description: description || undefined,
      mode,
      is_active: false,
      created_at: new Date().toISOString(),
    };
    MOCK_PROGRAMS.push(prog);

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const sourceDay = days[dayIdx];
      const createdDay = await createProgramDay(
        prog.id,
        sourceDay.name,
        dayIdx,
        mode === "weekday" ? sourceDay.label : undefined,
        mode === "session" ? sourceDay.label ?? `Workout ${dayIdx + 1}` : undefined
      );

      for (let exIdx = 0; exIdx < sourceDay.exercises.length; exIdx++) {
        const ex = sourceDay.exercises[exIdx];
        await createProgramExercise(
          createdDay.id,
          prog.id,
          ex.name,
          ex.schemeText,
          ex.targetSets,
          ex.targetRepsText,
          ex.notes
        );
      }
    }

    return prog;
  }

  const supabase = await db();
  const userId = await getUserId();

  // Create program
  const { data: newProg, error: progError } = await supabase
    .from("programs")
    .insert({
      user_id: userId,
      name,
      description,
      mode,
      is_active: false,
    })
    .select()
    .single();

  if (progError || !newProg) throw new Error("Failed to create program");

  // Create days and exercises
  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const sourceDay = days[dayIdx];
    const normalizedDayOfWeek = ((dayIdx % 7) + 7) % 7;
    const normalizedDayLabel = dayLabelFromIndex(normalizedDayOfWeek);

    const { data: newDay, error: dayError } = await supabase
      .from("workout_days")
      .insert({
        program_id: newProg.id,
        user_id: userId,
        name: sourceDay.name,
        day_order: dayIdx,
        kind: mode,
        day_of_week: normalizedDayOfWeek,
        day_label: normalizedDayLabel,
        weekday_label: sourceDay.label,
        session_label: sourceDay.label,
      })
      .select()
      .single();

    if (dayError || !newDay) continue;

    // Create exercises for this day
    for (let exIdx = 0; exIdx < sourceDay.exercises.length; exIdx++) {
      const ex = sourceDay.exercises[exIdx];

      await supabase.from("program_exercises").insert({
        program_id: newProg.id,
        program_day_id: newDay.id,
        user_id: userId,
        exercise_name_snapshot: ex.name,
        scheme_text: ex.schemeText,
        target_sets: ex.targetSets,
        target_reps_text: ex.targetRepsText,
        notes: ex.notes,
        sort_order: exIdx,
      });
    }
  }

  return newProg as Program;
}

/**
 * Validate a program was materialized correctly.
 * If `expectedDays` is provided (parser output), validate counts and names against it.
 */
export async function validateProgram(
  programId: string,
  expectedDays?: Array<{
    name: string;
    label?: string;
    exercises: Array<{
      name: string;
      schemeText?: string;
      targetSets?: number;
      targetRepsText?: string;
      notes?: string;
    }>;
  }>
): Promise<{ valid: boolean; warnings: ValidationWarning[] }> {
  if (DEMO_MODE) {
    const warnings: ValidationWarning[] = [];
    const prog = MOCK_PROGRAMS.find((p) => p.id === programId);
    if (!prog) {
      warnings.push({ type: "missing_program", message: "Program not found (demo mode)" });
      return { valid: warnings.length === 0, warnings };
    }

    // In demo mode we can't validate days/exercises reliably; return success
    return { valid: true, warnings };
  }

  const supabase = await db();
  const userId = await getUserId();

  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("user_id", userId)
    .maybeSingle();

  const warnings: ValidationWarning[] = [];
  if (!program) {
    warnings.push({ type: "missing_program", message: "Program not found or not owned by user" });
    return { valid: false, warnings };
  }

  const { data: days } = await supabase
    .from("workout_days")
    .select("*")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .order("day_order");

  if (!days || days.length === 0) {
    warnings.push({ type: "missing_days", message: "Program has no days" });
    return { valid: false, warnings };
  }

  if (expectedDays && expectedDays.length !== days.length) {
    warnings.push({ type: "count_mismatch", message: `Expected ${expectedDays.length} days but found ${days.length}` });
  }

  // Check duplicate day names
  const seenDays = new Set<string>();
  for (const d of days) {
    const lower = (d.name || "").toLowerCase();
    if (seenDays.has(lower)) {
      warnings.push({ type: "duplicate_day", message: `Duplicate day name: ${d.name}`, dayName: d.name });
    }
    seenDays.add(lower);
  }

  // For each day, validate exercises
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const { data: exercises } = await supabase
      .from("program_exercises")
      .select("*")
      .eq("program_day_id", day.id)
      .eq("user_id", userId)
      .order("sort_order");

    const expectedDay = expectedDays ? expectedDays[i] : undefined;
    if ((!exercises || exercises.length === 0) && expectedDay && expectedDay.exercises.length > 0) {
      warnings.push({ type: "missing_exercises", message: `Day '${day.name}' has no exercises`, dayName: day.name });
      continue;
    }

    if (expectedDay && exercises && exercises.length !== expectedDay.exercises.length) {
      warnings.push({ type: "count_mismatch", message: `Day '${day.name}': expected ${expectedDay.exercises.length} exercises but found ${exercises.length}`, dayName: day.name });
    }

    // Check duplicate exercise names within day and some field validations
    const seenEx = new Set<string>();
    for (let j = 0; exercises && j < exercises.length; j++) {
      const ex = exercises[j] as ValidationExerciseRow;
      const lower = (ex.exercise_name_snapshot || "").toLowerCase();
      const exName = ex.exercise_name_snapshot ?? undefined;
      if (seenEx.has(lower)) {
        warnings.push({ type: "duplicate_exercise", message: `Duplicate exercise '${ex.exercise_name_snapshot}' in day '${day.name}'`, dayName: day.name, exerciseName: exName });
      }
      seenEx.add(lower);

      const expectedEx = expectedDay?.exercises?.[j];
      if (expectedEx && lower !== (expectedEx.name || "").toLowerCase()) {
        warnings.push({ type: "mismatch_exercise_name", message: `Exercise name mismatch in day '${day.name}': expected '${expectedEx.name}' but got '${ex.exercise_name_snapshot}'`, dayName: day.name, exerciseName: exName });
      }

      if ((expectedEx?.targetSets ?? null) !== null && (ex.target_sets === null || ex.target_sets === undefined)) {
        warnings.push({ type: "missing_target_sets", message: `Exercise '${ex.exercise_name_snapshot}' in day '${day.name}' missing target sets`, dayName: day.name, exerciseName: exName });
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}
