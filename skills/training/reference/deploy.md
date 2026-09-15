# Deploy, protection and environment traps

## Local

```bash
npm install
npm run dev            # http://localhost:5173 → the only athlete, or a picker
```

## Vercel

Hobby is free and meant for personal, non-commercial use (checked 15/09/2026) — enough for this.
The expected setup is a **private GitHub repo owned by the athlete** (or the household) imported as
a Vercel project: every push to `main` redeploys. Vercel only lets a personal-account repo's
**owner** connect it, so a collaborator on someone else's repo can't publish it. `vercel deploy
--prod` without GitHub works too, but then logging a run doesn't redeploy anything.

```bash
npm i -g vercel
vercel link            # or `vercel` the first time to create the project
vercel --prod
```

Connecting the GitHub repo in Vercel redeploys on every push to `main`. `vercel.json` pins the
framework (Vercel may detect it wrongly) and rewrites every path to `index.html` so `/<slug>` works
on refresh.

## Protection — do this before the first production deploy

The site contains health data, **compiled into the JavaScript bundle**. Client-side protection is
useless; the cut must be at the edge.

- On the **Hobby** plan, Vercel's native protection does **not** cover the production domain
  (Standard Protection covers previews only; "All Deployments" needs Pro). Checked 08/2026 —
  verify before telling anyone otherwise.
- So `middleware.ts` does basic auth. Set in Vercel → Settings → Environment Variables, for
  Production and Preview:
  - `SITE_PASSWORD` (required),
  - `SITE_USER` (optional, default `coach`).
- **Without `SITE_PASSWORD` the middleware lets everything through** — on purpose, so a half-done
  deploy doesn't lock the owner out. After deploying, check: `curl -s -o /dev/null -w '%{http_code}'
  https://<domain>/` must be `401`.
- One password for the whole site: every athlete in the repo can see every other's data. Fine for a
  family; for unrelated people, use separate repos and deploys.
- A valid login sets an `sfauth` cookie (1 year) with a hash of user+password. Changing
  `SITE_PASSWORD` logs everyone out.
- `grep -c SITE_PASSWORD dist/assets/*.js` must give 0 on every build.
- Env vars marked sensitive can't be pulled back with `vercel env pull`; to test the login locally,
  `vercel dev` with a throwaway password (there's a `vercel-dev` entry in `.claude/launch.json`).

## Traps

- **Git author email.** If the global git config uses a work email, Vercel may reject deploys that
  don't match the GitHub account. Set `user.email` locally in the repo.
- **Mounted folders (Cowork and similar bridges).** An agent there can create files in `.git` but
  not delete them, so any git command that touches the index — `git status` included — can leave an
  undeletable `.git/index.lock`. Use `git --no-optional-locks`, or hand the commands to the user.
  Doesn't apply to Claude Code running locally.
- **Cowork scheduled tasks** (verified 17/08/2026) have no network to googleapis.com, can't push to
  GitHub outside their authorized repos, can't reach local folders, and Vercel is blocked. That's
  why the sync runs on the Mac.
