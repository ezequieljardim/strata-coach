# Running plan

Training dashboards for one or more runners: plan vs actual, calendar with the full prescription
of every day, per-session coach feedback, recovery context, and charts for any symptom being
followed. Each athlete lives at `/<slug>`.

Vite + React + TypeScript + Recharts. Static site, no backend. Light, dark or system theme, picked
next to the countdown and remembered per browser.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 → redirects to the only athlete, or shows a picker
```

## Deploy on Vercel

```bash
npm i -g vercel
vercel               # first time: creates the project
vercel --prod
```

Connecting the GitHub repo in Vercel redeploys on every push to `main`.

### Protect it (important)

It's health data on a public URL, **compiled into the JavaScript bundle**: any client-side
protection is useless, the cut has to be at the edge.

⚠️ On **Hobby, Vercel's native protection does NOT cover the production domain**. Standard
Protection only covers previews; "All Deployments" needs Pro.

So `middleware.ts` does **basic auth** against the **`SITE_PASSWORD`** environment variable (user:
`SITE_USER`, default `coach`). One password for the whole site and every athlete. Without the
variable the middleware blocks nothing — it fails open on purpose. After any middleware change,
check the site still asks for credentials.

---

## Data

One folder per athlete. No backend: edit the JSON, commit, Vercel republishes.

```
athletes/<slug>/
  config.json     goal, schedule, rules, zones, gear, tracked issues, locale, ingest, calendar
  plan.json       phases, notes and weeks → days → workouts
  sessions.json   what was done, with the coach's feedback
  context.json    sleep, weight, resting HR, HRV, steps
  HANDOFF.md      everything an agent needs to coach this athlete
```

Adding an athlete is adding a folder. The dashboard, the tools and the commands pick it up.

### `sessions.json`

```jsonc
{
  "date": "2026-08-14",
  "week": 1,
  "done": true,
  "type": "run",              // "run" | "walk" (walks stay out of running volume and charts)
  "km": 3.5,
  "minutes": 40,
  "avgHr": 128,
  "maxHr": 147,
  "cadence": 168,
  "shoes": "…",               // one of config.gear.shoes
  "surface": "…",
  "rpe": 3,
  "tracked": {                // one key per config.tracked[].id; absent when there are none
    "<id>": { "present": false /* + that issue's fields, null when absent */ }
  },
  "notes": "the full technical record",
  "feedback": { /* see .claude/commands/session.md */ }
}
```

### `config.json → tracked`

Zero or more issues to follow session by session (a recurring pain, numbness…). Each one gets a
dashboard tab with its key metric week over week, a log of its `fields`, and its traffic light:

```jsonc
{
  "id": "knee",
  "label": "Knee",
  "keyMetric": { "field": "onsetMin", "unit": "min", "label": "Shows up at", "goodDirection": "up" },
  "fields": [
    { "id": "onsetMin", "label": "Onset", "type": "number", "prompt": "At what minute?" },
    { "id": "severity", "label": "Severity", "type": "scale", "min": 0, "max": 10 }
  ],
  "trafficLight": { "green": "…", "yellow": "…", "red": "…" },
  "redFlags": ["…"]
}
```

### `plan.json → notes`

The whys the athlete rereads, shown in the Notes tab as short articles with an index. Plain text
with a light grammar, so an agent can write them without markup:

| Write | Renders as |
|---|---|
| an ALL-CAPS first sentence. | a highlighted headline |
| `LABEL: text` or `HYPOTHESIS 1 - text` | a subheading and its paragraph |
| `GREEN = meaning -> action` (one per line) | colored rows (green/yellow/red terms get colors) |
| indented lines | bullet points |
| `->` inside text | → |
| WORDS IN CAPS | **bold** |

Blank lines separate blocks. Anything else is a paragraph; no text is ever dropped.

### `context.json`

Seeded from Apple Health exports, one object per day. **In a morning export `steps` is partial** —
store `null` rather than a half day next to full days.

---

## Tools

| | |
|---|---|
| `tools/hae/sync-local.sh --athlete <slug>` | Health Auto Export → athlete folder, verify, push |
| `tools/gen-ics.py --athlete <slug>` | the athlete's calendar, with stable UIDs |
| `tools/check-min.py --athlete <slug>` | plan minutes vs the watch workout blocks |
| `tools/plan.py skeleton\|derive` | empty weeks for a new plan · rebuild sessions, km and hours from the workouts |
| `tools/validate.py [--athlete <slug>]` | the JSON against what the dashboard assumes |
| `tools/export.sh [--athlete <slug>]` | backup tarball outside the repo |

With a single athlete `--athlete` can be omitted.

## Structure

```
src/
  main.tsx        routing: /<slug>, picker, redirect
  App.tsx         header and tabs
  panels.tsx      progress, tracked issues, runs, context
  calendar.tsx    calendar, day detail, feedback, notes
  lib.ts          types, per-athlete data loading and calculations
  i18n.ts         every UI string, per language
  theme.ts        light/dark/system theme, remembered per browser; colors are CSS tokens
  ThemePicker.tsx the three-way theme switch
  styles.css
```
