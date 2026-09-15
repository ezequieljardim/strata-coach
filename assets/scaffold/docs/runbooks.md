# Runbooks — recurring tasks

Procedures for what gets done often. `<slug>` is the athlete; `A = athletes/<slug>/`. With more
than one athlete, **always confirm whose it is first**.

---

## 1. Load today's session

The most frequent task, and what `/session <slug>` does. Objective data comes from the ingest
adapter (`tools/hae/` or by hand); what's always missing is the **subjective report**.

1. `./tools/hae/sync-local.sh --athlete <slug>` when `config.ingest.mode` is `hae`. It fetches,
   parses, verifies the build and pushes the objective data.
2. Find the day's entry in `A/sessions.json`. With `"pendingReport": true` the objective data is
   there and the report is missing.
3. **Ask the athlete** what no sensor measures: each `config.tracked[]` issue (from its
   `fields[].prompt`), RPE 1-10, shoes and surface.
4. Fill the entry and **delete `pendingReport`**. While the flag is there the sync may regenerate
   the entry; once removed, it's never touched.
5. **Give the feedback** with the template of the `session` command, and save it in
   `feedback`. The full analysis goes in `notes`.
6. Verify (§5), commit `athletes/<slug>` and push.

**Never write `tracked.<id>.present: false` because nobody reported anything.** With the flag on,
`false` means "not reported".

---

## 2. Weekly review

1. Planned vs actual running km and minutes, per week.
2. The **per-block HR peak series** across sessions of the same format: the best fitness signal
   until a test gives zones.
3. **Cadence against stride**: cadence up with stride down is a cadence intervention working; both
   up is just running faster.
4. Each tracked issue's **traffic light**: if the symptom shows up earlier than the previous week,
   **repeat the week**, don't progress.
5. Check next week's volume jump against `config.rules.weeklyVolumeIncreasePct`.
6. Suggest `tools/export.sh --athlete <slug>` to close the week with a backup.

---

## 3. Move a session to another day

The active cycle's `plan.json` is rewritten. **Only with the athlete's approval** (the plan is theirs).

1. Pick the new day from `config.schedule.available` (and the minutes that fit there) before
   anything else. Move the day's `workouts` to the real day inside `weeks[].days`. Append
   `(moved from <original day>)` to `name` and the why to `desc`.
2. Leave the original day with no run workout (rest).
3. **If it crosses a week boundary**, set `week` in `sessions.json` by **where the day falls**,
   not by the original plan.
4. `python3 tools/plan.py derive --athlete <slug>` (sessions, km and hours follow the workouts),
   `python3 tools/check-min.py --athlete <slug>`, and regenerate the calendar (§4).

**Check what else changed.** Athletes ask to move a day and, in passing, change watch targets or
shoes — they don't perceive instrumentation as training changes. Never two run days in a row
(`rules.noBackToBackRunDays`), and `rules.hoursBetweenQualityAndLong` between quality and long.

---

## 4. Regenerate the calendar

```bash
python3 tools/gen-ics.py --athlete <slug>
```

Writes `config.calendar.file` (default `athletes/<slug>/calendar.ics`). **UIDs are stable**
(`<uidPrefix>-NNN-YYYY-MM-DD@claudecoach`, numbered by date over `sport: "run"` workouts), so
re-importing **updates** events instead of duplicating them. Never change `uidPrefix` of an
athlete who already subscribed.

---

## 5. Verify before calling anything done

```bash
python3 tools/validate.py --athlete <slug>
npx tsc --noEmit && npm run build
grep -c SITE_PASSWORD dist/assets/*.js        # must be 0
python3 tools/check-min.py --athlete <slug>   # only if a plan changed
```

Running locally, Claude Code can use git normally. The mounted-folder trap in `CLAUDE.md` applies
to agents arriving through a folder bridge (Cowork), not here.

---

## 6. The sync failed

`/session` runs it and shows the error.

1. Read the output. The usual modes are in `tools/hae/README.md`.
2. Force the source: `HAE_DIR='/path/to/folder' tools/hae/sync-local.sh --athlete <slug>`.
