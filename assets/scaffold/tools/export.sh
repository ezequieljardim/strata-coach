#!/usr/bin/env bash
# Snapshot of everything that isn't reproducible from npm, outside the repo.
#
#   tools/export.sh [--athlete <slug>] [dest_dir]    (default dest: ~/Backups/running-plan)
#
# Without --athlete it backs up every athlete plus the repo's own docs, tools and commands.
set -euo pipefail
cd "$(dirname "$0")/.."
athlete=""
if [ "${1:-}" = "--athlete" ]; then athlete="$2"; shift 2; fi
dest="${1:-$HOME/Backups/running-plan}"
mkdir -p "$dest"
name="running-plan-backup${athlete:+-$athlete}-$(date +%Y-%m-%d-%H%M).tar.gz"
out="$dest/$name"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
if [ -n "$athlete" ]; then
  [ -f "athletes/$athlete/config.json" ] || { echo "unknown athlete: $athlete" >&2; exit 1; }
  paths=("athletes/$athlete")
else
  paths=(athletes docs tools .claude/commands CLAUDE.md README.md middleware.ts)
fi
{
  echo "commit: $(git rev-parse HEAD 2>/dev/null || echo none)"
  echo "date:   $(date -u +%FT%TZ)"
  python3 - "${athlete:-}" <<'PY'
import json, glob, sys
pattern = f"athletes/{sys.argv[1] or '*'}/*.json"
for f in sorted(glob.glob(pattern)):
    d = json.load(open(f))
    lists = {k: len(v) for k, v in d.items() if isinstance(v, list)}
    print(f"{f}: {lists}")
PY
} > "$tmp/manifest.txt"
existing=(); for p in "${paths[@]}"; do [ -e "$p" ] && existing+=("$p"); done
tar -czf "$out" "${existing[@]}" -C "$tmp" manifest.txt
echo "$out"
