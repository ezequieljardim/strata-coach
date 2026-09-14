#!/bin/bash
#
# sync-local.sh — Health Auto Export → dashboard sync, run on the Mac.
#
#   ./tools/hae/sync-local.sh [--athlete <slug>] [--dry]
#
# WHY HERE AND NOT IN THE CLOUD
# ----------------------------
# The Cowork scheduled-task sandbox has no network to googleapis.com, can't push to GitHub
# (a proxy only authorizes repos on its list) and can't reach this Mac's folders. Vercel is
# blocked too. Verified 17/08/2026. This machine has none of those problems, so everything
# deterministic lives here: fetch, parse, verify, commit, push.
#
# THREE POSSIBLE SOURCES, IN ORDER OF PREFERENCE
# ----------------------------------------------
#   1. iCloud Drive           — HAE automation to iCloud. Nothing to install.
#   2. Google Drive for desktop — if installed.
#   3. rclone                 — CLI client, no background process. `brew install rclone`.
#
# No path is hardcoded: sources are found BY CONTENT, i.e. any folder containing
# Health_Data-*.json files. Folder names change with the system language ("My Drive" →
# "Mi unidad") and with whatever the automation was named.
#
# ABOUT iCLOUD LAZINESS
# ---------------------
# iCloud syncs when it feels like it and evicts old files leaving `.name.icloud`
# placeholders. Both are handled: placeholders are materialized with `brctl download`,
# DAYS days are looked back (5 by default) so a late file is picked up next run, and a
# missing yesterday file is logged instead of failing silently. The script is idempotent.
#
# ONE ATHLETE PER RUN
# -------------------
# HAE exports belong to one person's phone. With several athletes, each one using HAE has
# their own source (HAE_DIR or `ingest.hae.driveFolderId` in their config.json).
#
set -euo pipefail

REPO="${HAE_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
export HAE_WORK="${HAE_WORK:-$HOME/.hae}"
DAYS="${HAE_DAYS:-${HAE_DIAS:-5}}"
ICLOUD_WAIT="${HAE_ICLOUD_WAIT:-45}"   # max seconds waiting for downloads
DRY=""
ATHLETE="${HAE_ATHLETE:-}"
while [ $# -gt 0 ]; do
    case "$1" in
        --dry) DRY="--dry" ;;
        --athlete) ATHLETE="$2"; shift ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
    shift
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Resolve the athlete the same way the Python tools do (fails with more than one and no slug).
ATHLETE="$(cd "$REPO/tools" && python3 -c "import sys; from athlete import resolve; print(resolve(sys.argv[1] or None).slug)" "$ATHLETE")"
DATA="athletes/$ATHLETE"
CACHE="$HAE_WORK/source-$ATHLETE"
DRIVE_FOLDER_ID="${HAE_DRIVE_FOLDER_ID:-$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('ingest',{}).get('hae',{}).get('driveFolderId',''))" "$REPO/$DATA/config.json")}"

mkdir -p "$HAE_WORK/raw" "$HAE_WORK/out"

# ═══════════════════════════════════════════════ 1. pick where files come from
# Finds a folder containing exports, either as a real file or as a not-yet-downloaded
# iCloud placeholder (`.Health_Data-....json.icloud`).
find_in() {
    [ -d "$1" ] || return 1
    find "$1" -maxdepth 6 \
        \( -name 'Health_Data-*.json' -o -name '.Health_Data-*.json.icloud' \) \
        -print -quit 2>/dev/null | head -1 | xargs -I{} dirname {} 2>/dev/null
}

SOURCE=""; DIR=""; RCLONE_REMOTE="${HAE_RCLONE_REMOTE:-}"

if [ -n "${HAE_DIR:-}" ] && [ -d "${HAE_DIR}" ]; then
    DIR="$HAE_DIR"; SOURCE="forced"
elif [ -f "$CACHE" ] && [ -d "$(cut -d'|' -f2 "$CACHE")" ]; then
    SOURCE="$(cut -d'|' -f1 "$CACHE")"; DIR="$(cut -d'|' -f2 "$CACHE")"
else
    for pair in "icloud|$HOME/Library/Mobile Documents/com~apple~CloudDocs" \
                "gdrive-app|$HOME/Library/CloudStorage"; do
        name="${pair%%|*}"; base="${pair#*|}"
        found="$(find_in "$base" || true)"
        if [ -n "$found" ]; then
            SOURCE="$name"; DIR="$found"
            printf '%s|%s' "$SOURCE" "$DIR" > "$CACHE"
            log "source found ($SOURCE): $DIR"
            break
        fi
    done
fi

if [ -z "$SOURCE" ] && command -v rclone >/dev/null 2>&1 && [ -n "$DRIVE_FOLDER_ID" ]; then
    [ -z "$RCLONE_REMOTE" ] && RCLONE_REMOTE="$(rclone listremotes 2>/dev/null | head -1 | tr -d ':')"
    [ -n "$RCLONE_REMOTE" ] && SOURCE="rclone"
fi

# ═══════════════════════════════════════════════════════════════════ 2. checks
if [ -z "$SOURCE" ]; then
    log "ERROR: no source with Health_Data-*.json files found for $ATHLETE."
    log "  Looked in:"
    log "    ~/Library/Mobile Documents/com~apple~CloudDocs   (iCloud)"
    log "    ~/Library/CloudStorage                            (Drive for desktop)"
    log "    rclone listremotes + ingest.hae.driveFolderId     (not installed, no remote or no folder id)"
    log "  Force a path:  export HAE_DIR='/path/to/folder'"
    exit 1
fi

if [ -f "$REPO/.git/index.lock" ]; then
    log "ERROR: there is a .git/index.lock. Remove it with: rm -f '$REPO/.git/index.lock'"
    exit 1
fi

# ═══════════════════════════════════════════ 3. fetch the files of the last N days
# Several days, not just today: the morning export has the current day incomplete (steps,
# resting HR and HRV) and the next day's completes it. It also absorbs iCloud latency.
rm -f "$HAE_WORK"/raw/*.json
dates=()
for i in $(seq 0 $((DAYS - 1))); do dates+=("$(date -v-"${i}"d +%Y-%m-%d)"); done

if [ "$SOURCE" = "rclone" ]; then
    # DUPLICATES: Drive indexes by ID, not name, so a folder can hold two different
    # `Health_Data-2026-08-16.json` — HAE re-uploads a day when it completes it. `rclone copy`
    # then keeps one with no guarantee of which. Verified 19/08/2026: 16/08 existed twice,
    # 667 KB uploaded on the 16th and 704 KB on the 18th.
    #
    # So: list with IDs, pick the newest of each name, download that one by ID. The folder is
    # addressed by ID too: the ID never changes, the name and location may.
    listing="$HAE_WORK/out/lsjson.json"
    rclone lsjson "${RCLONE_REMOTE}:" \
        --drive-root-folder-id "$DRIVE_FOLDER_ID" --max-depth 1 > "$listing" \
        || { log "ERROR: rclone lsjson failed"; exit 1; }

    pairs=$(DATES="${dates[*]}" DEST="$HAE_WORK/raw" \
            python3 "$REPO/tools/hae/pick-exports.py" "$listing") \
        || { log "ERROR: could not read the Drive listing"; exit 1; }

    [ -z "$pairs" ] && { log "no exports from the last $DAYS days in Drive"; exit 0; }

    # backend copyid takes several ID/destination pairs in one call.
    # shellcheck disable=SC2086
    rclone backend copyid "${RCLONE_REMOTE}:" $pairs \
        || { log "ERROR: download by ID failed"; exit 1; }
else
    if [ "$SOURCE" = "icloud" ] && ls -a "$DIR" 2>/dev/null | grep -q '\.icloud$'; then
        log "iCloud placeholders present, forcing download..."
        brctl download "$DIR" 2>/dev/null || true
        pending=0
        for d in "${dates[@]}"; do
            [ -f "$DIR/Health_Data-${d}.json" ] || pending=1
        done
        t=0
        while [ "$pending" = "1" ] && [ "$t" -lt "$ICLOUD_WAIT" ]; do
            sleep 3; t=$((t + 3)); pending=0
            for d in "${dates[@]}"; do
                [ -f "$DIR/Health_Data-${d}.json" ] || \
                    { [ -f "$DIR/.Health_Data-${d}.json.icloud" ] && pending=1; }
            done
        done
        [ "$t" -gt 0 ] && log "waited ${t}s for iCloud to download"
    fi
    for d in "${dates[@]}"; do
        for pre in Health_Data Workouts_Data; do
            [ -f "$DIR/${pre}-${d}.json" ] && cp "$DIR/${pre}-${d}.json" "$HAE_WORK/raw/"
        done
    done
fi

copied=$(find "$HAE_WORK/raw" -name '*.json' | wc -l | tr -d ' ')
log "$copied files from the last $DAYS days (source: $SOURCE)"
[ "$copied" -eq 0 ] && { log "nothing to sync"; exit 0; }

yesterday="$(date -v-1d +%Y-%m-%d)"
[ -f "$HAE_WORK/raw/Health_Data-${yesterday}.json" ] || \
    log "WARNING: Health_Data-${yesterday}.json is missing. The source is lagging; the next run picks it up."

# ═══════════════════════════════════════════════════════════ 4. parse and merge
cd "$REPO"
# --autostash: if something is half-edited in the repo, it is stashed, rebased and
# re-applied. Without it the pull aborts and the sync doesn't run until you commit by hand.
if ! git pull --rebase --autostash --quiet; then
    log "ERROR: git pull --rebase --autostash failed."
    log "  A stash may be left behind: git stash list / git stash pop"
    exit 1
fi

python3 tools/hae/hae.py extract --athlete "$ATHLETE" --quiet
python3 tools/hae/hae.py merge --athlete "$ATHLETE" $DRY

[ -n "$DRY" ] && { log "dry run, not committing"; exit 0; }

# ══════════════════════════════════════════════════════ 5. verify before publishing
if git diff --quiet -- "$DATA"; then
    log "no changes in $DATA, nothing to commit"
    exit 0
fi

log "verifying data and build before committing"
python3 tools/validate.py --athlete "$ATHLETE" || { log "ERROR: invalid data, not committing"; exit 1; }
npx tsc --noEmit                      || { log "ERROR: tsc failed, not committing"; exit 1; }
npm run build --silent >/dev/null     || { log "ERROR: build failed, not committing"; exit 1; }
if grep -q SITE_PASSWORD dist/assets/*.js 2>/dev/null; then
    log "ERROR: SITE_PASSWORD showed up in the bundle. NOT committing."
    exit 1
fi

# Only this athlete's data: whatever else is half-edited in the repo stays out.
git add "$DATA"
git commit --quiet -m "sync($ATHLETE): Health Auto Export as of $(date +%Y-%m-%d)"
if ! git push --quiet; then
    log "ERROR: push failed. The commit is local."
    log "  Usually divergence with the remote: git pull --rebase && git push"
    exit 1
fi
log "pushed. Vercel republishes on its own."

# ═══════════════════════════════════════════════════ 6. leave the summary in sight
python3 - <<'PY'
import json, os
d = json.load(open(os.path.expanduser(os.environ.get("HAE_WORK", "~/.hae")) + "/out/changes.json"))
for c in d["changes"]:
    print("  change:", c)
for a in d["alerts"]:
    print("  ALERT:", a)
PY
