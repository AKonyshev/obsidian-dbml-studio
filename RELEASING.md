# Releasing

The plugin is listed in Obsidian's Community plugins directory, and the
directory sets the rules this document follows. It reads the repository root's
`manifest.json` from the default branch; for a version it installs a GitHub
release whose tag is exactly that version, and from that release it takes
three files and nothing else: `main.js`, `manifest.json`, `styles.css`.

The plugin is versioned on its own, in `manifest.json`, by one rule: what would
a user of the previous version notice? The entry goes in `CHANGELOG.md`. The
release commit also adds the version to `versions.json`, mapped to the
manifest's `minAppVersion` — the Obsidian version the plugin is checked on,
raised only after checking on the newer one. Obsidian uses it to offer an older
Obsidian the last release that still runs there.

## The release commit

One commit, on a branch, merged into `main` by a pull request. It changes three
files:

- `manifest.json`: `version`.
- `versions.json`: the same version, mapped to `minAppVersion`.
- `CHANGELOG.md`: the version's entry, under `## [<version>] - <date>`. The
  release's notes are this section, so write it for a reader of the release
  page.

**The tag is the bare version** — `0.2.4`, not `v0.2.4` — because the directory
looks the release up by the manifest's version.

## The release

The diagram frame travels inside `main.js` (the plugin writes it into its
folder on first start; see "How it works" in `README.md`), so the three files
are the whole plugin. The release also carries
`dbml-studio-obsidian-<version>.zip`, the same plugin as a folder, for
installing by hand.

All of it is one script, run on `main` once the release commit is merged:

```bash
npm run release:github -- <version> --check   # checks and build only
npm run release:github -- <version>
```

The script (`scripts/release-github.sh`) refuses unless the tree is clean, on
`main`, and the same commit as `origin/main`; unless `manifest.json` is at
`<version>`, `versions.json` lists it with the manifest's `minAppVersion`, and
the changelog has its entry; and when the tag exists already. It then installs
the dependencies as locked (`npm ci`), builds the plugin and the zip
(`npm run package`), and checks `main.js` carries the frame it just vendored —
by the frame's `BUILD` string — and is not too small to. With `--check` it
stops there. Otherwise it asks for the version to be typed back, creates the
annotated tag `<version>` on `HEAD`, pushes it, and creates the GitHub release
with `main.js`, `manifest.json`, `styles.css` and the zip attached, its notes
the changelog entry. The tag goes on `HEAD`, which is the merge commit.

Run `--check` first, always: a pushed tag is public at once and the directory
serves the release from it.

This repository's releases are the repository's "latest": the script does not
pass `--latest=false`, as the plugin is the only thing released here.

Should `gh release create` fail after the tag is pushed, a rerun refuses the
existing tag; the script prints the `gh release create` command that finishes
the release from the files the build left in place.

## Updating the frame

The frame is the `dbml-frame` npm package, pinned to an exact version in
`package.json`, so a new frame is a pull request that bumps it (and
`package-lock.json` with it). The type check there is the protocol's test: a
message changed in DBML Studio's `frameHost.ts` fails to compile here. Check
the frame in a real Obsidian before merging — open a note with a diagram.

A changelog entry is for what a reader of a note would notice, not for the
bump itself: a frame with the same diagrams needs none until the next release,
which then says nothing about it. A bump alone is not a release.

## The directory

**Submitting to the directory is a one-time step done by the maintainer at
community.obsidian.md**: sign in with an Obsidian account, link the GitHub
account, and submit the repository. An automated review follows; what it asks
to change is fixed in a new release with a new version. After the plugin is
listed, every release made by the script reaches Obsidian users with no
further step.

The plugin lived in the DBML Studio repository until it moved here. If the
directory's entry still names that repository, the maintainer points it at
`AKonyshev/obsidian-dbml-studio` at community.obsidian.md before a release made
here can reach anybody through the directory.
