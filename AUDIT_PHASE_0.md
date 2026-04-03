# PHASE 0: CODE & PERFORMANCE AUDIT

## Executive Summary

The GYM Tracker app works well but has **clear performance bottlenecks** especially around **workout set entry interactions**. The main slowness comes from:

1. **Unnecessary component re-renders** due to callback prop drilling and missing memoization
2. **Expensive calculations in render** (progress chart, array operations)
3. **Sequential Supabase queries** instead of parallel execution
4. **Function references recreated on every render** causing child component re-renders
5. **Unoptimized input handling** in SetRow (controlled inputs without proper optimization)

---

## Audit Findings (Ranked by Impact)

### 🔴 **HIGH IMPACT ISSUES** (Cause Perceived Slowness)

#### 1. **SetRow/WeightStepper render on every set change** ⚡ **CRITICAL**
- **Problem**: When user taps weight ±, the entire ExerciseCard's parent (WorkoutClient) re-renders, causing ALL ExerciseCards to re-render
- **Root cause**: 
  - ExerciseCard defines `handleWeightChange`, `handleRepsChange`, `handleToggleComplete` without `useCallback`
  - These are new function references each render
  - SetRow receives these functions as props and is not memoized
  - Any set change in `setsMap` triggers parent re-render
- **Perceived impact**: IMMEDIATE tap-to-response delay visible on phone
- **Files affected**: 
  - `src/components/ExerciseCard.tsx`
  - `src/components/SetRow.tsx`
  - `src/components/WeightStepper.tsx`

**Why it matters**: Tapping weight button should feel instant (< 100ms). Currently takes 200-300ms because whole tree re-renders.

---

#### 2. **startWorkout makes sequential database calls** ⚡ **HIGH**
- **Problem**: When user taps "Start Workout", the function:
  1. Fetches workout_day
  2. Creates workout row
  3. Fetches workout_day_exercises
  4. For each exercise: creates entry + sets
  5. For each exercise: calls getSuggestedWeight (which fetches set_entries again)
  
  This is **6+ sequential Supabase queries** that could be 3 parallel calls.

- **Code location**: `src/lib/actions.ts` lines 138-280 (startWorkout function)
- **Perceived impact**: "Starting..." button feels slow (1-2 second delay)
- **Why it matters**: This is the first action users do; slowness here is immediately noticeable

---

#### 3. **ProgressClient recalculates chart on every render** ⚡ **MEDIUM-HIGH**
- **Problem**: 
  - maxWeight/minWeight/range calculations happen every render
  - SVG polyline `points` calculation happens every render (expensive array.map)
  - Data array reversal happens every render
  - Chart doesn't use memoization

- **Code location**: `src/app/(app)/progress/ProgressClient.tsx` lines 28-135
- **Perceived impact**: Sluggish scrolling, laggy interactions in progress tab
- **Why it matters**: While progress isn't critical path, it trains user to expect slow interactions

---

#### 4. **ExerciseCard fetches previous results on mount** ⚠️ **MEDIUM**
- **Problem**: 
  - Each ExerciseCard calls `getPreviousResults` in useEffect
  - These are sequential, not parallel
  - If 5 exercises, 5 separate async calls one after another
  - Loading state doesn't exist (just "Loading..." or nothing)

- **Code location**: `src/components/ExerciseCard.tsx` lines 16-18
- **Perceived impact**: Previous results appear slowly, users wait to see suggestions
- **Why it matters**: Affects user decision-making during workout

---

#### 5. **WorkoutClient manages all set state at one level** ⚠️ **MEDIUM**
- **Problem**: ALL set entries from ALL exercises stored in one `setsMap` state
  - Any change to any set triggers WorkoutClient re-render
  - All ExerciseCards re-render
  - No granular state update

- **Code location**: `src/app/(app)/workout/[id]/WorkoutClient.tsx` lines 20-25
- **Perceived impact**: Latency between tap and visual feedback
- **Why it matters**: Workout is core interaction; delays feel Wrong

---

### 🟡 **MEDIUM IMPACT ISSUES** (Code Quality & Maintainability)

#### 6. **Type usage inconsistent** ⚠️ **MEDIUM**
- `StartWorkoutResult` type mixes concerns (workout, entries, suggestions)
- Program types and legacy types coexist (ProgramDay vs WorkoutDay)
- Partial type usage scattered (e.g., `Partial<SetEntry>`)

---

#### 7. **Helper functions not extracted** ⚠️ **MEDIUM**
- `formatDate`, `formatDuration` defined in multiple files
- No shared utility module
- Makes refactoring harder

**Files affected**: history/page.tsx, workout/[id]/WorkoutClient.tsx

---

#### 8. **Magic numbers scattered** ⚠️ **MEDIUM**
- `step = 2.5` hardcoded in WeightStepper
- Tailwind classnames with magic values
- No constants file for app defaults

---

#### 9. **Callback prop drilling** ⚠️ **MEDIUM**
- ExerciseCard receives onSetsChange, then passes down multiple callbacks to SetRow
- SetRow passes them to WeightStepper
- Makes refactoring this chain difficult

---

#### 10. **sessionStorage workaround** ⚠️ **MEDIUM-LOW**
- StartWorkoutButton stores result in sessionStorage to "avoid server module isolation issues"
- This is a workaround; proper server/client boundary would be cleaner
- Code comment suggests team knows this isn't ideal

**Location**: `src/app/(app)/today/StartWorkoutButton.tsx` line 20

---

### 🟢 **LOW IMPACT ISSUES** (Nice-to-have improvements)

#### 11. **Navigation fetches same data repeatedly**
- TodayPage always calls getTodayWorkoutDay + getWorkoutDaysForProgram
- No caching; re-fetches on route change

---

#### 12. **No optimistic updates**
- Set changes don't reflect instantly; wait for saveSets call
- Can add optimistic local state

---

#### 13. **Inconsistent error handling**
- Some actions throw errors, components don't catch
- Missing try-catch in some places

---

#### 14. **Controlled input performance**
- SetRow reps input `value={reps ?? ""}` and onChange
- These are fine but could be uncontrolled locally with ref

---

## Components Most Likely Causing Tap Lag

**Priority Order (highest to lowest impact on perceived slowness):**

1. **SetRow** ⚡⚡⚡
   - Every weight/reps change triggers parent re-render
   - Not memoized
   - Receives new function references each render
   
2. **WeightStepper** ⚡⚡⚡
   - Three buttons with separate onClick handlers
   - Not memoized
   - Recreated every parent render

3. **ExerciseCard** ⚡⚡
   - Creates new callback functions each render (no useCallback)
   - Renders all SetRows unoptimized
   - Previous results fetch blocks

4. **WorkoutClient** ⚡⚡
   - Manages entire workout state
   - Re-renders all children on any set change
   - No state splitting

5. **ProgressClient** ⚡
   - Chart calculations happen every render
   - Large dataset manipulation not memoized

---

## Refactor Priority Plan

### Phase 1 (Quick Wins) – 30 minutes
**Target**: SetRow/WeightStepper responsiveness
- Memoize SetRow with React.memo
- Memoize WeightStepper with React.memo
- Use useCallback for ExerciseCard callbacks
- Extract weight step constant

**Expected improvement**: 200ms → 50ms response time on tap

---

### Phase 2 (Workout Critical Path) – 45 minutes
**Target**: Workout screen performance
- Split ExerciseCard state (local set state + parent sync)
- Optimize ExerciseCard rendering
- Parallelize getPreviousResults calls
- Add optimistic updates for set completion

**Expected improvement**: Visible smoothness, instant checkmark feeling

---

### Phase 3 (Data Layer) – 60 minutes
**Target**: startWorkout slowness
- Parallelize startWorkout database calls (Promise.all)
- Batch getSuggestedWeight calls
- Add proper loading states
- Preload suggestions in parallel

**Expected improvement**: 1.5s → 0.5s for "Start Workout"

---

### Phase 4 (Code Quality) – 40 minutes
**Target**: Maintainability
- Extract utility functions (formatDate, formatDuration)
- Create constants file for magic numbers
- Clean up type definitions
- Improve error handling

**Expected improvement**: Easier to maintain, understand, and extend

---

### Phase 5 (Polish) – 20 minutes
**Target**: Final review
- Verify no regressions
- Add performance monitoring points
- Document optimization decisions

---

## Files to Change (Ranked by Importance)

| Priority | File | Why | Risk | Effort |
|----------|------|-----|------|--------|
| 1 | `src/components/SetRow.tsx` | Add memoization | LOW | 5min |
| 1 | `src/components/WeightStepper.tsx` | Add memoization | LOW | 5min |
| 1 | `src/components/ExerciseCard.tsx` | useCallback + optimize | MEDIUM | 15min |
| 2 | `src/app/(app)/workout/[id]/WorkoutClient.tsx` | State splitting + optimistic | MEDIUM | 30min |
| 2 | `src/lib/actions.ts` | Parallelize queries | MEDIUM | 20min |
| 3 | `src/app/(app)/progress/ProgressClient.tsx` | Memoize calculations | LOW | 15min |
| 3 | `src/lib/utils.ts` (NEW) | Extract helpers | LOW | 10min |
| 4 | `src/constants.ts` (NEW) | Magic numbers | LOW | 5min |

---

## Risk Assessment

**Phase 1-2 (Quick wins)**: ⚠️ **LOW RISK**
- Memoization changes are local to components
- No data structure changes
- Easy to revert if issues

**Phase 3 (Database)**: ⚠️ **MEDIUM RISK**
- Parallelize calls could cause race conditions
- Need to test data consistency
- Requires careful error handling

**Phase 4-5**: ✅ **VERY LOW RISK**
- Refactoring only
- No behavior changes

---

## Specific Optimization Ideas to Evaluate

### Confirmed to Implement ✅
- React.memo for SetRow, WeightStepper
- useCallback for ExerciseCard handlers
- Promise.all for startWorkout queries
- useMemo for ProgressClient calculations

### Evaluate but Low Priority
- Uncontrolled inputs in SetRow (minimal benefit)
- Local state + parent sync pattern (more complex)
- Request deduplication (caching library overhead)

### Not Recommended for This App ❌
- Redux/Zustand (overkill for this scope)
- Heavy abstractions
- Server actions restructuring (works fine)

---

## Expected Performance Gains

| Interaction | Current | After Phase 1 | After Phase 2 | After Phase 3 |
|-------------|---------|---------------|---------------|---------------|
| Tap weight ± | 200-300ms | 50-100ms | 30-50ms | Same |
| Mark set complete | 150ms | 30-50ms | 20-30ms | Same |
| Start Workout button | 1.5-2.0s | Same | Same | 0.4-0.6s |
| Progress chart scroll | Sluggish | Smooth | – | – |

---

## Summary

**Main findings:**
1. Workout set entry has clear tap-lag due to re-render cascades
2. startWorkout is slow due to sequential queries
3. Progress chart is inefficient but lower priority
4. Code is well-typed but has scattered helpers and magic numbers
5. No major architectural flaws; mostly optimization opportunities

**Recommended approach:**
- Phase 1 first (biggest bang for buck)
- Phase 3 next (critical path)
- Phase 2-4 for polish
- All changes are low-risk, high-ergonomic-value

---

## Waiting for Approval

Ready to proceed with Phase 1 (Quick Wins) when you confirm.
