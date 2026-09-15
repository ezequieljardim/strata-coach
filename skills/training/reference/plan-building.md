# Building a plan in this repo

General periodization theory is in [claude-coach/periodization.md](claude-coach/periodization.md).
This is how it lands in `plan.json`, and the choices that matter for amateur and returning runners.

## 1. What the interview must settle first

- **Goal type.** `race` (name + date), `distance` (reach X km running, with or without a date), or
  `habit` (run N times a week sustainably). The type decides the plan's end: race day, a milestone
  run, or a routine that keeps going.
- **Where they are today**, measured, not remembered: longest continuous run in the last month,
  runs per week, time since they last trained regularly, recent injuries. "I used to run 10K" three
  years ago is a walk/run start today.
- **History of pain or symptoms**, and what happened on previous attempts. This decides the base
  length and whether a `tracked` issue is needed.
- **Available days** and hard constraints (work shifts, kids, travel).
- **Data they have**: watch with HR? Health export? If there's no HR, easy is prescribed by talk
  test and RPE, and `easyDayHrCap` stays out of `rules`.
- **Sleep and life load.** Short sleep limits adaptation more than any workout choice.

## 2. Shape

| Phase | Typical length | Content |
|---|---|---|
| Base | 4-8 wk (longer after a break or injury) | walk/run → continuous easy running, strength/prehab |
| Build | 3-6 wk | one quality session a week, long run grows |
| Peak / specific | 2-3 wk | race-pace work, a control test |
| Taper | 1-2 wk | volume down, a little intensity kept |

- **Short calendar? Compress build, never base.** The base protects tissue; build can be shorter.
- **Deload every 3-4 weeks** (~20-30 % less volume), marked `deload: true`.
- **Tests on the calendar**: a field test (e.g. 2 km or 5 km time trial, or 30 min) once the athlete
  can run continuously, to set real zones. Before that, zones are provisional.
- **Goal checkpoints**: for an ambitious target, write the test week and the threshold in the plan
  notes. If missed, the goal changes once.
- **3 days a week** is a good default for returners: easy / quality / long, never consecutive.

## 3. Creating a cycle

Every goal is a cycle: `athletes/<slug>/cycles/<id>/` with `cycle.json` and `plan.json`. Both
`/strata:start` (first goal) and `/strata:goal new` (every later one) create it the same way:

1. **Id**: `<year>-<short name>` in lowercase with dashes, from the goal: `2027-media-bsas`,
   `2026-habito-3x`. It's the URL of that cycle (`/<slug>/<id>`), so short and readable.
2. **`cycle.json`**:
   ```json
   { "id": "2027-media-bsas", "status": "active", "from": "", "to": "",
     "goal": { "type": "race", "name": "…", "date": "2027-08-22", "time": "07:30", "place": "…",
               "distanceKm": 21.1, "target": "…", "stretch": "…" } }
   ```
   Set `config.activeCycle` to the id. Only one cycle is `active`.
3. **Skeleton**:
   ```bash
   python3 tools/plan.py skeleton --athlete <slug> --cycle <id> --start <monday> [--weeks N]
   ```
   It writes empty weeks and sets the cycle's `from`/`to`.
4. **Shape first**: propose phases, weeks, deloads, tests and where the long run peaks in a short
   table, and get an OK before writing workouts.
5. **Fill week by week** (one or two weeks per edit, re-validating): `phase`, `focus` (one sentence
   the athlete understands), `deload`, `days[].workouts`. Each run follows
   [instrumentation.md](instrumentation.md): detail in the athlete's language, guardrail numbers in
   the text, watch block last. Strength goes on rest days or right after an easy run, never before
   quality. `notes` holds the whys they'll reread.
6. **Close**:
   ```bash
   python3 tools/plan.py derive --athlete <slug>      # sessions, plannedKm, hours
   python3 tools/check-min.py --athlete <slug>        # min vs watch blocks
   python3 tools/validate.py --athlete <slug>
   python3 tools/gen-ics.py --athlete <slug>
   ```
7. Walk the athlete through the first two weeks and get an explicit OK: from then on the plan is
   theirs and only changes with their approval.

## 4. A plan that follows another

When a cycle starts after a previous one, the interview is shorter and the evidence better:
- **Where they are** comes from the last 4-6 weeks of `sessions.json` and `context.json`, not
  memory: longest continuous run, weekly volume actually sustained, per-block HR peaks.
- **Zones** come from the tests of the previous cycle, not tables.
- **Tracked issues** carry over with their history; the retro says whether they're still live.
- **After a race, recover first**: 1-2 weeks of easy running or rest before week 1 (more after a
  marathon). Runs in that gap are logged with `cycle: null`.
- Don't restart from zero: the new base can be shorter if the old one held, but volume still grows
  from what was **sustained**, not from the peak week.

## Checks before handing it over

- No week grows running volume more than `weeklyVolumeIncreasePct` over the previous non-deload week
  (the first weeks of a walk/run base can jump in minutes of running while total time stays flat —
  say so in the notes when they do).
- No back-to-back run days, quality and long spaced.
- Every run's detail has a guardrail number and a watch block.
- The race (if any) is a workout with `type: "race"` on `goal.date`.
