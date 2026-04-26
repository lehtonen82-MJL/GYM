-- ============================================================
-- Migration 014: Link unlinked user exercises to definitions
--
-- Run this query first to SEE which exercises are unlinked:
--
-- SELECT id, name, normalized_name
-- FROM exercises
-- WHERE exercise_definition_id IS NULL
-- ORDER BY name;
--
-- Then run the UPDATE below to auto-link by normalized_name match.
-- Any that still don't match need manual linking (see bottom).
-- ============================================================

-- Auto-link exercises where normalized_name matches a definition
UPDATE exercises e
SET exercise_definition_id = d.id
FROM exercise_definitions d
WHERE e.exercise_definition_id IS NULL
  AND e.normalized_name = d.normalized_name;

-- Check what's still unlinked after the auto-link:
-- SELECT id, name, normalized_name
-- FROM exercises
-- WHERE exercise_definition_id IS NULL
-- ORDER BY name;

-- For any remaining unlinked, manually link by name similarity, e.g.:
-- UPDATE exercises
-- SET exercise_definition_id = (SELECT id FROM exercise_definitions WHERE name = 'Bench Press')
-- WHERE name ILIKE '%bench%press%'
--   AND exercise_definition_id IS NULL;
