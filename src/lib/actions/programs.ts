"use server";

import type { Program, ProgramDay, ProgramExercise, ProgramMode } from "@/lib/types";
import { db, getUserId } from "./_shared";

function dayLabelFromIndex(index: number): string {
  return ["SU", "MO", "TI", "WO", "TO", "FR", "LA"][((index % 7) + 7) % 7];
}

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
  const supabase = await db();
  const userId = await getUserId();

  await supabase.from("programs").delete().eq("id", id).eq("user_id", userId);
}

// ────────────────────────────────────────────
// PROGRAM DAYS
// ────────────────────────────────────────────

export async function getProgramDays(programId: string): Promise<ProgramDay[]> {
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
      supersetGroup?: string;
    }>;
  }>
): Promise<Program> {
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

  // All days in one insert, then all exercises in one insert (was one round trip per row: ~8 s for
  // a 3-day, 17-exercise program). Days are matched back by day_order, not by returned row order.
  const { data: newDays, error: dayError } = await supabase
    .from("workout_days")
    .insert(
      days.map((sourceDay, dayIdx) => {
        const normalizedDayOfWeek = ((dayIdx % 7) + 7) % 7;
        return {
          program_id: newProg.id,
          user_id: userId,
          name: sourceDay.name,
          day_order: dayIdx,
          kind: mode,
          day_of_week: normalizedDayOfWeek,
          day_label: dayLabelFromIndex(normalizedDayOfWeek),
          weekday_label: sourceDay.label,
          session_label: sourceDay.label,
        };
      })
    )
    .select("id, day_order");
  if (dayError || !newDays) throw new Error(`Failed to create program days: ${dayError?.message ?? "no data"}`);

  const dayIdByOrder = new Map(newDays.map((d) => [d.day_order as number, d.id as string]));
  const exerciseRows = days.flatMap((sourceDay, dayIdx) =>
    sourceDay.exercises.map((ex, exIdx) => ({
      program_id: newProg.id,
      program_day_id: dayIdByOrder.get(dayIdx),
      user_id: userId,
      exercise_name_snapshot: ex.name,
      scheme_text: ex.schemeText,
      target_sets: ex.targetSets,
      target_reps_text: ex.targetRepsText,
      notes: ex.notes,
      sort_order: exIdx,
      ...(ex.supersetGroup ? { superset_group: ex.supersetGroup } : {}),
    }))
  );
  if (exerciseRows.length > 0) {
    const { error: exError } = await supabase.from("program_exercises").insert(exerciseRows);
    if (exError) throw new Error(`Failed to create program exercises: ${exError.message}`);
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
