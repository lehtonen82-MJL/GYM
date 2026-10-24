-- ============================================================
-- Migration 014: Link unlinked user exercises to definitions
--
-- Matches each unlinked exercise by normalized_name (exact) or
-- aliases, and copies category / is_bodyweight / is_main_lift
-- from the definition. Custom exercises stay unlinked.
-- Re-runnable: only touches exercises with no definition yet.
--
-- To see what is still unlinked afterwards:
--   SELECT id, name, normalized_name FROM exercises
--   WHERE exercise_definition_id IS NULL ORDER BY name;
-- ============================================================

DO $$
DECLARE
  r       RECORD;
  v_def   RECORD;
BEGIN
  FOR r IN
    SELECT id, name, normalized_name
    FROM exercises
    WHERE exercise_definition_id IS NULL
  LOOP
    -- Exact normalized_name match
    SELECT id, is_bodyweight, is_main_lift, equipment_type
    INTO v_def
    FROM exercise_definitions
    WHERE normalized_name = COALESCE(r.normalized_name, lower(trim(r.name)))
    LIMIT 1;

    -- Alias fallback
    IF v_def.id IS NULL THEN
      SELECT id, is_bodyweight, is_main_lift, equipment_type
      INTO v_def
      FROM exercise_definitions
      WHERE aliases @> ARRAY[COALESCE(r.normalized_name, lower(trim(r.name)))]
      LIMIT 1;
    END IF;

    IF v_def.id IS NOT NULL THEN
      UPDATE exercises SET
        exercise_definition_id = v_def.id,
        is_bodyweight          = v_def.is_bodyweight,
        is_main_lift           = v_def.is_main_lift,
        category               = v_def.equipment_type
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
