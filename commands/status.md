---
description: Where an athlete stands against their plan
argument-hint: "[athlete-slug]"
---

Tell the athlete how they're doing, using the `training` skill. Read-only: nothing is loaded or written.

**Athlete:** `$ARGUMENTS`. If empty and there is exactly one folder in `athletes/`, it's that one;
with several, ask. `A = athletes/<slug>/`. Answer in `config.locale.lang`.

1. Read `A/HANDOFF.md` (current state and open items), `A/config.json`, and the active cycle
   `C = A/cycles/<config.activeCycle>/` (`cycle.json`).
2. From `A/sessions.json` (entries with `cycle` = the active one) and `C/plan.json`:
   - which session is next and what it prescribes **verbatim**;
   - running km and minutes this week, planned against actual;
   - the per-block HR peak series of the last sessions of the same format;
   - cadence against stride in the last sessions, if there is data.
3. From `A/context.json`: last nights' sleep, resting HR and HRV. Ignore `steps` on partial days.
4. For each `config.tracked[]` issue, apply its `trafficLight` and say whether to progress or
   repeat the week.
5. Close with what the athlete still has to report and the open items that are theirs.

Be direct about misses. The real risk is not that they won't train: it's that they'll train too much.
