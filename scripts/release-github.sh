#!/usr/bin/env bash
# Tags a release of the Obsidian plugin, once it is checked to build and
# release cleanly. The tag is what the release workflow
# (.github/workflows/release.yml) builds, attests and releases on GitHub.
#
#   npm run release:github -- 0.2.0            check, build, tag, push the tag
#   npm run release:github -- 0.2.0 --check    check and build only
#
# Run on main once the release commit is merged. The tag is the bare version,
# as the directory requires, on HEAD, which has to be origin/main.
#
# A pushed tag is public at once and the directory serves the release made
# from it, so the script asks for the version to be typed back first. --check
# stops after the build and its checks.
set -euo pipefail

REPO="AKonyshev/obsidian-dbml-studio"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  echo "usage: npm run release:github -- <x.y.z> [--check]" >&2
  exit 2
}

VERSION=""
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    -h | --help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "unknown option: $arg" >&2
      usage
      ;;
    *)
      if [ -n "$VERSION" ]; then
        echo "one version, not two: $VERSION and $arg" >&2
        usage
      fi
      VERSION="$arg"
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  usage
fi

fail() {
  echo "$1" >&2
  exit 1
}

# The version's form, the manifest, versions.json and the changelog entry:
# what the release workflow checks again on the tag, with the same script.
# First, as they need no repository: a version that is not x.y.z is refused
# before git is asked anything.
bash "$ROOT/scripts/release-checks.sh" "$VERSION"

cd "$ROOT"

# The tree the tag will name, exactly: main, nothing uncommitted, nothing
# unpushed and nothing unpulled.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  fail "release from main, not from $BRANCH"
fi
DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  fail "the tree has changes; commit or remove them first:
$DIRTY"
fi
git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  fail "main is not origin/main; pull or push until they are the same commit"
fi

if git rev-parse --quiet --verify "refs/tags/$VERSION" > /dev/null; then
  fail "the tag $VERSION already exists here"
fi
if [ -n "$(git ls-remote --tags origin "refs/tags/$VERSION")" ]; then
  fail "the tag $VERSION already exists on origin"
fi

# From scratch, as the workflow builds it: the dependencies as locked, then
# the plugin — the frame vendored out of dbml-frame and packed into main.js.
# What fails here would fail there too, after the tag is public.
npm ci
npm run build
bash scripts/release-checks.sh --built

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "$VERSION is ready to release; nothing tagged (--check)"
  exit 0
fi

printf 'Tag %s on %s and push it? GitHub Actions then releases it, and the tag is public at once. Type the version to confirm: ' \
  "$VERSION" "$(git rev-parse --short HEAD)"
read -r answer
if [ "$answer" != "$VERSION" ]; then
  echo "not tagged"
  exit 1
fi

git tag -a "$VERSION" -m "DBML Studio for Obsidian $VERSION"
git push origin "refs/tags/$VERSION"

echo "tagged $VERSION. GitHub Actions now builds, attests and releases it:
  https://github.com/$REPO/actions/workflows/release.yml"
