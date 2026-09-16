---
description: See, adjust or replace an athlete's goal — update keeps the plan's cycle, new closes it and starts another
argument-hint: "[update | new] [athlete-slug]"
---

Work on an athlete's goal, using the `training` skill. Talk in the user's language.

**Arguments:** `$ARGUMENTS` may hold a mode (`update` or `new`) and a slug, in any order. One
folder in `athletes/` → that athlete; several and no slug → ask. `A = athletes/<slug>/`,
`C = A/cycles/<config.activeCycle>/`.

Before anything: `git pull`. If `A/config.json` has no `schemaVersion` 2, stop and point to
`/strata:upgrade`. Read `A/config.json`, `A/HANDOFF.md`, `C/cycle.json`, `C/plan.json`, and the
cycle's sessions (`cycle` = its id).

---

## No mode: where the goal stands

Read-only. The goal and target, time left, week of the plan, and progress against its checkpoints
(tests written in the plan notes, recent sessions of the key formats). End with one line each:
`/strata:goal update` to adjust it, `/strata:goal new` to close this cycle and set another.

## `update`: same cycle, something changes

For adjustments that keep the plan's structure: a different target time after a test, the race
moved a week or two, another race of the same distance on a similar date, "finish it" instead of a
time.

1. Ask what changes and why. If it isn't an adjustment — another distance, a date months away, a
   different kind of goal — say so, and offer `new` instead.
2. Update `C/cycle.json → goal`.
3. If the plan is affected (dates, race-pace work, taper), **propose the change to the weeks that
   haven't happened yet** — never to past weeks or done sessions — and **wait for the athlete's
   explicit OK** before writing it. A date shift that crosses week boundaries re-dates the remaining
   weeks: run `python3 tools/plan.py derive --athlete <slug>` afterwards and re-tag the `cycle`/`week`
   of any affected session.
4. Record the decision and its reason in `A/HANDOFF.md` ("decisions taken").
5. Close: `tools/check-min.py`, `tools/validate.py`, `tools/gen-ics.py` (all `--athlete <slug>`),
   commit only `athletes/<slug>`.

## `new`: close this cycle and start another

1. **Close the current cycle.**
   - How did it end? `completed` (with the result: race time or what was achieved) or `abandoned`
     (with the reason: injury, life, changed plans — say plainly that this is useful history, not
     a failure record).
   - Write `C/retro.md` with the athlete, in their language: the goal and the result; what worked;
     what didn't; what was learned about each tracked issue (and whether it's still live); zones
     and tests at the end; what to keep and change next time. Short and concrete.
   - Set `C/cycle.json`: `status`, `result: { time?, summary }`. Don't touch its plan or sessions.
2. **Transition.** After a race, propose recovery before week 1 (1-2 weeks, more after a marathon)
   and say why. Runs in that gap are logged with `cycle: null`. After an abandoned cycle for
   injury, the next goal waits for the athlete to be cleared, and the first weeks are a return
   phase.
3. **The new goal.** Run the wizard of `/strata:start` (same rules: one question at a time with the question tool,
   no topic list shown) for steps 2, 4, 5 and 8 (goal, body, schedule, life load) — but **start from the history**, not from zero: current level from the last
   weeks of sessions, zones from the tests, tracked issues from the retro. Only ask what the data
   can't answer. If the goal isn't realistic for the time available, say it with the why.
4. **Create the cycle** following "Creating a cycle" and "A plan that follows another" in
   `${CLAUDE_PLUGIN_ROOT}/skills/training/reference/plan-building.md`: new id, `cycle.json`,
   `config.activeCycle`, skeleton, shape approved first, weeks filled, closing checks. Update
   `A/config.json` where the athlete changed (zones, rules, gear, tracked issues).
5. **HANDOFF.** Move the finished cycle to a "Previous cycles" section (goal, result, link to its
   `retro.md`) and rewrite "current state" for the new one.
6. Commit only `athletes/<slug>`. The old cycle stays browsable at `/<slug>/<old-id>`; the
   dashboard's History tab shows both.
