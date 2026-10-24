# GYM Tracker

A fast, minimal workout tracking PWA optimized for one-handed iPhone use. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Today View** — See today's workout based on a fixed weekly plan
- **Active Workout** — Log sets with large touch targets, weight steppers (±2.5kg), auto-advance on completion
- **Smart Suggestions** — If you completed all sets last time → suggests +2.5kg
- **Workout Summary** — Top set per exercise + session notes
- **History** — Browse past workouts with duration and notes
- **Progress Charts** — Track top set progression per exercise over time
- **PWA** — Installable on iPhone home screen, standalone display

## Demo Mode

The app runs in **demo mode** with mock data when no Supabase credentials are configured. This is great for trying it out locally.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — no account or database needed.

---

## Full Setup (Step-by-Step for Beginners)

### Prerequisites

1. **Node.js** (v18+) — download from [nodejs.org](https://nodejs.org/)
2. **Git** — download from [git-scm.com](https://git-scm.com/)
3. **A code editor** — [VS Code](https://code.visualstudio.com/) recommended
4. **A Supabase account** — free at [supabase.com](https://supabase.com/)

### Step 1: Clone the Repository

Open a terminal (Command Prompt, PowerShell, or Terminal on Mac) and run:

```bash
git clone https://github.com/YOUR_USERNAME/GYM.git
cd GYM
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Choose an organization (or create one)
4. Enter a project name (e.g. `gym-tracker`)
5. Set a **database password** — save this somewhere safe
6. Choose a region close to you
7. Click **"Create new project"** and wait for it to finish

### Step 4: Get Your API Keys

1. In your Supabase project, go to **Project Settings** (gear icon, bottom-left)
2. Click **"API"** in the sidebar
3. You'll see:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`
4. Copy both of these

### Step 5: Configure Environment Variables

1. In the project folder, copy the example file:

```bash
# Windows
copy .env.example .env.local

# Mac/Linux
cp .env.example .env.local
```

2. Open `.env.local` in your editor and paste your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 6: Create the Database

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/setup.sql` from this project
4. **Copy the entire contents** and paste it into the SQL editor
5. Click **"Run"** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" — this is normal

`setup.sql` contains every migration plus the default-program function from `seed.sql`.
Run the same file again after pulling updates — it is safe on an existing database.
See `supabase/migrations/README.md` for details.

### Step 7: Enable Email Auth

1. In Supabase, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. For testing, you can **disable "Confirm email"** in **Authentication** → **Settings** → **Email** → uncheck "Enable email confirmations"
   - This lets you sign up without checking your email
   - **Re-enable this before going to production**

### Step 8: Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 9: Create Your Account

1. You'll see the login page
2. Click **"Need an account? Sign up"**
3. Enter your email and a password (min 6 characters)
4. Click **"Sign Up"**
5. If you disabled email confirmation: you'll be redirected to `/today` automatically
6. If email confirmation is on: check your email and click the confirmation link

Your default workout program (Oly/Back/Legs/Chest) is automatically created on first login.

---

## Install as PWA on iPhone

1. Open the app URL in **Safari**
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**

The app will now open in full-screen mode like a native app.

---

## Deploy to Vercel (Optional)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com/) and sign in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your `GYM` repository
5. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
6. Click **"Deploy"**
7. Update your Supabase **Authentication** → **URL Configuration**:
   - Set **Site URL** to your Vercel URL (e.g. `https://gym-tracker.vercel.app`)
   - Add `https://gym-tracker.vercel.app/auth/callback` to **Redirect URLs**

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout (fonts, metadata, PWA)
│   ├── page.tsx            # Redirects to /today
│   ├── globals.css         # Tailwind theme + custom CSS
│   ├── login/page.tsx      # Email/password auth
│   ├── auth/callback/      # OAuth callback handler
│   ├── icons/[...slug]/    # Dynamic PWA icon generation
│   └── (app)/              # Authenticated app shell
│       ├── layout.tsx      # Bottom nav wrapper
│       ├── today/          # Today's workout + weekly grid
│       ├── workout/[id]/   # Active workout logging
│       ├── history/        # Past workouts list
│       └── progress/       # Exercise progression charts
├── components/
│   ├── BottomNav.tsx       # Tab bar (Today/History/Progress)
│   ├── ExerciseCard.tsx    # Expandable exercise with sets
│   ├── SetRow.tsx          # Single set: weight × reps + check
│   └── WeightStepper.tsx   # ±2.5kg stepper buttons
├── lib/
│   ├── actions.ts          # Server actions (Supabase + demo mock)
│   ├── types.ts            # TypeScript types for all tables
│   └── supabase/           # Supabase client setup
└── proxy.ts                # Auth middleware
supabase/
├── migrations/             # Source of truth for the schema (see migrations/README.md)
├── setup.sql               # Generated: all migrations + seed, paste into SQL Editor
├── schema.sql              # Generated snapshot of the schema (reference only)
├── seed.sql                # Default workout program function
└── tests/                  # verify-migrations.sh: checks the chain on a local Postgres
```

## Default Program

| Day       | Label | Workout | Exercises                                          |
|-----------|-------|---------|----------------------------------------------------|
| Tuesday   | TI    | Oly     | Snatch, Clean & Jerk, Calves                       |
| Thursday  | TO    | Back    | Pull-ups, Row, Face Pull, RDL                      |
| Saturday  | LA    | Legs    | Back Squat, Front Squat, Leg Curl, Calves          |
| Sunday    | SU    | Chest   | Bench Press, Incline Bench, Dips, Fly, Triceps, Light Row |

## Tech Stack

- **Next.js 16** (App Router, Server Actions)
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Auth + Postgres + Row Level Security)
- No unnecessary libraries
