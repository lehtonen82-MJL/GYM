#!/usr/bin/env python3
"""Phase E: exercise library expansion — data + generator.

Single source for:
  - supabase/migrations/020_expand_exercise_library.sql
  - docs/exercise_gap_list.md

Validates every row against the CHECK constraints of migration 010b and that no
name/alias collides with another definition under the app's loose matching key
(src/lib/exerciseMatching.ts → looseKey; keep the two in sync).

    python3 scripts/exercise_library_e.py
"""
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EQUIPMENT = {"barbell", "dumbbell", "cable", "machine_plate", "machine_stack", "smith", "bodyweight",
             "kettlebell", "trap_bar", "band", "suspension", "cardio_machine", "other"}
MUSCLES = {"chest", "back_lats", "back_upper", "shoulders", "biceps", "triceps", "forearms", "core",
           "glutes", "quads", "hamstrings", "calves"}
PATTERNS = {"horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "squat", "hinge",
            "lunge", "carry", "olympic", "isolation", "core", "cardio"}


def ex(name, aliases, eq, primary, secondary, pattern, *, bw=None, cardio=False, bilateral=True, main=False):
    return dict(name=name, aliases=aliases, eq=eq, primary=primary, secondary=secondary, pattern=pattern,
                bw=(eq in ("bodyweight", "suspension")) if bw is None else bw,
                cardio=cardio, bilateral=bilateral, main=main)


# ── New definitions, grouped for review ─────────────────────────────────────
GROUPS = {
    "Chest": [
        ex("Floor Press", ["barbell floor press"], "barbell", "chest", ["triceps"], "horizontal_push"),
        ex("DB Floor Press", ["dumbbell floor press"], "dumbbell", "chest", ["triceps"], "horizontal_push"),
        ex("Smith Bench Press", ["smith machine bench press"], "smith", "chest", ["triceps", "shoulders"], "horizontal_push"),
        ex("Smith Incline Bench Press", ["smith machine incline press", "smith incline press"], "smith", "chest", ["triceps", "shoulders"], "horizontal_push"),
        ex("Machine Incline Press", ["incline chest press machine", "incline machine press"], "machine_stack", "chest", ["shoulders", "triceps"], "horizontal_push"),
        ex("Plate-Loaded Chest Press", ["hammer strength chest press", "plate loaded chest press"], "machine_plate", "chest", ["triceps", "shoulders"], "horizontal_push"),
        ex("DB Squeeze Press", ["dumbbell squeeze press", "crush press"], "dumbbell", "chest", ["triceps"], "horizontal_push"),
        ex("Svend Press", ["plate squeeze press"], "other", "chest", ["shoulders"], "isolation"),
        ex("Low-to-High Cable Fly", ["low cable fly", "low to high fly"], "cable", "chest", ["shoulders"], "isolation"),
        ex("High-to-Low Cable Fly", ["high cable fly", "high to low fly"], "cable", "chest", [], "isolation"),
        ex("Incline Cable Fly", ["incline cable flye"], "cable", "chest", ["shoulders"], "isolation"),
        ex("Deficit Push-up", ["deficit pushup"], "bodyweight", "chest", ["triceps", "shoulders"], "horizontal_push"),
        ex("Archer Push-up", ["archer pushup"], "bodyweight", "chest", ["triceps"], "horizontal_push", bilateral=False),
        ex("Ring Push-up", ["ring pushup"], "suspension", "chest", ["triceps", "core"], "horizontal_push"),
        ex("Ring Dip", ["ring dips"], "suspension", "chest", ["triceps", "shoulders"], "vertical_push"),
    ],
    "Back": [
        ex("Trap Bar Deadlift", ["hex bar deadlift", "trap-bar deadlift", "hex bar dl", "trap bar dl"], "trap_bar", "glutes", ["quads", "hamstrings", "back_upper"], "hinge", main=True),
        ex("Snatch-Grip Deadlift", ["snatch grip deadlift"], "barbell", "back_upper", ["hamstrings", "glutes"], "hinge"),
        ex("Deficit Deadlift", [], "barbell", "back_upper", ["hamstrings", "glutes"], "hinge"),
        ex("Stiff-Leg Deadlift", ["sldl", "stiff legged deadlift"], "barbell", "hamstrings", ["glutes", "back_upper"], "hinge"),
        ex("Single-Leg Romanian Deadlift", ["single leg rdl", "sl rdl", "single leg romanian deadlift"], "dumbbell", "hamstrings", ["glutes", "core"], "hinge", bilateral=False),
        ex("Cable Pull-through", ["pull through", "cable pull through"], "cable", "glutes", ["hamstrings"], "hinge"),
        ex("Back Extension", ["hyperextension", "45 degree back extension", "roman chair back extension"], "bodyweight", "glutes", ["hamstrings", "back_upper"], "hinge"),
        ex("Reverse Hyperextension", ["reverse hyper"], "machine_plate", "glutes", ["hamstrings"], "hinge"),
        ex("Seal Row", ["barbell seal row"], "barbell", "back_upper", ["back_lats", "biceps"], "horizontal_pull"),
        ex("Chest-Supported DB Row", ["chest supported dumbbell row", "incline db row", "incline dumbbell row"], "dumbbell", "back_upper", ["back_lats", "biceps"], "horizontal_pull"),
        ex("Meadows Row", [], "barbell", "back_lats", ["back_upper", "biceps"], "horizontal_pull", bilateral=False),
        ex("Kroc Row", [], "dumbbell", "back_lats", ["back_upper", "biceps", "forearms"], "horizontal_pull", bilateral=False),
        ex("Yates Row", ["underhand barbell row"], "barbell", "back_upper", ["back_lats", "biceps"], "horizontal_pull"),
        ex("Single-Arm Cable Row", ["single arm cable row", "one arm cable row"], "cable", "back_lats", ["biceps"], "horizontal_pull", bilateral=False),
        ex("Machine High Row", ["high row", "plate loaded high row"], "machine_plate", "back_upper", ["back_lats", "biceps"], "horizontal_pull"),
        ex("TRX Row", ["suspension row", "ring row"], "suspension", "back_upper", ["back_lats", "biceps"], "horizontal_pull"),
        ex("Straight-Arm Pulldown", ["straight arm pulldown", "lat prayer", "straight arm cable pulldown"], "cable", "back_lats", [], "isolation"),
        ex("Close Grip Lat Pulldown", ["v bar pulldown", "close grip pulldown", "neutral grip pulldown"], "cable", "back_lats", ["biceps"], "vertical_pull"),
        ex("Single-Arm Lat Pulldown", ["single arm pulldown", "one arm lat pulldown"], "cable", "back_lats", ["biceps"], "vertical_pull", bilateral=False),
        ex("Neutral Grip Pull-up", ["hammer grip pull-up", "neutral grip pullup"], "bodyweight", "back_lats", ["biceps"], "vertical_pull"),
        ex("Weighted Pull-up", ["weighted pullup"], "bodyweight", "back_lats", ["biceps"], "vertical_pull", main=True),
        ex("Weighted Chin-up", ["weighted chinup"], "bodyweight", "back_lats", ["biceps"], "vertical_pull"),
        ex("Assisted Pull-up", ["assisted pull-up machine", "assisted pullup"], "machine_stack", "back_lats", ["biceps"], "vertical_pull", bw=True),
        ex("Muscle-up", ["bar muscle-up"], "bodyweight", "back_lats", ["chest", "triceps"], "vertical_pull"),
        ex("Ring Muscle-up", [], "suspension", "back_lats", ["chest", "triceps"], "vertical_pull"),
        ex("DB Shrug", ["dumbbell shrug"], "dumbbell", "back_upper", ["forearms"], "isolation"),
        ex("Trap Bar Shrug", ["hex bar shrug"], "trap_bar", "back_upper", ["forearms"], "isolation"),
    ],
    "Shoulders": [
        ex("Z Press", ["z-press"], "barbell", "shoulders", ["triceps", "core"], "vertical_push"),
        ex("Seated Overhead Press", ["seated barbell press", "seated ohp", "seated military press"], "barbell", "shoulders", ["triceps"], "vertical_push"),
        ex("Behind-the-Neck Press", ["behind the neck press", "btn press"], "barbell", "shoulders", ["triceps"], "vertical_push"),
        ex("Smith Shoulder Press", ["smith machine shoulder press", "smith overhead press"], "smith", "shoulders", ["triceps"], "vertical_push"),
        ex("Landmine Press", ["single arm landmine press"], "barbell", "shoulders", ["chest", "triceps"], "vertical_push", bilateral=False),
        ex("Upright Row", ["barbell upright row"], "barbell", "shoulders", ["back_upper", "biceps"], "vertical_pull"),
        ex("DB Upright Row", ["dumbbell upright row"], "dumbbell", "shoulders", ["back_upper"], "vertical_pull"),
        ex("Cable Upright Row", [], "cable", "shoulders", ["back_upper"], "vertical_pull"),
        ex("Cable Front Raise", [], "cable", "shoulders", [], "isolation"),
        ex("Plate Front Raise", ["plate raise"], "other", "shoulders", [], "isolation"),
        ex("Machine Lateral Raise", ["lateral raise machine"], "machine_stack", "shoulders", [], "isolation"),
        ex("Y-Raise", ["y raise", "incline y raise"], "dumbbell", "shoulders", ["back_upper"], "isolation"),
        ex("Reverse Pec Deck", ["reverse fly machine", "rear delt machine", "reverse pec deck fly"], "machine_stack", "shoulders", ["back_upper"], "isolation"),
        ex("Band Pull-apart", ["band pull apart", "pull apart"], "band", "shoulders", ["back_upper"], "isolation"),
        ex("Pike Push-up", ["pike pushup"], "bodyweight", "shoulders", ["triceps"], "vertical_push"),
        ex("Handstand Push-up", ["hspu", "handstand pushup"], "bodyweight", "shoulders", ["triceps"], "vertical_push"),
    ],
    "Biceps": [
        ex("Spider Curl", ["db spider curl"], "dumbbell", "biceps", [], "isolation"),
        ex("Zottman Curl", [], "dumbbell", "biceps", ["forearms"], "isolation"),
        ex("Drag Curl", ["barbell drag curl"], "barbell", "biceps", [], "isolation"),
        ex("Bayesian Curl", ["behind the body cable curl", "bayesian cable curl"], "cable", "biceps", [], "isolation", bilateral=False),
        ex("Machine Curl", ["bicep curl machine", "biceps curl machine"], "machine_stack", "biceps", [], "isolation"),
        ex("Cable Hammer Curl", ["rope hammer curl"], "cable", "biceps", ["forearms"], "isolation"),
        ex("Cross-Body Hammer Curl", ["cross body hammer curl", "pinwheel curl"], "dumbbell", "biceps", ["forearms"], "isolation", bilateral=False),
        ex("21s", ["twenty ones", "21s curl"], "barbell", "biceps", [], "isolation"),
        ex("Band Curl", ["banded curl"], "band", "biceps", [], "isolation"),
    ],
    "Triceps": [
        ex("JM Press", [], "barbell", "triceps", ["chest"], "horizontal_push"),
        ex("Bench Dip", ["bench dips"], "bodyweight", "triceps", ["chest", "shoulders"], "vertical_push"),
        ex("Triceps Dip", ["tricep dip", "straight bar dip"], "bodyweight", "triceps", ["chest", "shoulders"], "vertical_push"),
        ex("Reverse Grip Pushdown", ["reverse pushdown", "underhand pushdown"], "cable", "triceps", [], "isolation"),
        ex("Single-Arm Cable Pushdown", ["single arm pushdown", "one arm pushdown"], "cable", "triceps", [], "isolation", bilateral=False),
        ex("Cable Triceps Kickback", ["cable tricep kickback"], "cable", "triceps", [], "isolation", bilateral=False),
        ex("DB Skull Crusher", ["dumbbell skull crusher", "db lying triceps extension"], "dumbbell", "triceps", [], "isolation"),
        ex("Tate Press", [], "dumbbell", "triceps", [], "isolation"),
        ex("Overhead EZ-bar Extension", ["french press", "ez bar overhead extension"], "barbell", "triceps", [], "isolation"),
        ex("Machine Triceps Extension", ["triceps extension machine", "tricep extension machine"], "machine_stack", "triceps", [], "isolation"),
    ],
    "Forearms & grip": [
        ex("Wrist Curl", ["db wrist curl", "dumbbell wrist curl"], "dumbbell", "forearms", [], "isolation"),
        ex("Reverse Wrist Curl", ["wrist extension", "db reverse wrist curl"], "dumbbell", "forearms", [], "isolation"),
        ex("Barbell Wrist Curl", ["bb wrist curl"], "barbell", "forearms", [], "isolation"),
        ex("Reverse Curl", ["reverse grip curl", "ez bar reverse curl"], "barbell", "forearms", ["biceps"], "isolation"),
        ex("Wrist Roller", [], "other", "forearms", [], "isolation"),
        ex("Plate Pinch", ["pinch grip hold"], "other", "forearms", [], "isolation"),
        ex("Dead Hang", ["bar hang", "passive hang"], "bodyweight", "forearms", ["back_lats"], "isolation"),
    ],
    "Carries": [
        ex("Farmer's Walk", ["farmers walk", "farmer walk", "farmer's carry", "farmers carry", "db farmers walk"], "dumbbell", "forearms", ["back_upper", "core"], "carry"),
        ex("Trap Bar Farmer's Walk", ["trap bar carry", "hex bar farmers walk"], "trap_bar", "forearms", ["back_upper", "core"], "carry"),
        ex("Suitcase Carry", ["single arm farmers walk"], "dumbbell", "core", ["forearms"], "carry", bilateral=False),
        ex("Overhead Carry", ["waiter walk", "overhead walk"], "dumbbell", "shoulders", ["core"], "carry"),
        ex("Yoke Carry", ["yoke walk", "yoke"], "other", "quads", ["back_upper", "core"], "carry"),
        ex("Sandbag Carry", ["sandbag bear hug carry"], "other", "core", ["back_upper"], "carry"),
        ex("Sled Push", ["prowler push", "prowler"], "other", "quads", ["glutes", "calves"], "carry"),
        ex("Sled Drag", ["backward sled drag", "sled pull"], "other", "quads", ["hamstrings", "glutes"], "carry"),
    ],
    "Legs": [
        ex("Hack Squat", ["hack squat machine"], "machine_plate", "quads", ["glutes"], "squat"),
        ex("Pendulum Squat", [], "machine_plate", "quads", ["glutes"], "squat"),
        ex("Belt Squat", ["belt squat machine"], "machine_plate", "quads", ["glutes"], "squat"),
        ex("Smith Squat", ["smith machine squat"], "smith", "quads", ["glutes"], "squat"),
        ex("Box Squat", [], "barbell", "quads", ["glutes", "hamstrings"], "squat"),
        ex("Pause Squat", ["paused squat"], "barbell", "quads", ["glutes"], "squat"),
        ex("Zercher Squat", [], "barbell", "quads", ["glutes", "core", "back_upper"], "squat"),
        ex("Safety Bar Squat", ["ssb squat", "safety squat bar squat"], "barbell", "quads", ["glutes", "back_upper"], "squat"),
        ex("Overhead Squat", ["ohs"], "barbell", "quads", ["shoulders", "core"], "squat"),
        ex("DB Goblet Squat", ["dumbbell goblet squat", "db goblet"], "dumbbell", "quads", ["glutes", "core"], "squat"),
        ex("Sissy Squat", [], "bodyweight", "quads", [], "squat"),
        ex("Pistol Squat", ["pistol", "single leg squat"], "bodyweight", "quads", ["glutes", "core"], "squat", bilateral=False),
        ex("Jump Squat", ["squat jump"], "bodyweight", "quads", ["glutes", "calves"], "squat"),
        ex("Box Jump", ["box jumps"], "bodyweight", "quads", ["glutes", "calves"], "squat"),
        ex("Broad Jump", ["standing broad jump"], "bodyweight", "quads", ["glutes", "hamstrings"], "squat"),
        ex("Single-Leg Leg Press", ["single leg press", "one leg press"], "machine_plate", "quads", ["glutes"], "squat", bilateral=False),
        ex("Split Squat", ["db split squat", "dumbbell split squat"], "dumbbell", "quads", ["glutes"], "lunge", bilateral=False),
        ex("Smith Split Squat", ["smith machine split squat"], "smith", "quads", ["glutes"], "lunge", bilateral=False),
        ex("Reverse Lunge", ["db reverse lunge", "dumbbell reverse lunge"], "dumbbell", "quads", ["glutes"], "lunge", bilateral=False),
        ex("DB Walking Lunge", ["dumbbell walking lunge"], "dumbbell", "quads", ["glutes"], "lunge", bilateral=False),
        ex("Curtsy Lunge", [], "dumbbell", "glutes", ["quads"], "lunge", bilateral=False),
        ex("Lateral Lunge", ["side lunge"], "dumbbell", "glutes", ["quads"], "lunge", bilateral=False),
        ex("Cable Glute Kickback", ["glute kickback", "cable kickback glute"], "cable", "glutes", ["hamstrings"], "isolation", bilateral=False),
        ex("Single-Leg Glute Bridge", ["single leg glute bridge", "single leg hip bridge"], "bodyweight", "glutes", ["hamstrings"], "hinge", bilateral=False),
        ex("Band Lateral Walk", ["monster walk", "lateral band walk", "banded side walk"], "band", "glutes", [], "isolation"),
        ex("Standing Leg Curl", ["single leg curl"], "machine_stack", "hamstrings", [], "isolation", bilateral=False),
        ex("Glute Ham Raise", ["ghr", "glute-ham raise"], "bodyweight", "hamstrings", ["glutes"], "hinge"),
        ex("Reverse Nordic", ["reverse nordic curl"], "bodyweight", "quads", [], "isolation"),
        ex("Single-Leg Calf Raise", ["single leg calf raise", "one leg calf raise"], "bodyweight", "calves", [], "isolation", bilateral=False),
        ex("Leg Press Calf Raise", ["calf press"], "machine_plate", "calves", [], "isolation"),
        ex("Donkey Calf Raise", ["donkey calf raises"], "machine_plate", "calves", [], "isolation"),
        ex("Smith Calf Raise", ["smith machine calf raise"], "smith", "calves", [], "isolation"),
        ex("Tibialis Raise", ["tib raise", "tibia raise"], "bodyweight", "calves", [], "isolation"),
    ],
    "Core": [
        ex("Hanging Leg Raise", ["hanging leg raises"], "bodyweight", "core", [], "core"),
        ex("Hanging Knee Raise", ["knee raise", "hanging knee tuck"], "bodyweight", "core", [], "core"),
        ex("Toes-to-Bar", ["t2b", "toes to bar"], "bodyweight", "core", ["back_lats"], "core"),
        ex("Captain's Chair Leg Raise", ["captains chair", "captain's chair"], "other", "core", [], "core", bw=True),
        ex("Pallof Press", ["anti rotation press"], "cable", "core", [], "core"),
        ex("Side Plank", [], "bodyweight", "core", [], "core", bilateral=False),
        ex("Copenhagen Plank", ["copenhagen", "adductor plank"], "bodyweight", "core", [], "core", bilateral=False),
        ex("Woodchopper", ["cable woodchop", "wood chop", "woodchop"], "cable", "core", ["shoulders"], "core"),
        ex("Landmine Rotation", ["landmine twist", "landmine 180"], "barbell", "core", ["shoulders"], "core"),
        ex("V-up", ["v up", "v-sit up"], "bodyweight", "core", [], "core"),
        ex("Reverse Crunch", [], "bodyweight", "core", [], "core"),
        ex("Decline Sit-up", ["decline situp"], "bodyweight", "core", [], "core"),
        ex("Machine Crunch", ["ab crunch machine", "crunch machine"], "machine_stack", "core", [], "core"),
        ex("Dead Bug", [], "bodyweight", "core", [], "core"),
        ex("Bird Dog", [], "bodyweight", "core", ["glutes"], "core"),
        ex("Mountain Climber", [], "bodyweight", "core", ["shoulders", "quads"], "core"),
        ex("Hanging Windshield Wiper", ["windshield wiper"], "bodyweight", "core", [], "core"),
        ex("L-sit", ["l sit", "l-sit hold"], "bodyweight", "core", ["triceps"], "core"),
        ex("Bear Crawl", [], "bodyweight", "core", ["shoulders", "quads"], "core"),
        ex("Med Ball Slam", ["ball slam", "slam ball", "medicine ball slam"], "other", "core", ["shoulders", "back_lats"], "core"),
    ],
    "Olympic": [
        ex("Clean", ["squat clean", "full clean"], "barbell", "quads", ["glutes", "back_upper", "hamstrings"], "olympic", main=True),
        ex("Hang Power Clean", ["hpc"], "barbell", "back_upper", ["quads", "glutes", "hamstrings"], "olympic"),
        ex("Hang Power Snatch", ["hps"], "barbell", "back_upper", ["quads", "glutes", "shoulders"], "olympic"),
        ex("Power Jerk", [], "barbell", "shoulders", ["quads", "triceps"], "olympic"),
        ex("Jerk Dip", ["jerk dip squat", "jerk drive"], "barbell", "quads", ["core"], "olympic"),
        ex("Snatch Balance", [], "barbell", "quads", ["shoulders", "core"], "olympic"),
        ex("Muscle Snatch", [], "barbell", "shoulders", ["back_upper"], "olympic"),
        ex("Snatch High Pull", ["snatch grip high pull"], "barbell", "back_upper", ["shoulders", "hamstrings"], "olympic"),
        ex("Clean High Pull", ["high pull"], "barbell", "back_upper", ["shoulders", "hamstrings"], "olympic"),
    ],
    "Kettlebell & conditioning": [
        ex("Thruster", ["barbell thruster"], "barbell", "quads", ["shoulders", "glutes", "triceps"], "squat"),
        ex("DB Thruster", ["dumbbell thruster"], "dumbbell", "quads", ["shoulders", "glutes"], "squat"),
        ex("Devil Press", ["devils press"], "dumbbell", "shoulders", ["glutes", "hamstrings", "chest"], "olympic"),
        ex("Wall Ball", ["wall ball shot", "wallball"], "other", "quads", ["shoulders", "glutes"], "squat"),
        ex("Burpee", [], "bodyweight", "quads", ["chest", "shoulders", "core"], "cardio", cardio=True),
        ex("Battle Ropes", ["battle rope", "rope waves"], "other", "shoulders", ["core"], "cardio", cardio=True),
    ],
}

# ── Aliases for existing (012) definitions: shorthands people actually type ──
ALIASES_FOR_EXISTING = {
    "bench press": ["bench", "bb bench", "bb bench press"],
    "incline bench press": ["incline bench", "incline press"],
    "close grip bench press": ["close grip bench", "close-grip bench"],
    "db bench press": ["db bench", "dumbbell bench"],
    "db incline bench press": ["incline db press", "db incline press", "incline db bench"],
    "overhead press": ["standing press", "bb ohp", "strict press"],
    "db shoulder press": ["seated db press", "seated dumbbell press", "seated db shoulder press"],
    "romanian deadlift": ["bb rdl"],
    "conventional deadlift": ["dl", "barbell deadlift"],
    "back squat": ["bb squat", "high bar squat", "low bar squat"],
    "front squat": ["bb front squat"],
    "bent-over row": ["bent over row", "barbell bent over row"],
    "lat pulldown": ["lat pull down"],
    "pull-up": ["pull ups"],
    "chin-up": ["chin ups"],
    "push-up": ["push ups"],
    "skull crusher": ["skullcrusher", "skull crushers"],
    "triceps pushdown (rope)": ["tricep rope pushdown", "rope triceps pushdown"],
    "db curl": ["bicep curl", "biceps curl", "db bicep curl"],
    "hammer curl": ["dumbbell hammer curl"],
    "lateral raise": ["side raise", "dumbbell lateral raise"],
    "face pull": ["rope face pull"],
    "calf raise": ["standing calf raises", "machine calf raise"],
    "leg extension": ["quad extension"],
    "lying leg curl": ["lying hamstring curl", "prone leg curl"],
    "leg press": ["leg press machine"],
    "crunch": ["crunches"],
    "russian twist": ["russian twists"],
    "cable crunch": ["kneeling cable crunch"],
    "power clean": ["pc"],
    "clean & jerk": ["c&j", "cj"],
    "kettlebell swing": ["russian swing", "russian kb swing"],
    "treadmill": ["run", "treadmill run"],
    # 012b (production-only kettlebell rows)
    "double kettlebell front squat": ["kettlebell front squat"],
}

# Aliases moved to a new, more accurate definition (removed from the old one first)
ALIASES_TO_REMOVE = {
    "leg raise": ["hanging leg raise"],          # → Hanging Leg Raise
    "seated calf raise": ["donkey calf raise"],  # donkey raises are standing/hinged → Donkey Calf Raise
}


def loose_key(name: str) -> str:
    """Mirror of looseKey() in src/lib/exerciseMatching.ts."""
    s = name.lower().replace("’", "").replace("'", "").replace("&", " and ")
    words = re.sub(r"[^a-z0-9]+", " ", s).split()
    words = [w[:-1] if len(w) >= 3 and w.endswith("s") and not w.endswith("ss") else w for w in words]
    return "".join(words)


def parse_existing():
    """Definitions seeded before 020: 012 + 012b (kettlebell rows captured from production)."""
    sql = "".join((ROOT / "supabase/migrations" / f).read_text()
                  for f in ("012_seed_exercise_definitions.sql", "012b_seed_kettlebell_definitions.sql"))
    rows = {}
    for m in re.finditer(r"^\('([^']+)',\s*'([^']+)',\s*ARRAY\[([^\]]*)\]", sql, re.M):
        rows[m.group(2)] = dict(name=m.group(1), aliases=re.findall(r"'([^']+)'", m.group(3)))
    return rows


def validate(existing, new_rows):
    errors = []
    for r in new_rows:
        if r["eq"] not in EQUIPMENT: errors.append(f"{r['name']}: equipment {r['eq']}")
        if r["primary"] not in MUSCLES: errors.append(f"{r['name']}: muscle {r['primary']}")
        for m in r["secondary"]:
            if m not in MUSCLES: errors.append(f"{r['name']}: secondary {m}")
        if r["pattern"] not in PATTERNS: errors.append(f"{r['name']}: pattern {r['pattern']}")
        if r["name"].lower() in existing: errors.append(f"{r['name']}: already exists")

    # Final alias sets after this migration
    final = {}
    for norm, row in existing.items():
        al = [a for a in row["aliases"] if a not in ALIASES_TO_REMOVE.get(norm, [])]
        final[norm] = (row["name"], al + ALIASES_FOR_EXISTING.get(norm, []))
    for norm in ALIASES_FOR_EXISTING:
        if norm not in existing: errors.append(f"alias target missing: {norm}")
    for r in new_rows:
        final[r["name"].lower()] = (r["name"], r["aliases"])

    owner = defaultdict(set)
    for norm, (name, aliases) in final.items():
        for label in [name, norm, *aliases]:
            owner[loose_key(label)].add(name)
    for key, names in owner.items():
        if len(names) > 1: errors.append(f"loose key '{key}' shared by {sorted(names)}")
    return errors, len(final)


def sql_text(v):
    return "'" + v.replace("'", "''") + "'"


def sql_array(values):
    return "ARRAY[" + ", ".join(sql_text(v) for v in values) + "]::text[]"


def build_sql(new_rows_by_group, total):
    out = [f"""-- ============================================================
-- Migration 020: Expand the exercise library (Phase E)
--
-- GENERATED by scripts/exercise_library_e.py — edit the data there, not here.
--
-- 1. {sum(len(v) for v in new_rows_by_group.values())} new definitions (total {total}), grouped by muscle/pattern.
-- 2. Shorthand aliases for existing definitions (bench, ohp, skullcrusher …).
-- 3. Two aliases moved to new, more accurate definitions.
-- 4. link_unlinked_exercises(): links user exercises by exact name/alias
--    (the app does looser matching in src/lib/exerciseMatching.ts —
--    Settings → Exercise library → Re-link).
--
-- Re-runnable: ON CONFLICT merges aliases; alias edits are set operations.
-- ============================================================

INSERT INTO exercise_definitions
  (name, normalized_name, aliases, equipment_type, primary_muscle, secondary_muscles, movement_pattern, is_bodyweight, is_cardio, is_bilateral, is_main_lift)
VALUES"""]
    values = []
    for group, rows in new_rows_by_group.items():
        values.append(f"\n-- ── {group.upper()} " + "─" * max(4, 60 - len(group)))
        for r in rows:
            b = lambda x: "true" if x else "false"
            values.append(
                f"({sql_text(r['name'])}, {sql_text(r['name'].lower())}, {sql_array(r['aliases'])}, "
                f"{sql_text(r['eq'])}, {sql_text(r['primary'])}, {sql_array(r['secondary'])}, {sql_text(r['pattern'])}, "
                f"{b(r['bw'])}, {b(r['cardio'])}, {b(r['bilateral'])}, {b(r['main'])}),")
    values[-1] = values[-1].rstrip(",")
    out.append("\n".join(values))
    out.append("""
ON CONFLICT (normalized_name) DO UPDATE SET
  aliases = ARRAY(SELECT DISTINCT unnest(exercise_definitions.aliases || EXCLUDED.aliases) ORDER BY 1);

-- ── Aliases moved to the new definitions above ──────────────────────""")
    for norm, aliases in ALIASES_TO_REMOVE.items():
        out.append(f"""UPDATE exercise_definitions
SET aliases = ARRAY(SELECT a FROM unnest(aliases) a WHERE a <> ALL ({sql_array(aliases)}) ORDER BY 1)
WHERE normalized_name = {sql_text(norm)};""")
    out.append("\n-- ── Shorthand aliases for existing definitions ──────────────────────")
    for norm, aliases in ALIASES_FOR_EXISTING.items():
        out.append(f"""UPDATE exercise_definitions
SET aliases = ARRAY(SELECT DISTINCT unnest(aliases || {sql_array(aliases)}) ORDER BY 1)
WHERE normalized_name = {sql_text(norm)};""")
    out.append("""
-- ── Link user exercises (exact name / alias) ────────────────────────
CREATE OR REPLACE FUNCTION link_unlinked_exercises()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_linked integer;
BEGIN
  WITH matches AS (
    SELECT DISTINCT ON (e.id) e.id AS exercise_id, d.id AS def_id,
           d.is_bodyweight, d.is_main_lift, d.equipment_type
    FROM exercises e
    JOIN exercise_definitions d
      ON d.normalized_name = COALESCE(e.normalized_name, lower(trim(e.name)))
      OR d.aliases @> ARRAY[COALESCE(e.normalized_name, lower(trim(e.name)))]
    WHERE e.exercise_definition_id IS NULL
    -- exact name beats alias
    ORDER BY e.id, (d.normalized_name = COALESCE(e.normalized_name, lower(trim(e.name)))) DESC
  )
  UPDATE exercises e SET
    exercise_definition_id = m.def_id,
    is_bodyweight          = m.is_bodyweight,
    is_main_lift           = m.is_main_lift,
    category               = m.equipment_type
  FROM matches m
  WHERE e.id = m.exercise_id;
  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN v_linked;
END;
$$;

SELECT link_unlinked_exercises();
""")
    return "\n".join(out)


LABEL = {"machine_plate": "machine (plate)", "machine_stack": "machine (stack)", "trap_bar": "trap bar",
         "back_lats": "lats", "back_upper": "upper back", "cardio_machine": "cardio machine"}


def build_doc(new_rows_by_group, total, existing_count):
    lines = [f"""# Exercise library gap list (Phase E)

Generated by `scripts/exercise_library_e.py` (also generates migration `020_expand_exercise_library.sql`).

The seeded library (`012` + the production-only kettlebell rows captured as `012b`) had **{existing_count}** definitions and matched names exactly, so common lifts
(OHP, hack squat, farmer's walk, trap-bar deadlift …) never linked: those exercises had no equipment, muscle or
movement pattern, which equipment-aware progression and volume-per-muscle need. This adds
**{sum(len(v) for v in new_rows_by_group.values())}** definitions (total **{total}**) and shorthand aliases for existing ones.

All values fit the existing CHECK constraints of `010b_exercise_library.sql` — no enum changes (Task E.2).
Full-body moves use the closest primary muscle with the rest in secondary muscles.
"""]
    for group, rows in new_rows_by_group.items():
        lines.append(f"## {group}\n\n| Exercise | Equipment | Primary | Secondary | Pattern | Aliases |\n|---|---|---|---|---|---|")
        for r in rows:
            lines.append("| " + " | ".join([
                r["name"], LABEL.get(r["eq"], r["eq"]), LABEL.get(r["primary"], r["primary"]),
                ", ".join(LABEL.get(m, m) for m in r["secondary"]), r["pattern"].replace("_", " "),
                ", ".join(r["aliases"])]) + " |")
        lines.append("")
    lines.append("## Aliases added to existing definitions\n\n| Definition | New aliases |\n|---|---|")
    for norm, aliases in ALIASES_FOR_EXISTING.items():
        lines.append(f"| {norm} | {', '.join(aliases)} |")
    lines.append("\n## Aliases moved\n")
    lines.append("- `hanging leg raise`: from *Leg Raise* to the new *Hanging Leg Raise*.")
    lines.append("- `donkey calf raise`: from *Seated Calf Raise* (wrong — the donkey raise is standing) to the new *Donkey Calf Raise*.")
    lines.append("""
Not added on purpose: a separate *Cable Fly* (already an alias of *Cable Crossover*) and a plain *Goblet Squat*
(alias of *Kettlebell Goblet Squat*; the dumbbell version is *DB Goblet Squat*).
""")
    return "\n".join(lines)


def main():
    existing = parse_existing()
    new_rows = [r for rows in GROUPS.values() for r in rows]
    errors, total = validate(existing, new_rows)
    if errors:
        raise SystemExit("Validation failed:\n  " + "\n  ".join(errors))
    (ROOT / "supabase/migrations/020_expand_exercise_library.sql").write_text(build_sql(GROUPS, total))
    (ROOT / "docs/exercise_gap_list.md").write_text(build_doc(GROUPS, total, len(existing)))
    print(f"{len(existing)} existing + {len(new_rows)} new = {total} definitions")


if __name__ == "__main__":
    main()
