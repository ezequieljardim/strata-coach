---
description: Load today's training session and give the feedback
argument-hint: "[athlete-slug]"
---

Load today's session into the dashboard and give the athlete their feedback.

**Athlete:** `$ARGUMENTS`. If empty and `athletes/` has exactly one folder, it's that one. If there
are several, **ask whose session it is before touching anything** — writing one person's run into
another's file is the easiest mistake in this repo. From here on `<slug>` is that athlete and
`A = athletes/<slug>/`.

Use the `training` skill for every judgment call. Before anything: `git pull`, then read `A/config.json`, `A/HANDOFF.md`, and the active cycle
`C = A/cycles/<config.activeCycle>/` (`cycle.json` for the goal, `plan.json` for the prescription). If `A/CLAUDE.md`
exists, its rules apply on top of the repo's.

Speak to the athlete in `config.locale.lang` with `config.locale.tone`. Everything written into
the JSON (notes, feedback) is in that language too.

## Steps

1. **Objective data.** If `config.ingest.mode` is `"hae"`, run
   `./tools/hae/sync-local.sh --athlete <slug>`. If it fails, read the error first; the usual
   failure modes are in `tools/hae/README.md`. With `"manual"`, ask for distance, duration, avg
   and max HR, cadence if they have it.
2. Find today's entry in `A/sessions.json` (manual entries: set `cycle` and `week` from the plan week
   that contains the date, both `null` if none). With `"pendingReport": true` the objective data is
   already there.
3. **Ask for what no sensor measures**, before writing anything:
   - one question per `config.tracked[]` issue, built from its `fields[].prompt` (skip the whole
     group with a single "did X show up?" when it didn't);
   - perceived effort (RPE 1-10);
   - shoes (`config.gear.shoes`) — only if `gear.trackShoes` isn't `false` — and surface.
4. Fill the entry and **delete `pendingReport`**. The long analysis goes in `notes` — that's where
   every detail belongs: it is the record for the doctor and for the athlete a month from now.
5. Give the feedback **with the template below**. The full analysis stays in `notes`.
6. **Save the feedback in the session's `feedback` field**, same structure as the template:
   `title`, `light` (`ok` | `warn` | `stop`), `verdict`, `table[]` (`what`, `plan`, `actual`,
   `ok`), `matters[]`, `whereYouAre[]`, `next` (`level`: `good` | `tight` | `bad`, `action`,
   `why`). **`matters` and `whereYouAre` are arrays of strings, one per bullet or paragraph** — a
   bare string blanks the whole dashboard (it happened on 09, 11 and 14/09/2026). §4 is not
   saved: the plan already shows the next session on its own day.
7. Verify with `python3 tools/validate.py --athlete <slug> && npx tsc --noEmit && npm run build`, commit only `athletes/<slug>` and **push**.
   Vercel republishes.

**Never write `tracked.<id>.present: false` because nobody reported anything.** Ask.

---

## Feedback template

Four sections, in this order. Nothing else. What doesn't fit goes to `notes`. Headings and labels
in the athlete's language.

```
## <date> — <session name> · Week <n>, session <n> of <total>

### 1 · Today's run
**<✅ | ⚠️ | 🛑> <one-line verdict>**

| | Prescribed | Actual | |
|---|---|---|---|
| Work | <from the plan> | <actual> | <✅/⚠️> |
| HR peak | ≤<rules.easyDayHrCap> on easy days | <peak> | <✅/⚠️> |
| Cadence | <config.cadence.target> | <actual> | <✅/⚠️> |
| <one row per tracked issue> | — | <key metric / "none"> | <✅/⚠️> |
| Recovery | — | sleep <h> · rHR <n> · HRV <n> | <✅/⚠️> |

### 2 · What matters
- <three bullets at most, each with its why in the same sentence>

### 3 · Where you stand
<Two or three short paragraphs of prose, talking to them. The coach's read on where they are in
the process: what is being built right now, what changed since last week, what we don't know yet.
Numbers only as evidence for a sentence, never as a list.>

**<On track | Tight | Off track>:** <progress | repeat the week | stop> — <why, one line>

### 4 · Next: <date>, <weekday> — <name>
**Total time: ~<min> min** <(<n> running + <n> strength) if the date has more than one workout>
<the plan's `detail` block, verbatim, without the WATCH WORKOUT section>

**Focus of the day:** <the one thing to pay attention to>
**Adjustment:** <none | what changes and why>
```

Template rules:

- **Three bullets at most in §2.** If there are four important things, the fourth wasn't.
- **No raw number series in the reply.** "Peaks per block 144/143/146/154/149/154" is said as
  "peaks between 143 and 154, no drift". The full series goes in `notes`.
- A number only appears if it changes a decision. Otherwise it's context, and goes in `notes`.
- The light is for the whole session: 🛑 if a stop rule fired (repo `CLAUDE.md`, athlete
  `CLAUDE.md`, `config.rules`, the `training` skill), ⚠️ for a minor miss or something to watch, ✅ if it went as written.
- **§3 is the only part that looks beyond the day, and it's prose.** It's the coaching part: what
  is being built, whether the body is responding, what is still unknown. Write it as if said while
  walking, not read from a spreadsheet.
  - **No "X of Y km" and no trend lists.** If volume matters, "a bit over half the week done";
    the exact number is on the dashboard.
  - **At most one number per paragraph**, and only the one that supports the claim.
  - Compare against the previous session **of the same format**, not the previous one on the
    calendar: a long run against a quality session says nothing.
  - **Always say what we don't know yet.** Where a symptom's threshold is, whether cadence holds
    with volume, whether fitness is real or a good day. It's what prevents false confidence.
  - With tracked issues, the verdict follows their `trafficLight`: if the symptom shows up
    earlier than last week, **the week is repeated**. Enthusiasm doesn't negotiate that.
  - Never a diagnosis. A tracked issue's `redFlags` mean: stop and see a doctor — say so plainly.
- **Total time goes first in §4**, before the detail: the sum of `min` of every workout on that
  date, not just the run. People underestimate how long sessions take and end up rushing.
- **§4 is verbatim from `C/plan.json`**, not rewritten or summarized: it's what they have to do.
  Drop the watch block (already loaded on the watch) unless the session is a new format.
- The recovery row uses `context.json`. HRV averaged from fewer than 6 readings is shown as "—".
  In a morning export `restingHr`, `hrv` and `steps` are `null`.
- If they want today's long analysis, they'll ask. Not by default.
