---
description: Bring this repo's dashboard app up to the installed Strata version and migrate the data — backup, diff, checks
---

Update the app code in this Strata repo from the installed plugin, and migrate every athlete's data
to the current format. Talk in the user's language. Nothing is pushed without their OK.

The plugin ships the app in `${CLAUDE_PLUGIN_ROOT}/assets/scaffold/`, with its version in
`strata.json`. The repo records the version it runs in its own `strata.json` (missing = before
0.2.0). `/plugin update` refreshes the plugin; **this** command refreshes the repo.

## 1. Preflight

1. Confirm this is a Strata repo (`athletes/` exists). If not, point to `/strata:start`.
2. Compare versions: repo `strata.json` vs `${CLAUDE_PLUGIN_ROOT}/assets/scaffold/strata.json`. If
   equal, say it's up to date and stop. If the plugin is older than the repo, stop and suggest
   updating the plugin (`claude plugin marketplace update strata && claude plugin update strata`).
3. `git status` must be clean. If not, show what's pending and ask the user to commit or stash
   first — the upgrade relies on git to show and undo exactly what it changes.
4. `git pull`.
5. **Backup outside the repo**: `tools/export.sh` if present, otherwise
   `tar -czf ~/Backups/strata-<repo>-$(date +%F-%H%M).tar.gz athletes`. Say where it went.

## 2. App files

Managed files are replaced from the scaffold; they're app code and must match the version:

```
src/  tools/  docs/runbooks.md  index.html  middleware.ts  vercel.json
package.json  package-lock.json  tsconfig.json  vite.config.ts  strata.json
```

Replace `src/` and `tools/` wholesale (files removed upstream go away), except anything git
ignores (e.g. `tools/hae/raw`). Never touch `athletes/` in this step.

Files people customize — `CLAUDE.md`, `README.md`, `.gitignore`, `.claude/launch.json`, `public/`
(icons, manifest) — are **not** overwritten silently: for each one that differs from the scaffold,
show a short summary of the difference and ask whether to take the new version, keep theirs, or
merge the new parts in.

Then `npm install`.

## 3. Data

```bash
python3 tools/migrate.py --dry
```

Show what each athlete's migration will do. For the cycles migration (schema 2), propose a readable
id for each athlete's first cycle (`<year>-<short name>`, e.g. `2026-san-felipe`) and confirm it,
then run per athlete:

```bash
python3 tools/migrate.py --athlete <slug> --cycle-id <id>
```

(or plain `python3 tools/migrate.py` when no migration needs input). References to moved files in
each athlete's docs (e.g. `athletes/<slug>/plan.json` → `athletes/<slug>/cycles/<id>/plan.json` in
HANDOFF or CLAUDE.md) are updated too.

## 4. Verify

```bash
python3 tools/validate.py
npx tsc --noEmit && npm run build
grep -c SITE_PASSWORD dist/assets/*.js        # must be 0
```

And per athlete: `python3 tools/check-min.py --athlete <slug>` and
`python3 tools/gen-ics.py --athlete <slug>` (the calendar's UIDs must not change: check the diff of
the `.ics` shows no removed or renamed UIDs for existing events).

Start the dev server and open each `/<slug>`: every tab renders, the day detail opens, and the
numbers match what was there before.

**If anything fails**, stop, show the error, and offer to undo everything with
`git checkout -- . && git clean -fd -- src tools` (safe: the tree was clean at the start) — only
after the user confirms.

## 5. Finish

Show `git diff --stat` and a short summary: version from → to, files replaced, customized files
and what was decided for each, migrations applied. Commit on the user's OK
(`Upgrade Strata app to <version>`). Pushing redeploys the dashboard: before they push, remind
them to check the site still asks for the password afterwards.
