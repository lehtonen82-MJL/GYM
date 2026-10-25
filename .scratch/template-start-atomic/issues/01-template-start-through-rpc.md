# Start template workouts through start_workout (atomic)

Status: closed
Category: enhancement

Program starts create the workout, its entries and planned sets in one transaction (`start_workout`
RPC, migration 021). Template starts (`startWorkoutFromTemplate`) still insert the workout, then entries,
then sets separately, so an interrupted start can leave an empty workout behind.

`start_workout` already accepts `workout_day_id: null`; template workouts also set
`import_session_name` (the template's name), which the RPC doesn't take yet — a migration (023) would add
it to `p_workout`. Needs a production migration run, like 021/022.

## Comments

### Resolution (2026-10-25)

Migration 023 adds `import_session_name` to start_workout's p_workout; `startWorkoutFromTemplate`
plans the sets with planSets and creates everything through the RPC. Tested in `tests/rpc_test.sql`
(fails without 023).
