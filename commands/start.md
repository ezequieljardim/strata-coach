---
description: Set up a Strata repo, or add a new athlete to one — interview, plan, dashboard
argument-hint: "[athlete name]"
---

Set up coaching for a new athlete, using the `training` skill throughout. Two situations:

- **No repo yet** (the current folder has no `athletes/` and no `package.json`): create it from the
  scaffold, then add the first athlete.
- **Existing repo**: add one more athlete. Never touch other athletes' folders.

Talk to the user in the language they are writing in. The athlete may not be the user (someone
setting up a plan for their partner): confirm who's who and ask for anything only the athlete knows.

## 1. Scaffold (only when there's no repo)

Confirm the target folder with the user, then:

```bash
cp -R "${CLAUDE_PLUGIN_ROOT}/assets/scaffold/." .
git init
npm install
```

Check that `git config user.email` is the email of the GitHub account they'll deploy with (see
`${CLAUDE_PLUGIN_ROOT}/skills/training/reference/deploy.md`).

## 2. Interview — a wizard, one question at a time

**How to ask:**
- **One question at a time with the question tool, as described in "Asking the athlete" in the
  `training` skill**: suggested answers as options, the free-text field for anything else. No
  forms, no tables, no numbered list of questions.
- **Never show the list of topics below.** It's your script, not something to read out.
- Each step below is a **topic**, and most topics take several single questions: ask them one by
  one. Put a short marker of the topic in the question's header or first words, e.g.
  `Paso 3 de 8 · Dónde estás hoy`. When a question needs context (why it matters, what the choices mean), one or
  two sentences before it.
- **React to the answer before moving on**: confirm what you understood in a few words, and ask a
  follow-up only if the answer was ambiguous or opens something important (a pain, a constraint).
  Follow-ups don't advance the counter.
- If they don't know or don't want to answer, say what that means for the plan, note it, and go to
  the next step. **Never fill an answer in yourself.** If the person answering isn't the athlete,
  keep going with what they know and list the rest as open items for the athlete.
- Put the sensible default first among the options ("3 days — the usual start"), and let the
  free-text field cover the rest.
- Write nothing to disk until the step that needs it is answered.

**Steps** (in this order; skip questions an earlier answer already covered):

1. **Who**: name, a short slug for the URL (`ana`), and time zone. **Language: infer it from the
   language the user is writing in** and confirm in one line instead of asking; ask only if the
   athlete is someone else who may read in another language. Store it as a BCP 47 tag in
   `locale.lang` (`es-AR`, `en-US`, `pt-BR`…) plus a `tone` when it matters (e.g. voseo).
   The dashboard's labels exist in Spanish and English; any other language shows them in English
   — say so when that's the case. Plan texts, notes, HANDOFF and feedback are still written in the
   athlete's language.
2. **Goal**: a race (name, date, place, time), reaching a distance (with or without a date), or a
   habit (runs per week, sustainably). Target and, if they want, a stretch goal.
3. **Where they are today**: current running (longest continuous run in the last 4 weeks, runs per
   week), how long since they last trained regularly, past races or best efforts. **Age, height and
   weight** (weight only if they want to share it): impact load per stride scales with body mass,
   and height with weight gives a first read on it, so they shape how gradual the base is.
4. **Body**: current or recurring pain, injuries, what stopped previous attempts, anything a doctor
   told them. If something recurs → design a tracked issue with them
   (`${CLAUDE_PLUGIN_ROOT}/skills/training/reference/tracked-issues.md`). If nothing → `tracked: []`. Don't invent one.
5. **Schedule** — availability and preference are different questions, ask both:
   - **Available**: every day they *could* run, and how much time fits on each (e.g. weekdays
     45 min before work, Saturday up to 2 h). Fixed constraints: shifts, kids, travel.
   - **Preferred**: of those, which days they'd rather run, and whether they have a favourite day
     for the long run (usually the day with the most time) and for quality.
   Then choose the run days: preferred ones first, adjusted so the rules hold (no back-to-back runs,
   `hoursBetweenQualityAndLong` between quality and long) and the long run lands where there's time.
   If preferences break a rule (e.g. Saturday and Sunday), say why and propose the closest option.
   The other available days are the fallback when a session has to move.
   - **Other training**: gym, strength apps, football, cycling, classes — which days and how hard.
     It counts as load: never on the day before quality or long, and not the same day as a run
     unless it's light. Record it in `schedule.otherTraining`.
6. **How runs will be measured** — first ask: **iPhone or Android?**
   - **Android**: say plainly that automatic import from Android (Health Connect) **isn't supported
     yet** — it's on the roadmap — and that for now runs are loaded by hand: after each run they
     tell `/strata:session` the numbers their watch or app shows. Set `ingest.mode: "manual"`,
     `ingest.platform: "android"`, skip the Health Auto Export option below, and continue with the
     device questions (the watch still decides HR caps and pace ranges).
   - **iPhone**: continue as below (`ingest.platform: "ios"`).

   Then ask what they have, and say what that enables:
   - **Device**: sports watch (which one, with wrist HR?), phone with GPS app (Strava, Nike Run
     Club, Garmin Connect, Apple Fitness…), just a stopwatch, nothing.
   - **What it enables**, and ask which to turn on:
     - HR → an easy-day cap (`rules.easyDayHrCap`) on the watch and in the feedback; without HR,
       easy is controlled by the talk test and RPE.
     - GPS distance and pace → pace ranges in the plan; without it, everything by time.
     - Cadence → only if it will be trained.
     - iPhone + Apple Watch + Mac (iOS only) → automatic import with Health Auto Export (say requirements and
       cost first, `${CLAUDE_PLUGIN_ROOT}/skills/training/reference/ingest.md`); otherwise manual: after each run they tell `/strata:session`
       the numbers their app shows.
   - Record the answer in `ingest` (`mode` plus `source`, e.g. "Garmin Forerunner 55 + Connect").
7. **Gear and places**:
   - **Shoes**: do they want to log which pair they use each run? Worth it when they rotate pairs
     or a pain might relate to shoes; skip it otherwise (`gear.trackShoes: false`, and
     `/strata:session` won't ask). If yes, which pairs and roughly how many km they have.
   - **Surfaces** available (grass, dirt, track, only asphalt) — they shape where each session goes.
8. **Life load**: typical sleep, work stress, diet changes in progress.

**After the last step**, give a short plain-text summary of what you understood (a few lines,
not a table) and ask for one confirmation or correction before writing anything.

If the goal isn't realistic for the time available (e.g. a half marathon in 8 weeks from not
running), say it now, with the why, and offer the realistic version. The decision is theirs.

## 3. Write the athlete

`A = athletes/<slug>/`.

1. `A/config.json` per `${CLAUDE_PLUGIN_ROOT}/skills/training/reference/data-model.md`: `schemaVersion: 2`, `activeCycle` (the id below),
   `schedule.days`, `rules` (drop `easyDayHrCap` if there's no HR), zones only if you can estimate
   them honestly (mark them provisional in `zones.note`), cadence only if it'll be trained, gear,
   tracked, locale, ingest, `calendar.uidPrefix` = slug.
2. `A/sessions.json` → `{"sessions": []}`; `A/context.json` → `{"sleepTarget": 7, "days": []}`.
3. **The first cycle and its plan**: follow "Creating a cycle" in `${CLAUDE_PLUGIN_ROOT}/skills/training/reference/plan-building.md` (cycle id,
   `cycle.json`, skeleton, shape approved first, weeks filled a few at a time, closing checks).
5. `A/HANDOFF.md`, in the athlete's language: who they are, goal and why this target, where they
   start, the body (tracked issues, hypotheses as questions for a doctor, red flags), the plan's
   shape and its rules, how their data comes in, current state ("week 0"), open items, decisions
   taken with their reasons. It must let a fresh agent coach them without this conversation.
6. If the athlete needs rules beyond the repo's (a stricter cap, something they must never do),
   `A/CLAUDE.md` in English.

## 4. See it

```bash
npm run dev
```

Open `http://localhost:5173/<slug>` (use the preview tools if available), check every tab renders,
the calendar shows their days, and there's no tracked tab when `tracked` is empty. Walk the athlete
through the first two weeks and **get an explicit OK on the plan**: from here on it only changes
with their approval.

## 5. Publish — ask, then walk through it

Once the plan is approved and the dashboard runs locally, ask **one question**, wizard style:
do they want the dashboard online (to open it from their phone)? Explain in one sentence what it
takes: a private GitHub repo they own, a free Vercel account, and a password. If no, skip to the
closing message; they can ask for it later. If yes, go step by step, one step per message, waiting
for each to be done:

**Adding an athlete to a repo that's already published**: skip all of this — committing and pushing
redeploys. Remind them everyone with the site password sees every athlete.

1. **Git identity.** `git config user.email` must be an email of the GitHub account they'll use;
   if it isn't (a work email is the classic), set it locally in the repo after they confirm.
2. **Private repo they own.** Confirm the repo name and the GitHub account (`gh auth status`; with
   several accounts, the active one must be theirs), then
   `gh repo create <name> --private --source . --push`. Never public: it holds health data. Vercel
   only connects a personal-account repo to its **owner**, so it can't live in someone else's
   account. Several people in one household can share one repo; unrelated people each get their own.
   Without `gh`, give them the steps to create it on github.com and the `git remote add` + `git push`.
3. **Vercel project.** They do this in their browser: vercel.com → Add New → Project → pick the repo;
   nothing to configure (`vercel.json` sets it). Wait for them to say it's imported, and ask for the
   production URL.
4. **Password — before sharing anything.** They add `SITE_PASSWORD` (and optionally `SITE_USER`,
   default `coach`) in Project → Settings → Environment Variables, for Production and Preview, then
   redeploy. **Don't ask for the password and don't type it**: it's theirs. If they prefer the CLI,
   give them `vercel env add SITE_PASSWORD production` to run in their own terminal.
5. **Verify it's locked.** Run `curl -s -o /dev/null -w '%{http_code}\n' https://<url>/` — it must be
   `401`. If it's `200`, the password isn't set or the redeploy didn't happen: say so plainly and
   don't move on. Then have them open the URL on their phone, log in once, and add it to the home
   screen.
6. From now on `/strata:session` pushes after each run and the site updates by itself.

Details and traps: `${CLAUDE_PLUGIN_ROOT}/skills/training/reference/deploy.md`.

Commit with only the new athlete's folder (plus the scaffold on a first setup). Tell them the next
steps: `/strata:session <slug>` after each run, `/strata:weekly <slug>` at the end of
each week, and `tools/export.sh --athlete <slug>` for backups.
