#!/usr/bin/env bash
# What a release of the plugin has to be, checked the same way wherever it is
# checked: by scripts/release-github.sh before it tags, and by the release
# workflow (.github/workflows/release.yml) before it releases the tag.
#
#   bash scripts/release-checks.sh <x.y.z> [--notes <file>]
#   bash scripts/release-checks.sh --built
#
# With a version: the version is x.y.z, the root manifest.json is at it,
# versions.json maps it to the manifest's minAppVersion, and CHANGELOG.md has
# its entry. --notes writes that entry, without its heading, to <file>: the
# release's notes.
#
# --built: main.js, as just built, carries the frame just vendored. Run after
# `npm run build`.
#
# Reads only the repository this script is in, and changes nothing but the
# notes file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  echo "usage: bash scripts/release-checks.sh <x.y.z> [--notes <file>] | --built" >&2
  exit 2
}

fail() {
  echo "$1" >&2
  exit 1
}

# What a reader installs is main.js alone, so it has to carry the frame. The
# BUILD of the frame just vendored, as a string, is the proof it is this one;
# and a main.js under 1 MB cannot hold a 16 MB frame, however well it packs.
check_built() {
  local main_js="$ROOT/main.js" build_file="$ROOT/frame/BUILD"

  for file in "$main_js" "$build_file"; do
    if [ ! -f "$file" ]; then
      fail "no $file; build the plugin first: npm run build"
    fi
  done

  node -e '
    const fs = require("fs");
    const [mainJs, buildFile] = process.argv.slice(1);
    const build = fs.readFileSync(buildFile, "utf8");
    const code = fs.readFileSync(mainJs, "utf8");
    const size = fs.statSync(mainJs).size;
    if (!code.includes(JSON.stringify(build))) {
      console.error(`main.js does not carry the frame of build ${build.trim()}`);
      process.exit(1);
    }
    if (size < 1000000) {
      console.error(`main.js is ${size} bytes, too small to carry the frame`);
      process.exit(1);
    }
    console.log(`main.js carries frame ${build.trim()} (${size} bytes)`);
  ' "$main_js" "$build_file"
}

VERSION=""
NOTES_FILE=""
BUILT=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --built) BUILT=1 ;;
    --notes)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "--notes needs a file to write the notes to" >&2
        usage
      fi
      NOTES_FILE="$2"
      shift
      ;;
    -*)
      echo "unknown option: $1" >&2
      usage
      ;;
    *)
      if [ -n "$VERSION" ]; then
        echo "one version, not two: $VERSION and $1" >&2
        usage
      fi
      VERSION="$1"
      ;;
  esac
  shift
done

if [ "$BUILT" -eq 1 ]; then
  if [ -n "$VERSION" ] || [ -n "$NOTES_FILE" ]; then
    echo "--built checks main.js alone: no version, no --notes" >&2
    usage
  fi
  check_built
  exit 0
fi

if [ -z "$VERSION" ]; then
  usage
fi
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "the version is x.y.z, exactly the tag the directory reads: not $VERSION" >&2
  exit 2
fi

# Named from where the script was run, before it moves to the root.
if [ -n "$NOTES_FILE" ] && [[ "$NOTES_FILE" != /* ]]; then
  NOTES_FILE="$PWD/$NOTES_FILE"
fi

cd "$ROOT"

# The directory reads the root manifest.json from the default branch and
# picks a release for an Obsidian version from versions.json beside it.
MANIFEST_VERSION="$(node -p "require('./manifest.json').version")"
MIN_APP="$(node -p "require('./manifest.json').minAppVersion")"
if [ "$MANIFEST_VERSION" != "$VERSION" ]; then
  fail "manifest.json is at $MANIFEST_VERSION, not $VERSION; the release commit changes it first"
fi
LISTED="$(node -p "require('./versions.json')['$VERSION'] ?? ''")"
if [ -z "$LISTED" ]; then
  fail "versions.json has no $VERSION; add \"$VERSION\": \"$MIN_APP\""
fi
if [ "$LISTED" != "$MIN_APP" ]; then
  fail "versions.json says $VERSION needs $LISTED, manifest.json says $MIN_APP"
fi

# The release notes: the version's section of the changelog, without its
# heading. An `## [Unreleased]` section above it is not read.
NOTES="$(awk -v v="$VERSION" '
  index($0, "## [" v "]") == 1 { on = 1; next }
  on && /^## \[/ { exit }
  on { print }
' CHANGELOG.md)"
if [ -z "$(printf '%s' "$NOTES" | tr -d '[:space:]')" ]; then
  fail "CHANGELOG.md has no entry for $VERSION"
fi

if [ -n "$NOTES_FILE" ]; then
  printf '%s\n' "$NOTES" > "$NOTES_FILE"
fi

echo "$VERSION: manifest.json, versions.json and CHANGELOG.md agree"
