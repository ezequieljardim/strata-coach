---
description: What Strata can do, and what to run next from where you are
argument-hint: "[command]"
---

Explain Strata to the user, in the language they're writing in. Short, scannable, no walls of text.

If `$ARGUMENTS` names a command (`start`, `session`, `weekly`, `status`, `goal`, `upgrade`, `help`), explain only that
one: what it does, when to use it, what it asks, what it writes, with one example. Otherwise:

## 1. Where they are

Look at the current folder, read-only:
- **No `athletes/` folder** → not a Strata repo yet. The next step is `/strata:start` in an empty
  folder (or here, if this is where they want the project).
- **`athletes/` with folders** → list each athlete (name from `config.json`, the active cycle's
  goal, current week of its plan) and, per athlete, the most useful next step: data without
  `config.schemaVersion` 2 or no `strata.json` at the repo root → `/strata:upgrade`; a session
  still marked `pendingReport` → `/strata:session <slug>`; a finished week without review →
  `/strata:weekly <slug>`; the plan's last week is over → `/strata:goal new <slug>`; nothing
  pending → `/strata:status <slug>`.

## 2. The commands

| Command | Use it |
|---|---|
| `/strata:start [name]` | Create a new project, or add an athlete to this one: interview, plan written week by week, dashboard |
| `/strata:session [slug]` | After every run: loads it (Health Auto Export or by hand), asks what no sensor measures, gives the feedback and saves it |
| `/strata:weekly [slug]` | End of the week: planned vs actual, easy days, symptoms, recovery → progress, repeat or stop |
| `/strata:status [slug]` | Anytime, read-only: where you stand and what's pending |
| `/strata:goal [update\|new] [slug]` | See the goal; adjust it within the same plan (`update`); or close this cycle and start a new goal (`new`), keeping all history |
| `/strata:upgrade` | After updating the plugin: brings the dashboard app in this repo up to date and migrates the data, with a backup and checks |
| `/strata:help [command]` | This |

With one athlete the slug can be omitted; with several, commands ask whose it is.

## 3. The dashboard and tools (one line each)

- `npm run dev` → `http://localhost:5173/<slug>`; deploy notes in `README.md` (set `SITE_PASSWORD`
  before publishing: it's health data).
- `python3 tools/validate.py` checks the data · `tools/export.sh --athlete <slug>` backs it up ·
  `tools/gen-ics.py --athlete <slug>` regenerates the calendar.

## 4. How it coaches (two lines)

It brakes more than it pushes: never two run days in a row, easy days really easy, and a symptom
that shows up earlier repeats the week. It never diagnoses; it keeps a clear record for a doctor.

Close with the single most useful next command for them right now.
