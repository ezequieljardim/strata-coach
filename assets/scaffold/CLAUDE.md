# my-running-plan

Training dashboards **and full coaching context** for one or more runners. Vite + React +
TypeScript + Recharts, static, no backend. Deployed on Vercel.

One folder per athlete under `athletes/<slug>/`; the dashboard lives at `/<slug>`. One password
for the whole site: it's meant for a family or friends who can see each other's data.

## Start here — if you arrive without context

**This repo is the project's only source of truth.**

1. **`git pull`** first, almost always: the remote may have commits the clone doesn't.
2. **Whose?** Every task is about one athlete. With a single folder in `athletes/`, that's it.
   With several and no name given, **ask** — never guess.
3. Read **`athletes/<slug>/HANDOFF.md`** entirely: who they are, the goal, the plan's structure,
   current state, open items and decisions already made so they aren't re-litigated.
   `athletes/<slug>/CLAUDE.md`, when present, adds that athlete's own non-negotiable rules.
4. Frequent tasks — loading a session, the weekly review, moving a session, regenerating the
   calendar — are in **[`docs/runbooks.md`](docs/runbooks.md)**.

Commands (from the `strata` plugin, or `.claude/commands/` when present): **`/session [slug]`**
loads today's session and gives the feedback, **`/weekly [slug]`** closes the week, **`/status [slug]`**
says how they're doing against the plan without writing anything, **`/start`** adds an athlete.

---

## Rules that are not negotiated

They exist so nobody gets injured. They apply **even when the athlete asks otherwise** — and
motivated athletes ask otherwise often. Per-athlete numbers live in `config.json → rules`.

1. **Never two run days in a row** (`noBackToBackRunDays`). Bone needs ~48 h to respond to load.
   If they want to run the next day, the answer is a walk.
2. **`hoursBetweenQualityAndLong` between the quality session and the long run.**
3. **Easy days are easy.** The HR peak stays under `easyDayHrCap`.
4. **If a tracked symptom shows up earlier than last week, the week is repeated.** No progression.
5. **Volume progression capped at `weeklyVolumeIncreasePct`** per week, and no single session grows
   more than planned.
6. **An athlete's `plan.json` is never changed without that athlete's explicit approval.** If
   something looks wrong, report it; don't fix it.
7. **Never mix athletes.** Zones, caps, rules and conclusions of one never apply to another.

**The real risk is not that they won't train: it's that they'll train too much. The role here is
to brake, not to push.**

## About symptoms (`config.tracked`)

Claude is not a doctor and the athlete knows it. Everything is framed as **a hypothesis for the
doctor**, never a diagnosis. A tracked issue's `redFlags` mean stop and see a professional.

## How to work

- **Talk to each athlete in `config.locale.lang`** and tone. Code, keys, file names and these rules
  are in English; what the athlete reads (feedback, notes, HANDOFF, dashboard labels) is in theirs.
- **Explain the why**, not just the instruction.
- **Verify plan limits, prices and capabilities BEFORE recommending.** It already cost an
  unnecessary subscription and a site with health data exposed.
- **When asked to move or change something, also check what else changed.** Athletes don't
  mention instrumentation changes because they don't perceive them as training changes.

---

## Data

Everything per athlete in `athletes/<slug>/`. No backend: edit the JSON, commit, Vercel republishes.

- **`sessions.json`** — touched often. One entry per activity. Recovery walks are
  `"type": "walk"` and stay out of running volume and the cadence/HR charts.
  `feedback.matters` and `feedback.whereYouAre` are **arrays of strings**: a bare string blanks the
  whole app.
- `context.json` — sleep, weight, resting HR, HRV, steps.
- `plan.json` — the weeks. **Only changes when the training plan changes** (rule 6).
- `config.json` — goal, schedule, rules, zones, gear, tracked issues, locale, ingest, calendar.
  The dashboard reads everything athlete-specific from here; `src/` knows no athlete.

If an entry has `"pendingReport": true`, its objective data is good but
`tracked.<id>.present: false` means **"not reported"**, not "didn't happen".

### When a health export arrives

1. **Read and analyze it** against the prescription: execution vs plan, whether easy days were
   easy, recovery context (sleep, HRV, resting HR). Explain the why.
2. **Load it**: an entry in `sessions.json` with `done: true` (recovery walks with `"type": "walk"`), and the day in
   `context.json`.
3. **A morning export has incomplete aggregates**: `steps`, `restingHr` and `hrv` go `null`. When a
   multi-day export arrives, **re-check and correct days already loaded**.
4. **Verify** (below).

## Sync

`./tools/hae/sync-local.sh --athlete <slug>` fetches Health Auto Export files, updates that
athlete's folder, verifies the build and pushes. See `tools/hae/README.md`. There is no scheduled
job: `/session` is the only trigger. `HAE_DAYS` (5) sets how far back it looks.

## Known traps

**Git and email.** The global git config may point to a work email and Vercel rejects deploys
whose author doesn't match the GitHub account. Check with `git config --show-origin --get user.email`.

**Don't run git from mounted environments — not even `git status`.** An agent on a mounted folder
can *create* files inside `.git` but not delete them, so any command touching the index leaves an
undeletable `.git/index.lock` that blocks every commit. `git status` refreshes the index too. To
inspect: `git --no-optional-locks <cmd>`, or `git log` / `git show`. If a lock stayed:
`rm -f .git/index.lock`. (Doesn't apply to Claude Code running locally.)

**Framework.** Vercel detected the project as Next.js when it was created. It's pinned in
`vercel.json`, which also rewrites every path to `index.html` so `/<slug>` works on refresh.

## Security — read before touching

Health data is **compiled into the JavaScript bundle**. Any client-side protection is useless:
the cut has to be at the edge.

On Vercel **Hobby, native protection does NOT cover the production domain** (Standard Protection
only covers previews; "All Deployments" needs Pro). So `middleware.ts` does basic auth against
**`SITE_PASSWORD`** (and `SITE_USER`, default `coach`).

After a valid login the middleware sets an `sfauth` cookie (1 year, HttpOnly) with a SHA-256 of
user+password. Changing `SITE_PASSWORD` invalidates every open session.

**Without that variable the middleware blocks nothing** — it fails open on purpose so a half-done
deploy doesn't lock the owner out. If the middleware is touched, check the site still asks for
credentials after deploying.

## Verify before calling anything done

```bash
python3 tools/validate.py                     # the data: tsc can't see it
npx tsc --noEmit && npm run build
grep -c SITE_PASSWORD dist/assets/*.js        # must be 0
python3 tools/check-min.py --athlete <slug>   # only if plan.json changed
python3 tools/plan.py derive --athlete <slug>  # after editing days[].workouts: rebuilds sessions/km/hours
```

`check-min.py` recomputes each session's duration from its watch workout block and compares it
with `min`, which is duplicated in three places (`days[].workouts[].min`,
`weeks[].sessions[].min`, `weeks[].hours`) and drifts on its own — `tools/plan.py derive` rewrites the last two from the workouts. Sessions with distance-based
segments can't be computed without assuming a pace: they are listed and not validated.

## Calendar

Each athlete's `.ics` is generated from their plan and regenerated whenever `plan.json` changes:

```bash
python3 tools/gen-ics.py --athlete <slug>
```

**UIDs are stable**, so re-importing updates events instead of duplicating them.

## Backups

`tools/export.sh [--athlete <slug>]` writes a tarball outside the repo (`~/Backups/running-plan`).
