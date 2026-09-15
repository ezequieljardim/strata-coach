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
- **One question per message**, in plain conversational text, then stop and wait for the answer.
  No forms, no option pickers or question tools, no tables, no list of everything you'll ask.
- **Never show the list of topics below.** It's your script, not something to read out.
- Each step below is a **topic**, and most topics take several single questions: ask them one by
  one. Start each message with a short marker of the topic, e.g. `Paso 3 de 8 · Dónde estás hoy`,
  then the question. When a question needs context (why it matters, what the choices mean), one or
  two sentences before it.
- **React to the answer before moving on**: confirm what you understood in a few words, and ask a
  follow-up only if the answer was ambiguous or opens something important (a pain, a constraint).
  Follow-ups don't advance the counter.
- If they don't know or don't want to answer, say what that means for the plan, note it, and go to
  the next step. **Never fill an answer in yourself.** If the person answering isn't the athlete,
  keep going with what they know and list the rest as open items for the athlete.
- Offer a sensible default inside the question when there is one ("most people start with 3 days —
  does that work, or would you rather tell me which days you have?"), but let them answer freely.
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

## 5. Publish (when they want the dashboard online)

Follow `${CLAUDE_PLUGIN_ROOT}/skills/training/reference/deploy.md`. **Before the first production deploy** the Vercel project must have
`SITE_PASSWORD` (and optionally `SITE_USER`) for Production and Preview — it's health data. After
deploying, check `/` returns 401 without credentials. Adding an athlete to an existing deploy is
just a commit and push; remind them everyone with the site password sees every athlete.

**Where the data lives.** The project folder is the athlete's (or the household's) own repo: their
plans and health data, plus a copy of the app. It belongs in a **private** GitHub repository owned
by them — not in the plugin's repo, and not in someone else's. On a first setup, offer to create it
(`gh repo create <name> --private --source . --push`, after they confirm the name and account) and
connect it to their Vercel project. Several people in one household can share one repo and one
password; unrelated people each get their own.

Commit with only the new athlete's folder (plus the scaffold on a first setup). Tell them the next
steps: `/strata:session <slug>` after each run, `/strata:weekly <slug>` at the end of
each week, and `tools/export.sh --athlete <slug>` for backups.
