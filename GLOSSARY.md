# GYM Tracker

A personal strength-training log: programs are planned, workouts are performed set by set, and history and progress are derived from what was actually done.

## Language

### Sets

**Work set**:
A set that is not a warmup; the sets that count as training.
_Avoid_: Working set, main set

**Warmup set**:
A lighter set done to prepare for the work sets; never counts toward volume, records or progression.
_Avoid_: Ramp-up set

**Warmup ramp**:
Warmup sets planned automatically before a main barbell-type lift that has no warmups in its previous results: 50, 70 and 85 % of the first work set for 8, 5 and 3 reps, from 40 kg up.
_Avoid_: Auto warmups, ramp-up sets

**Completed set**:
A set the lifter has checked off as done.
_Avoid_: Logged set, finished set, set with data

**Too-heavy set**:
A work set the lifter flagged as too heavy, optionally with the reps actually achieved.
_Avoid_: Failed set, missed set

**Planned set**:
A set row that exists in a workout but has not been checked off, even if a weight and reps are already filled in.
_Avoid_: Pending set, empty set

### Workouts

**In-progress workout**:
A workout that has been started but not yet finished or discarded.
_Avoid_: Active workout, open workout, session

**Workout draft**:
The unsaved state of an in-progress workout kept on the lifter's device — sets, notes and cardio entered so far — so nothing is lost on reload or without a connection.
_Avoid_: Local copy, cache, autosave

**Easy Week**:
A deliberately lighter workout: fewer sets and reduced weights, with no weight progression suggested.
_Avoid_: Deload (in user-facing text), recovery week

**Week streak**:
The number of consecutive Monday–Sunday weeks, counting back from this one, with at least one finished workout. A current week without a workout yet doesn't break it.
_Avoid_: Streak (alone), daily streak

### Measures

**Volume**:
The external load lifted in a workout: the sum of weight × reps over its completed work sets. Bodyweight sets add nothing.
_Avoid_: Tonnage, workload, total weight

**Top set**:
The heaviest completed work set of an exercise in one workout.
_Avoid_: Best set, max set

**Previous results**:
The sets of an exercise from the lifter's most recent finished workout with it on the same equipment (Easy Week workouts excluded): its completed work and warmup sets, or, when none of those sets was checked off, every set with a weight or reps entered. The basis for the next workout's planned sets and suggested weight.
_Avoid_: Last time, history

**Suggested weight**:
The weight proposed for an exercise's next work sets, from the previous results' heaviest work set: one progression step up when every work set reached the target reps, one step down after a too-heavy set, otherwise the same. In an Easy Week it never goes up.
_Avoid_: Recommended weight, target weight

**Weekly sets**:
For a muscle, the number of completed work sets in a week (Monday–Sunday, local time) of exercises whose primary muscle it is. The measure of training volume per muscle; secondary muscles don't count.
_Avoid_: Weekly volume (that is kg), muscle volume

**Progression step**:
How much the suggested weight moves at a time for an equipment type (e.g. 2.5 kg for a barbell, 2 kg for dumbbells). Equipment moved by bodyweight or bands has none, so it gets no suggested weight.
_Avoid_: Increment, jump
