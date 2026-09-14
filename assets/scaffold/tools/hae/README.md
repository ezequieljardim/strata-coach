# Health Auto Export → dashboard sync

The **Health Auto Export** iPhone app uploads two JSON files per day: `Health_Data-YYYY-MM-DD.json`
(daily metrics) and `Workouts_Data-YYYY-MM-DD.json` (workouts). This folder fetches them, parses
them and merges them into one athlete's `athletes/<slug>/`.

Optional ingest adapter: it needs an iPhone + Apple Watch, the (paid) HAE app, and a Mac. Athletes
without that stack load sessions by hand through `/session`.

```
Source (rclone / iCloud / Drive app) ──► $HAE_WORK/raw/*.json
                                                │
                                             extract
                                                ▼
                                        out/summary.json
                                                │
                                              merge
                                                ▼
                     athletes/<slug>/context.json + sessions.json
                                                │
                                  npx tsc && npm run build && grep
                                                │
                                        git commit && push
                                                ▼
                                       Vercel republishes
```

There is no scheduled job: `/session` runs the sync as its first step. `HAE_DAYS` (5) sets how
far back it looks when days went by without loading.

## Usage

```bash
./tools/hae/sync-local.sh --dry                    # what it would do, no commit
./tools/hae/sync-local.sh                          # sync, verify, push
./tools/hae/sync-local.sh --athlete ana            # required with more than one athlete
```

Step by step:

```bash
python3 tools/hae/hae.py extract --athlete <slug>        # raw/ → out/summary.json
python3 tools/hae/hae.py merge --athlete <slug> --dry   # see the diff
python3 tools/hae/hae.py merge --athlete <slug>          # apply
python3 tools/hae/hae.py decode                         # cloud only: tool-results → raw/
```

Variables: `HAE_WORK` (`~/.hae`), `HAE_ATHLETE`, `HAE_DAYS` (5), `HAE_DIR`, `HAE_RCLONE_REMOTE`,
`HAE_DRIVE_FOLDER_ID` (overrides `ingest.hae.driveFolderId`), `HAE_ICLOUD_WAIT` (45 s).

### The sync never publishes anything broken

Before committing it runs `npx tsc --noEmit`, `npm run build` and checks `SITE_PASSWORD` is not in
the bundle. Any failure aborts. It only `git add`s `athletes/<slug>`, so half-edited files stay
out, and `git pull` uses `--autostash`.

## Where files come from

First source found wins; the choice is cached in `~/.hae/source-<slug>`. **No path is
hardcoded:** it searches by content (any folder with `Health_Data-*.json`) because folder names
change with the system language ("My Drive" → "Mi unidad") and the automation's name.

1. **iCloud Drive.** HAE automation to iCloud. Placeholders (`.name.json.icloud`) are
   materialized with `brctl download`. Tried on 17/08/2026 and files never reached the Mac, but
   it stays supported.
2. **Google Drive for desktop.** Detected automatically when installed.
3. **rclone.** CLI client, no background process. Addressed **by folder ID**
   (`ingest.hae.driveFolderId`), which never changes:

   ```bash
   brew install rclone && rclone config     # drive, scope 1, auto config
   rclone lsd gdrive: --drive-root-folder-id <folderId>
   ```

   > ⚠ **rclone's shared `client_id` is being retired during 2026.** With empty
   > `client_id`/`client_secret` it uses the shared one and warns every run; it will break in an
   > unattended run, silently. Creating your own takes ~5 minutes:
   > https://rclone.org/drive/#making-your-own-client-id

### Duplicates in Drive

Drive indexes by ID, so one folder can hold **two files with the same name** (HAE re-uploads a
day when it completes it). `rclone copy` then keeps one with no guarantee of which. The sync
lists with `rclone lsjson`, keeps the highest `ModTime` per name and downloads that one by ID.
The choice lives in `pick-exports.py`, with its self-check:

```bash
python3 tools/hae/pick-exports.py --demo
```

### Why the download in the cloud is odd

In Cowork the only way to Drive is the MCP connector, whose `download_file_content` returns the
file base64-encoded in the tool result. What makes it viable is a harness side effect: a tool
result over the token limit is written whole under `/root/.claude/projects/*/tool-results/` and
only the path enters context. `hae.py decode` picks those up. **If downloads ever fail there,
that's the first suspect.**

## Measurement criteria

Fixed and versioned on purpose: a fresh session has no memory, and a parser rewritten each time
would measure each run differently. Thresholds are per athlete, in `config.json`:

| Criterion | Config key | Default |
|---|---|---|
| Jogging minute | `ingest.hae.jogPaceMaxMinPerKm` — 1-min bucket faster than this, grouped by **rounded minute** | 9.0 |
| Jogging block | `ingest.hae.jogMinCadence` — the whole block is dropped if its mean cadence is below | 140 |
| Cadence | mean `stepCount` over jogging minutes **+ `ingest.hae.cadenceOffset`** (Apple↔manual) | 10 |
| Easy-day HR cap | `rules.easyDayHrCap`, with `ingest.hae.hrTolerance` margin | — / 5 |
| Partial day | `steps`, `restingHr` and `hrv` stored as `null` | |

**Before changing a criterion for an athlete with history**, check against raw data that
already-loaded sessions don't move, and record the old result in the session's
`_previousCriterion`.

### Two bugs fixed on 19/08/2026

1. **HAE series are not aligned.** HR is stamped at `:00`, distance and steps at the second the
   workout started. Joining by exact timestamp split every minute in two, producing 27 fake
   one-minute blocks and **every HR peak as `None`**. Everything is now grouped by rounded minute.
2. **Pace alone doesn't separate a brisk walk from a slow jog.** Two blocks at 7:42-8:02/km with
   cadence 129-130 counted as jogging and inflated volume by 0.50 km (+18%) — exactly what the
   10%-weekly rule watches. Whole blocks under the cadence threshold are now dropped. Per
   **block**, not minute: a single low minute is the transition from walking.

### Validation (first athlete, August 2026)

| | 11/08 | 14/08 | 16/08 |
|---|---|---|---|
| jog km — manual | 2.54 | 2.37 | 3.71 |
| jog km — `hae.py` | **2.54** | **2.37** | **3.71** |
| Apple cadence — manual | ~150 | 148.6 | 162.5 |
| Apple cadence — `hae.py` | **149.8** | **149.9** | **162.0** |

## What the automation does NOT decide

`merge` loads **objective data** and marks the entry `"pendingReport": true`. It never invents:

- **Any `tracked.<id>` field.** Only the athlete can report them. They stay `null` with
  `present: false`, which while `pendingReport` is true means **"not reported"**, not "didn't
  happen".
- **`rpe`**, **`shoes`**, **`surface`**.
- **Whether a walk was recovery or a commute.**

An entry still marked `pendingReport` was written by the script and nobody reviewed it, so
**`merge` regenerates it** — that's how a parser fix corrects already-loaded sessions. Once the
athlete completes it and the flag is removed, it is never touched again.

## Alerts

- Per-block HR over the easy-day cap (+ tolerance).
- Runs on consecutive days (when `rules.noBackToBackRunDays`).
- Jogging volume jump over 15 % between consecutive runs.
