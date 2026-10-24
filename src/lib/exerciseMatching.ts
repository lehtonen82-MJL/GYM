// Matching user-typed exercise names to the exercise_definitions library (Phase E.5).
// Pure, so it is unit-tested against the real seed data (exerciseMatching.test.ts).
//
// Strict on purpose: only spelling-level differences are forgiven (case, punctuation,
// spacing, plurals, "dumbbell"/"db"-style prefixes, a trailing "(note)"). No similarity
// scoring — a wrong link silently corrupts equipment/muscle data, a missing link is visible
// in Settings → Exercise library.

export type LibraryDefinition = {
  id: string;
  name: string;
  normalized_name: string;
  aliases: string[] | null;
};

/**
 * Spelling-insensitive key: "Pull-ups" / "pull up" / "PULLUP" → "pullup".
 * Keep in sync with loose_key() in scripts/exercise_library_e.py (used to check the seed
 * data has no two definitions sharing a key).
 */
export function looseKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((w) => (w.length >= 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join("");
}

// Equipment prefixes people write interchangeably. The library mostly uses "DB …" and
// "Kettlebell …", and no prefix for barbell. Equipment is never dropped except for barbell,
// so "Dumbbell Bench Press" can't link to the barbell definition.
const PREFIX_VARIANTS: Record<string, string[][]> = {
  dumbbell: [["db"]],
  dumbbells: [["db"]],
  db: [["dumbbell"]],
  kb: [["kettlebell"]],
  kettlebell: [["kb"]],
  bb: [["barbell"], []],
  barbell: [[]],
};

/** Loose keys to try for a typed name, most specific first. */
export function nameCandidates(name: string): string[] {
  const raw = [name];
  const withoutNote = name.replace(/\([^)]*\)/g, " ").trim();
  if (withoutNote && withoutNote !== name.trim()) raw.push(withoutNote);

  const keys: string[] = [];
  for (const r of raw) {
    keys.push(looseKey(r));
    const words = r.toLowerCase().trim().split(/\s+/);
    for (const replacement of PREFIX_VARIANTS[words[0]] ?? []) {
      const rest = words.slice(1);
      if (rest.length > 0) keys.push(looseKey([...replacement, ...rest].join(" ")));
    }
  }
  return [...new Set(keys.filter(Boolean))];
}

export type LibraryIndex<T extends LibraryDefinition> = Map<string, T[]>;

/** Index every definition under the loose keys of its name, normalized name and aliases. */
export function buildLibraryIndex<T extends LibraryDefinition>(definitions: T[]): LibraryIndex<T> {
  const index: LibraryIndex<T> = new Map();
  for (const def of definitions) {
    const keys = new Set([def.name, def.normalized_name, ...(def.aliases ?? [])].map(looseKey));
    for (const key of keys) {
      const list = index.get(key) ?? [];
      if (!list.some((d) => d.id === def.id)) list.push(def);
      index.set(key, list);
    }
  }
  return index;
}

/**
 * The definition a typed name refers to, or null when there is none — or more than one
 * (ambiguous names are left unlinked rather than guessed).
 */
export function findDefinitionMatch<T extends LibraryDefinition>(name: string, index: LibraryIndex<T>): T | null {
  for (const key of nameCandidates(name)) {
    const hits = index.get(key);
    if (!hits) continue;
    return hits.length === 1 ? hits[0] : null;
  }
  return null;
}
