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

## 3. Writing it

```bash
python3 tools/plan.py skeleton --athlete <slug> --start <monday> [--weeks N]
```

Then fill **week by week** (edit the JSON for one or two weeks at a time and re-validate). For each
week: `phase`, `focus` (one sentence the athlete understands), `deload`, and `days[].workouts`.
Each run workout follows [instrumentation.md](instrumentation.md): detail in the athlete's language,
guardrail numbers inside the text, watch block last. Strength goes on rest days or right after an
easy run, never before quality.

`plan.notes` holds the whys the athlete will reread: why walk breaks, why the easy cap, how the
tracked issue is read, what the checkpoints are.

## 4. Close

```bash
python3 tools/plan.py derive --athlete <slug>      # sessions, plannedKm, hours
python3 tools/check-min.py --athlete <slug>        # min vs watch blocks
python3 tools/validate.py --athlete <slug>
python3 tools/gen-ics.py --athlete <slug>
```

Walk the athlete through the first two weeks before they start, and get an explicit OK: from then on
the plan is theirs and only changes with their approval.

## Checks before handing it over

- No week grows running volume more than `weeklyVolumeIncreasePct` over the previous non-deload week
  (the first weeks of a walk/run base can jump in minutes of running while total time stays flat —
  say so in the notes when they do).
- No back-to-back run days, quality and long spaced.
- Every run's detail has a guardrail number and a watch block.
- The race (if any) is a workout with `type: "race"` on `goal.date`.
