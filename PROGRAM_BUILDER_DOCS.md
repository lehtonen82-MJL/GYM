# Program Builder Feature - Complete Implementation

## Overview

Full-featured program builder with import, editor, and duplication. Users can:
- Create programs manually (weekday or session mode)
- Manage days and exercises with reordering
- Duplicate existing programs
- Import programs from text with automatic parsing
- Preview imported programs before saving
- Set a program as active

## Architecture

### Database Schema
New tables and columns added by migration `001_add_program_builder.sql`:
- `programs` - program metadata (name, mode, is_active, description)
- `workout_days` - days within programs (kind, day_order)
- `program_day_exercises` - exercises within days (snapshot name, scheme, sets, reps, notes)
- Extended `exercises` table with normalized_name, category, is_main_lift

### Server-Side (Actions)
All in `src/lib/actions.ts`:
- Program CRUD: getPrograms, getProgramById, createProgram, updateProgram, deleteProgram, getActiveProgram, setActiveProgram
- Day CRUD: getProgramDays, createProgramDay, updateProgramDay, deleteProgramDay, reorderProgramDays
- Exercise CRUD: getProgramExercises, createProgramExercise, updateProgramExercise, deleteProgramExercise, reorderProgramExercises
- Special: duplicateProgram (with cascading copy), saveImportedProgram

### Parser
`src/lib/programParser.ts`:
- Splits text by lines, identifies `[Day]` headers
- Parses exercises: `Name | Scheme | Notes`
- Extracts target sets from scheme (e.g., "3x5" → 3, "1x5 + 2x5" → 3)
- Detects mode: weekday if all headers match weekday names, else session
- Warning system: empty days, duplicate days, malformed lines

### Components

| File | Purpose |
|------|---------|
| ProgramCard | Card display (name, mode, active badge, actions) |
| ProgramForm | Create/edit form (name, description, mode) |
| ProgramDayCard | Expandable day with rename, reorder, delete |
| ProgramExerciseRow | Exercise view/edit row |
| DuplicateProgramModal | Bottom-sheet modal for duplicate input |
| ImportPreviewCard | Card for import preview |
| WarningBadge | Styled warning display |

### Pages

| Path | Purpose |
|------|---------|
| /programs | List all programs, show active first |
| /programs/new | Create new program |
| /programs/[id]/edit | Full editor with days/exercises CRUD |
| /programs/import | Upload text, parse, show instructions |
| /programs/import/preview | Review parsed program, customize name, save |

## Key Design Decisions

1. **Demo Mode Support**
   - All actions have demo fallback when NEXT_PUBLIC_SUPABASE_URL not set
   - Mock data in memory for testing UI without database
   - `DEMO_MODE` constant detects environment

2. **Flexible Exercise Snapshots**
   - Exercise names stored as `exercise_name_snapshot` (not linked to master exercises)
   - Allows importing custom exercises without master list
   - Warnings instead of blocking unknown exercises
   - Future: can link to exercises on workout creation

3. **Mode Detection**
   - Parser checks if all day headers match weekday names (Monday, Tuesday, etc.)
   - If yes → weekday mode, else → session mode
   - Allows mixed headers without breaking

4. **Optimistic Updates**
   - Reorder operations update local state immediately
   - Revert on server error
   - Faster UX on slow connections

5. **Warnings Not Blockers**
   - Parser collects warnings but doesn't fail
   - Empty days, duplicate days, malformed lines all show but allow save
   - Gives users flexibility for non-standard formats

6. **Active Program Management**
   - Uses Postgres function `set_active_program()` 
   - Ensures only one active per user
   - Single query instead of multi-step updates

## User Workflows

### Create Manual Program
1. Tap Programs → New Program
2. Fill name, description, mode
3. Create → editor opens
4. Add days, expand, add exercises
5. Edit exercises by clicking rows
6. Reorder with arrows
7. Back to list

### Import Program
1. Tap Programs → Import
2. Paste text (helps with sample)
3. Tap Preview
4. Review structure and warnings
5. Customize program name
6. Option: Set Active immediately
7. Save → back to list

### Duplicate Program
1. In editor, tap 📋 icon
2. Modal opens with default name (Copy)
3. Change name if needed
4. Create Copy → new editor opens
5. Everything copied, ready to customize

## Performance Considerations

1. **N+1 Queries Avoided**
   - getProgramDays loads all days for program
   - Loop fetches exercises per day (better than one query loading all with relational joins in Supabase)
   - Acceptable for typical 3-7 days per program

2. **Reordering Efficiency**
   - Local state updated first (fast response)
   - Batch update to DB (one query per day/exercise)
   - Reverts only if error

3. **Import Preview**
   - Uses sessionStorage (no round trip)
   - Keeps data during navigation without DB writes
   - Clears on successful save

## Error Handling

- Try-catch blocks on all async operations
- User-friendly error messages
- Toast-like dismissible errors
- Fallback to previous state on failures
- Validators on form inputs (required fields)

## Mobile UX

- Touch targets 44px+ minimum
- Card-based layout (no dense tables)
- Bottom-sheet modals
- Horizontal scroll avoided
- Large, clear buttons
- Inline labels
- Hover effects work on mobile (click-based)

## Testing

Parser test suite in `programParser.test.ts` covers:
- Weekday mode detection
- Session mode detection  
- Scheme parsing
- Multiple exercises per day
- Warning generation

Manual testing documented in `PROGRAM_BUILDER_TESTING.md`

## Future Enhancements

1. **AI Integration** - Accept generated programs from Claude/GPT
2. **Exercise Master List** - Link snapshot names to exercises
3. **Templates** - Pre-built programs (PPL, 5/3/1, etc.)
4. **Sharing** - Export/import programs between users
5. **Workout Integration** - Use active program in workout creation
6. **Analytics** - Volume trends, frequency stats
7. **History** - Import history, previous versions
8. **Video Demos** - Link exercises to form videos

## Dependencies

No new external packages needed:
- Uses Next.js 16 App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Supabase for persistence
- sessionStorage for preview state

## Deployment Notes

1. Run migration in Supabase SQL editor
2. Ensure NEXT_PUBLIC_SUPABASE_URL is set
3. RLS policies enabled on all tables
4. Test with real auth flow
5. Verify active program logic works
6. Check import warnings display correctly on various formats
