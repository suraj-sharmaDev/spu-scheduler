# Learning Tracker

The second half of the app (`/tracker`). It takes attendance for five weekly study
slots and shows a learning plan (tasks, sub-tasks, concepts) with progress saved in
Neon Postgres. The SPU Scheduler (`/scheduler`) is unchanged and still stores
everything in the browser.

## Where things live

| What | Where |
|---|---|
| Study slots, timezone, start date, late/early rules | `src/lib/tracker/schedule.ts` |
| Project content (read-only, committed) | `src/data/projects/<slug>.json` |
| Project registry | `src/lib/tracker/projects.ts` |
| Content types | `src/lib/tracker/types.ts` |
| Workbook importer | `scripts/import-project.ts` |
| DB schema / migrations | `src/lib/tracker/db/schema.ts`, `drizzle/` |
| Server functions (all reads/writes) | `src/lib/tracker/api.ts` |
| Login / session cookie | `src/lib/tracker/auth.server.ts` |

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string (set by the Vercel Neon integration) |
| `TRACKER_LEARNER_PASSCODE` | Samanata's passcode: full access |
| `TRACKER_ADMIN_PASSCODE` | Your passcode: sees everything, can't change anything |
| `SESSION_SECRET` | Signs the session cookie. At least 32 characters: `openssl rand -hex 32` |

Changing `SESSION_SECRET` signs everyone out. Changing a passcode doesn't end
existing sessions (they last 30 days); rotate `SESSION_SECRET` too if you need that.

## Database

```sh
pnpm db:migrate    # apply migrations in drizzle/ to DATABASE_URL (reads .env locally)
pnpm db:generate   # after editing schema.ts: write a new migration, then review the SQL
```

Tables: `task_progress`, `checklist_checks`, `attendance`, `weekly_reflections`,
`project_reviews`. Missed sessions are never stored; they're scheduled slots with no
`attendance` row.

## Adding a project

1. Build the workbook with the same sheets and column headers as
   `docs/projects/Cpp_Developer_Plan.xlsx`: Start Here, Roadmap, Plan, Concepts,
   Weekly Reflection, Project Review, Resources. Columns are matched by the first
   line of the header, so wording after that can differ.
2. `pnpm import-project docs/projects/<File>.xlsx <slug> "<Title>"`
   The script refuses to write anything if a sheet or column is missing, a task
   names a concept that isn't in the Concepts sheet, or ids repeat.
3. Import the JSON in `src/lib/tracker/projects.ts` and add it to `projects`.
4. Deploy.

The tracker opens the first project in `projects` by default. There's no project
picker yet; the other projects are reachable at `/tracker/<slug>`.

**How the workbook maps to the app**

- Roadmap row → milestone (one per week).
- Plan row → task. Its "What to do" lines become the sub-task checklist:
  - numbered lines are steps;
  - text before the first number is shown as intro;
  - `⭐ Stretch:` lines are optional steps.
- "Done when" lines → a second checklist.
- "Concepts today" → links to Concepts rows. `🆕` marks where a concept is introduced.
- Start Here → the Guide page. Its "Templates" section becomes the one-tap note
  templates.
- The Progress sheet is not imported; the app works it out from saved progress.

## Things to know before editing

- **Re-importing a changed workbook:** ticks are saved by position (`s12.do.0` is
  task 12's first step). If you insert or reorder steps in an existing task, saved
  ticks move to whatever now sits at that position. Adding new tasks at the end is safe.
- **Changing the schedule:** check-ins are matched to slots by start time. If you
  change a slot's day or time in `SLOTS`, past check-ins for the old time stop
  matching and those weeks show the slots as missed. Only change the schedule going
  forward, and expect the history to look off.
- **`TRACKER_START_DATE`** (currently 2026-09-27): slots before it never count as
  missed.
- **Check-in rules:** check-in opens 10 minutes before a slot and closes at its end.
  More than 10 minutes after the start counts as late. The server's clock decides.
  Make-ups are allowed outside open slots, at most one per Pacific day.
