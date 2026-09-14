# Running Coach — a Claude Code plugin

Coach one or more runners with Claude. An interview builds a personal plan (a race, a distance, or
a habit), `/session` loads every run and gives structured feedback, and each athlete gets a
password-protected dashboard at `/<slug>` that deploys to Vercel.

It came out of a real 14-week comeback plan with a recurring injury, so it's opinionated about one
thing: **the coach brakes more than it pushes**.

## Install

In Claude Code:

```
/plugin marketplace add ezequieljardim/running-coach
/plugin install running-coach@running-coach
```

## Use

In an empty folder:

```
/running-coach:start
```

It creates the project, interviews you (or whoever the plan is for), writes the plan week by week,
and opens the dashboard locally. Run it again in the same folder to add another athlete.

| Command | When |
|---|---|
| `/running-coach:start [name]` | new project or new athlete |
| `/running-coach:session [slug]` | after each run: load it and get feedback |
| `/running-coach:weekly [slug]` | end of the week: progress, repeat or stop |
| `/running-coach:status [slug]` | read-only: where do I stand |

## What you need

- Claude Code, Node 20+, Python 3, git.
- Optional: a Vercel account (Hobby is enough) and a GitHub repo to publish the dashboard.
- Optional: iPhone + Apple Watch + Mac with Health Auto Export Premium for automatic data. Without
  it, `/session` asks for the numbers — a minute per run. Strava is not supported (its API needs a
  paid subscription per athlete; see `skills/training/reference/ingest.md`).

## What's inside

```
skills/training/            the coaching doctrine and references
  reference/claude-coach/   generic endurance reference, MIT, from felixrieseberg/claude-coach
commands/                   start, session, weekly, status
assets/scaffold/            the dashboard app and tools, with no athletes
scripts/pull-scaffold.sh    refresh the scaffold from a working instance
```

Not medical advice. Symptoms are tracked to bring a clear record to a doctor, never to diagnose.

## License

MIT. `skills/training/reference/claude-coach/` keeps its own MIT license and copyright notice.
