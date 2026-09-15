# Strata — a running coach for Claude Code

Coach one or more runners with Claude. Fitness is built the way strata form: thin layers, laid down week after week, that harden into something that holds. An interview builds a personal plan (a race, a distance, or
a habit), `/session` loads every run and gives structured feedback, and each athlete gets a
password-protected dashboard at `/<slug>` that deploys to Vercel.

It came out of a real 14-week comeback plan with a recurring injury, so it's opinionated about one
thing: **the coach brakes more than it pushes**.

## Install

Strata is a plugin **and** its own marketplace: first you add the marketplace (once), then you
install the plugin from it. Pick whichever place you use Claude Code from.

Replace `ezequieljardim/strata-coach` with a local path (e.g. `/Users/you/strata-coach`) to install
from a folder on your machine instead of GitHub.

### Claude Code in the terminal

Inside a Claude Code session, **one command at a time** (the first one may open a dialog; pasting
both together puts the second inside it):

```
/plugin marketplace add ezequieljardim/strata-coach
```

```
/plugin install strata@strata
```

Then start a new session so the commands load.

### From your shell, without opening a session

```bash
claude plugin marketplace add ezequieljardim/strata-coach
claude plugin install strata@strata
```

Installs for your user, so it's available in every project. Useful when `/plugin` isn't available
where you are.

### Claude desktop app (Code tab)

`/plugin` isn't available in the desktop app. Instead:

1. Add the marketplace once from your shell: `claude plugin marketplace add ezequieljardim/strata-coach`.
2. In a local session, click **+** next to the prompt box → **Plugins** → **Add plugin**, and pick
   **Strata** (or install it from the shell as above — a plugin installed that way showed up in the
   desktop app after opening a new session).
3. Open a new session. Typing `/strata` should list `start`, `session`, `weekly` and `status`.

Plugins aren't available in the app's cloud sessions or in WSL sessions.

### Private repository

If the GitHub repo is private, Claude Code uses your git credentials (`gh auth login`, Keychain, or
an SSH key loaded in `ssh-agent`). With several GitHub accounts, make sure the active one has access
(`gh auth status`, `gh auth switch`). Background auto-updates can't authenticate over HTTPS: use SSH
or update by hand with `claude plugin marketplace update strata` and `claude plugin update strata`.

### Updating

```bash
claude plugin marketplace update strata
claude plugin update strata
```

Start a new session afterwards. This updates the skill and commands; the dashboard code already
copied into your repo doesn't change.

## Use

In an empty folder:

```
/strata:start
```

It creates the project, interviews you (or whoever the plan is for), writes the plan week by week,
and opens the dashboard locally. Run it again in the same folder to add another athlete.

| Command | When |
|---|---|
| `/strata:start [name]` | new project or new athlete |
| `/strata:session [slug]` | after each run: load it and get feedback |
| `/strata:weekly [slug]` | end of the week: progress, repeat or stop |
| `/strata:status [slug]` | read-only: where do I stand |

## What the dashboard shows

Per athlete, at `/<slug>`: plan progress and weekly volume, a calendar with every day's full
prescription and the coach's feedback on done days, one tab per tracked issue (key metric week
over week, log, traffic light), runs with cadence and HR charts, recovery context (sleep, resting
HR, weight), and the plan's notes as short articles. Light, dark or system theme. A picker at `/`
when there's more than one athlete.

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
