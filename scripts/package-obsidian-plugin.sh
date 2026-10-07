#!/usr/bin/env bash
# Builds the Obsidian plugin and writes a zip to dist/. Inside is one folder,
# dbml-studio/, holding exactly what Obsidian reads from a plugin folder:
# unzipped into <vault>/.obsidian/plugins/ it is installed.
#
# Needs no site build: the frame comes from the dbml-frame package, which the
# plugin's own build vendors and refuses when it is missing anything. Run
# `npm ci` first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT"

(cd "$ROOT" && npm run build)

VERSION="$(node -p "require('$ROOT/manifest.json').version")"
ARTIFACT="$ROOT/dist/dbml-studio-obsidian-$VERSION.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/dbml-studio" "$ROOT/dist"
cp "$ROOT/manifest.json" "$SRC/main.js" "$SRC/styles.css" "$STAGE/dbml-studio/"
cp -R "$SRC/frame" "$STAGE/dbml-studio/frame"

rm -f "$ARTIFACT"
(cd "$STAGE" && zip -r -q "$ARTIFACT" dbml-studio)

echo "wrote $ARTIFACT"
