#!/usr/bin/env bash
# Copies the built plugin into a vault. The vault's `.obsidian/` is ignored by
# git, so the plugin is installed rather than committed.
#
# Installs what the Community plugins directory installs — main.js,
# manifest.json, styles.css — and removes the vault's frame/, so the plugin
# unpacks the frame its main.js carries on the next start, as it does for a
# reader. A frame left in place could otherwise outlive the main.js it belongs
# to: the plugin keeps the one whose BUILD id it finds there.
set -euo pipefail

VAULT="${1:-${OBSIDIAN_VAULT:-}}"

if [ -z "$VAULT" ]; then
  echo "usage: install-obsidian-plugin.sh <vault path>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT"
DEST="$VAULT/.obsidian/plugins/dbml-studio"

# main.js is built only with the frame inside it (scripts/build-plugin.mjs
# refuses otherwise), so it alone says the plugin is built.
if [ ! -f "$SRC/main.js" ]; then
  echo "install-obsidian-plugin: not built: $SRC/main.js" >&2
  echo "run \`npm run build\`, then install again" >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$ROOT/manifest.json" "$SRC/main.js" "$SRC/styles.css" "$DEST/"
rm -rf "$DEST/frame"

echo "installed to $DEST"
