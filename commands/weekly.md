---
description: Weekly review of an athlete's training — progress or repeat next week
argument-hint: "[athlete-slug]"
---

Close the week for one athlete, using the `training` skill.

**Athlete:** `$ARGUMENTS`. One folder in `athletes/` → that one; several and no slug → ask.
`A = athletes/<slug>/`. `git pull` first. Talk in `config.locale.lang`.

1. Read `A/HANDOFF.md`, `A/config.json`, and the week just finished plus the next one in
   `A/plan.json`.
2. Planned vs actual: running km and minutes, sessions done, walks.
3. Easy-day execution: per-block HR peaks across sessions **of the same format**, drift, how many
   easy sessions went over `rules.easyDayHrCap`.
4. Cadence against stride, if there's data.
5. Each `config.tracked[]` issue: key metric this week vs last, applying its `trafficLight`.
6. Recovery: sleep average and nights under `context.sleepTarget`, resting HR and HRV trend.
   Ignore partial days.
7. Next week's volume jump against `rules.weeklyVolumeIncreasePct`.
8. **Verdict: progress, repeat the week, or stop.** One line with the why. If it's repeat or stop,
   propose the exact change to `plan.json` and **wait for the athlete's OK** before writing it
   (`docs/runbooks.md` §3 for moving sessions).
9. Update `A/HANDOFF.md` "current state" and open items, and commit only `athletes/<slug>`.
10. Suggest `tools/export.sh --athlete <slug>` to keep an off-repo backup of the week.

Be direct about misses. Don't soften a repeated week: explain that it costs days, and an injury
costs the goal.
