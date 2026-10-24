# Start template workouts through start_workout (atomic)

Status: needs-triage
Category: enhancement

Program starts create the workout, its entries and planned sets in one transaction (`start_workout`
RPC, migration 021). Template starts (`startWorkoutFromTemplate`) still insert the workout, then entries,
then sets separately, so an interrupted start can leave an empty workout behind.

`start_workout` already accepts `workout_day_id: null`; template workouts also set
`import_session_name` (the template's name), which the RPC doesn't take yet — a migration (023) would add
it to `p_workout`. Needs a production migration run, like 021/022.
