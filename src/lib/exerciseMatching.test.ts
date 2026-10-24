import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildLibraryIndex,
  findDefinitionMatch,
  looseKey,
  nameCandidates,
  type LibraryDefinition,
} from "./exerciseMatching";

// Build the library the way the migrations leave it: seed rows from 012 + 020,
// then 020's alias additions/removals.
function loadLibrary(): LibraryDefinition[] {
  const dir = join(__dirname, "../../supabase/migrations");
  const sql =
    readFileSync(join(dir, "012_seed_exercise_definitions.sql"), "utf8") +
    readFileSync(join(dir, "020_expand_exercise_library.sql"), "utf8");
  const strings = (s: string) => [...s.matchAll(/'((?:[^']|'')+)'/g)].map((m) => m[1].replace(/''/g, "'"));

  const defs = new Map<string, LibraryDefinition>();
  for (const m of sql.matchAll(/^\('((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*ARRAY\[([^\]]*)\]/gm)) {
    const normalized = m[2].replace(/''/g, "'");
    defs.set(normalized, { id: normalized, name: m[1].replace(/''/g, "'"), normalized_name: normalized, aliases: strings(m[3]) });
  }
  for (const m of sql.matchAll(/a <> ALL \(ARRAY\[([^\]]*)\]::text\[\]\)[^;]*WHERE normalized_name = '([^']+)'/g)) {
    const def = defs.get(m[2])!;
    def.aliases = def.aliases!.filter((a) => !strings(m[1]).includes(a));
  }
  for (const m of sql.matchAll(/unnest\(aliases \|\| ARRAY\[([^\]]*)\]::text\[\]\)[^;]*WHERE normalized_name = '([^']+)'/g)) {
    const def = defs.get(m[2])!;
    def.aliases = [...new Set([...def.aliases!, ...strings(m[1])])];
  }
  return [...defs.values()];
}

const library = loadLibrary();
const index = buildLibraryIndex(library);
const match = (name: string) => findDefinitionMatch(name, index)?.name ?? null;

describe("library seed data", () => {
  it("has the expected size", () => {
    expect(library).toHaveLength(283);
  });

  it("has no loose key shared by two definitions", () => {
    const shared = [...index.entries()].filter(([, defs]) => defs.length > 1).map(([k, defs]) => `${k}: ${defs.map((d) => d.name)}`);
    expect(shared).toEqual([]);
  });
});

describe("looseKey", () => {
  it("ignores case, punctuation, spacing and plurals", () => {
    expect(looseKey("Pull-up")).toBe("pullup");
    expect(looseKey("pull ups")).toBe("pullup");
    expect(looseKey("PULLUPS")).toBe("pullup");
    expect(looseKey("Farmer’s Walk")).toBe(looseKey("farmers walk"));
    expect(looseKey("Clean & Jerk")).toBe(looseKey("clean and jerk"));
  });

  it("keeps words ending in ss", () => {
    expect(looseKey("Bench Press")).toBe("benchpress");
  });
});

describe("nameCandidates", () => {
  it("tries equipment synonyms without dropping the tool", () => {
    expect(nameCandidates("Dumbbell Bench Press")).toEqual(["dumbbellbenchpress", "dbbenchpress"]);
    expect(nameCandidates("BB Bench Press")).toEqual(["bbbenchpress", "barbellbenchpress", "benchpress"]);
  });

  it("also tries the name without a trailing note", () => {
    expect(nameCandidates("Squat (paused)")).toContain("squat");
  });
});

describe("findDefinitionMatch on the real library", () => {
  it.each([
    ["Incline Bench", "Incline Bench Press"],
    ["OHP", "Overhead Press"],
    ["military press", "Overhead Press"],
    ["RDL", "Romanian Deadlift"],
    ["BSS", "Bulgarian Split Squat"],
    ["CGBP", "Close Grip Bench Press"],
    ["Skullcrushers", "Skull Crusher"],
    ["pull ups", "Pull-up"],
    ["Pullups", "Pull-up"],
    ["chin ups", "Chin-up"],
    ["pulldown", "Lat Pulldown"],
    ["Hack Squat", "Hack Squat"],
    ["hex bar deadlift", "Trap Bar Deadlift"],
    ["Farmers Walk", "Farmer's Walk"],
    ["Hanging Leg Raises", "Hanging Leg Raise"],
    ["Upright Row", "Upright Row"],
    ["Dumbbell Bench Press", "DB Bench Press"],
    ["Dumbbell Shrugs", "DB Shrug"],
    ["KB Swing", "Kettlebell Swing"],
    ["bb curl", "Barbell Curl"],
    ["Triceps Pushdown (Rope)", "Triceps Pushdown (rope)"],
    ["Back Squat (paused)", "Back Squat"],
    ["Toes to bar", "Toes-to-Bar"],
    ["donkey calf raise", "Donkey Calf Raise"],
  ])("%s → %s", (typed, expected) => {
    expect(match(typed)).toBe(expected);
  });

  it.each(["Zumba", "My Custom Thing", "Leg Day Finisher", "Press", "Curl"])(
    "leaves unrelated or too-vague name %s unlinked",
    (typed) => {
      expect(match(typed)).toBeNull();
    }
  );

  it("does not link a dumbbell name to the barbell definition", () => {
    expect(match("Dumbbell Upright Row")).toBe("DB Upright Row");
    expect(match("Dumbbell Pendlay Row")).toBeNull();
  });

  it("returns null when a key is ambiguous", () => {
    const ambiguous = buildLibraryIndex([
      { id: "a", name: "Row A", normalized_name: "row a", aliases: ["row"] },
      { id: "b", name: "Row B", normalized_name: "row b", aliases: ["rows"] },
    ]);
    expect(findDefinitionMatch("row", ambiguous)).toBeNull();
  });
});
