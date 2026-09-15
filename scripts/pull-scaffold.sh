#!/usr/bin/env bash
# Refreshes assets/scaffold from a working instance of the dashboard.
#
#   scripts/pull-scaffold.sh ~/claude/Projects/my-running-plan
#
# The instance is where the app is used and fixed every day; the plugin ships a copy of its
# app code WITHOUT any athlete. Run this after changing src/, tools/ or the deploy config
# there, then commit here.
set -euo pipefail
src="${1:?path to an instance repo}"
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="$here/assets/scaffold"

files=(
  src tools public docs/runbooks.md
  index.html middleware.ts vercel.json package.json package-lock.json
  tsconfig.json vite.config.ts .gitignore CLAUDE.md README.md .claude/launch.json
)
rm -rf "$dest" && mkdir -p "$dest"
for f in "${files[@]}"; do
  mkdir -p "$dest/$(dirname "$f")"
  cp -R "$src/$f" "$dest/$f"
done
# Never ship build output, caches or anyone's data.
find "$dest" \( -name __pycache__ -o -name .DS_Store -o -name 'raw' -o -name 'out' \) -prune -exec rm -rf {} +
mkdir -p "$dest/athletes" && touch "$dest/athletes/.gitkeep"
# The app version /strata:upgrade compares against: always the plugin's version.
python3 -c "import json,sys; print(json.dumps({'app': json.load(open(sys.argv[1]))['version']}))" \
  "$here/.claude-plugin/plugin.json" > "$dest/strata.json"

# Guard: the scaffold must not know any athlete.
if grep -rIl -i "san felipe\|montevideo\|ezequiel\|840v1\|tibia\|shins\|onsetKm\|1A_8lTx" "$dest" || grep -rIlw -i "eze" "$dest"; then
  echo "ERROR: athlete-specific content leaked into the scaffold (files above)" >&2
  exit 1
fi
echo "scaffold refreshed from $src"
