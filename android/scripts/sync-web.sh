#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT/game"
npm ci --ignore-scripts --no-audit --no-fund
npm run build
DEST="$ROOT/android/app/src/main/assets/web"
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -R dist/. "$DEST/"
printf '%s\n' 'Offline web files copied to Android assets.'
