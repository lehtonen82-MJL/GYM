# Program Builder + Program Import - Testing Guide

## Phases Implementation Checklist

### ✅ Phase 1: Schema + Types + List & New Program Pages
- [x] Database migration with all tables
- [x] TypeScript types (Program, ProgramDay, ProgramExercise, ParsedProgramPreview)
- [x] Server actions: CRUD programs
- [x] Programs list page (`/programs`)
- [x] New program page (`/programs/new`)
- [x] Bottom nav integration

### ✅ Phase 2: Program Editor + Duplicate
- [x] Full program editor (`/programs/[id]/edit`)
- [x] Day management: add/edit/delete/reorder
- [x] Exercise management: add/edit/delete/reorder  
- [x] Dupicate program modal
- [x] Components: ProgramDayCard, ProgramExerciseRow, DuplicateProgramModal

### ✅ Phase 3: Import + Parser + Preview
- [x] Import page (`/programs/import`)
- [x] Program text parser with warnings
- [x] Mode detection (weekday vs session)
- [x] Scheme parsing (extracts target sets)
- [x] Preview page (`/programs/import/preview`)
- [x] Save imported program action

### ✅ Phase 4: Mobile Polish + Integration
- [x] Responsive design throughout
- [x] Large touch targets (44px+ buttons)
- [x] Mobile-first card layout
- [x] Error handling and feedback
- [x] Demo mode with mock data
- [x] Bottom nav behavior (hides on editor routes)
- [x] Parser test suite

---

## Testing Scenarios

### Test 1: Create Program from Scratch
**Steps:**
1. Tap Programs in nav
2. Tap "New Program"
3. Fill in: Name="Strength A", Description="Linear strength", Mode=Weekday
4. Tap "Create Program"
5. Should redirect to editor

**Expected:**
- Program created and editor opens
- Can add days and exercises
- Demo shows empty program

---

### Test 2: Add Days and Exercises
**Steps:**
1. In editor, tap "+ Add Day"
2. Rename day by clicking name
3. Expand day, tap "+ Add Exercise"
4. Click exercise row to edit
5. Fill in all fields (name required)
6. Tap Save

**Expected:**
- Day appears and can be renamed
- Exercise row shows all fields
- Reorder arrows appear on hover
- Delete works with confirmation

---

### Test 3: Duplicate Program
**Steps:**
1. In editor, tap 📋 icon (top right)
2. Enter new name
3. Tap "Create Copy"

**Expected:**
- Redirects to new program's editor
- All days and exercises copied
- Original unchanged

---

### Test 4: Import Weekday Program
**Steps:**
1. Tap Programs → "Import"
2. Paste:
```
[Monday]
Back Squat | 4x2
Bench Press | 5x5

[Wednesday]
Deadlift | 1x5 + 5x3
Rows | 3x8
```
3. Tap "Preview"
4. Name it "Imported Weekday"
5. Tap "Save Program"

**Expected:**
- Parser detects "weekday" mode
- Shows 2 days with 2 exercises each
- No warnings (valid input)
- Program saved and appears in list

---

### Test 5: Import Session Program with Warnings
**Steps:**
1. Tap Programs → "Import"
2. Paste:
```
[Workout 1]
Squat | 4x2
Bench

[Workout 1]
Deadlift
```
3. Tap "Preview"

**Expected:**
- Shows warnings: "Duplicate day name" and "Exercise line before header"
- Detects "session" mode
- Still allows saving (warnings don't block)

---

### Test 6: Bottom Nav Behavior
**Steps:**
1. Tap Programs, then a program
2. Should see Programs tab in nav
3. Tap Edit → should hide nav
4. Go back to list → nav reappears

**Expected:**
- Nav visible on list/detail
- Nav hidden in editor routes
- Smooth transitions

---

### Test 7: Active Program
**Steps:**
1. Create 2 programs
2. In programs list, tap "Set Active" on second
3. Check: First program shows "Active" badge, second shows "Set Active" button
4. Tap first program's "Set Active"
5. Check: Badges swap

**Expected:**
- Only one program active at a time
- UI reflects current active status
- Set Active action works instantly

---

### Test 8: Demo Mode
**Steps:**
1. Don't set NEXT_PUBLIC_SUPABASE_URL
2. Run `npm run dev`
3. Navigate to /programs

**Expected:**
- Shows 2 mock programs
- Can edit, duplicate, delete (in memory)
- Import parser works
- No errors in console

---

## File Structure Summary

```
src/
├── lib/
│   ├── types.ts (UPDATED - all types)
│   ├── actions.ts (UPDATED - all server actions)
│   ├── programParser.ts (NEW - text parser)
│   └── programParser.test.ts (NEW - tests)
├── components/
│   ├── BottomNav.tsx (UPDATED)
│   ├── ProgramCard.tsx (NEW)
│   ├── ProgramForm.tsx (NEW)
│   ├── ProgramDayCard.tsx (NEW)
│   ├── ProgramExerciseRow.tsx (NEW)
│   ├── DuplicateProgramModal.tsx (NEW)
│   └── ImportPreviewCard.tsx (NEW)
└── app/(app)/
    └── programs/
        ├── page.tsx (NEW - list)
        ├── new/page.tsx (NEW - create)
        ├── [id]/edit/page.tsx (NEW - editor)
        └── import/
            ├── page.tsx (NEW - import)
            └── preview/page.tsx (NEW - preview)

supabase/
└── migrations/
    └── 001_add_program_builder.sql (NEW - schema)
```

---

## Known Limitations & Future Enhancements

### Current Behavior
- Day counts not fetched per program (shows 0)
- Parser doesn't validate exercise names against master list
- Import uses sessionStorage for preview (fine for single user)
- No AI integration yet (ready for Phase 5)

### Possible Enhancements
1. Fetch actual day counts from DB per program
2. Add master exercise picker with autocomplete
3. Save import history/logs
4. AI-powered program generation
5. Program sharing/templates
6. Workout history integration
7. Program analytics (volume, frequency)

---

## Deployment Checklist

- [ ] Run migration SQL in Supabase console
- [ ] Set NEXT_PUBLIC_SUPABASE_URL in env
- [ ] Test with real Supabase auth
- [ ] Test programs list loading
- [ ] Test full editor workflow
- [ ] Test import with various formats
- [ ] Test duplicate with nested data
- [ ] Verify RLS policies work
- [ ] Check mobile responsiveness on real device
- [ ] Test all error cases

---

## Quick Debug Tips

1. **Import parsing issues:**
   - Check if text has [Day] headers
   - Verify pipe | separators
   - Look at warnings on preview page

2. **Editor not loading:**
   - Check browser console for errors
   - Verify program ID in URL
   - Try demo mode (no Supabase)

3. **Demo mode:**
   - Leave NEXT_PUBLIC_SUPABASE_URL unset
   - All data stored in memory (lost on refresh)
   - Useful for UI testing

4. **Active program:**
   - Uses set_active_program() Postgres function
   - Only one active per user
   - Check RLS policies if not working
