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
are the whole plugin, and they are all a release carries. No zip: the directory
reports any other file on a release as unsupported. `npm run package` still
builds one locally, for installing by hand.

GitHub Actions builds and releases the plugin, not a maintainer's machine: the
directory rebuilds `main.js` from the tagged source and compares it with the
released one, and asks for attestations on the release's files. The build packs
the frame with `fflate`, so `main.js` is the same bytes on every Node and OS.

Once the release commit is merged, on `main`:

```bash
npm run release:github -- <version> --check   # checks and build only
npm run release:github -- <version>           # the same, then the tag
```

The script (`scripts/release-github.sh`) refuses unless `manifest.json` is at
`<version>`, `versions.json` lists it with the manifest's `minAppVersion`, and
the changelog has its entry (`scripts/release-checks.sh`, which the workflow
runs too); unless the tree is clean, on `main`, and the same commit as
`origin/main`; when the tag exists already, here or on `origin`; and when
`DBML_FRAME_SOURCE` is set, as a release ships the pinned `dbml-frame`, not a
frame from a local checkout. It then installs the dependencies as locked
(`npm ci`), builds the plugin (`npm run build`), and checks the frame it just
vendored is the installed package's (`frame/BUILD` against the package's
`BUILD`), that `main.js` carries it — by that `BUILD` string — and is not too
small to. With `--check` it stops there. Otherwise it asks for the version to be typed back, creates the
annotated tag `<version>` on `HEAD`, which is the merge commit, and pushes it.

Run `--check` first, always: a pushed tag is public at once and the directory
serves the release made from it.

The pushed tag starts the release workflow (`.github/workflows/release.yml`).
It refuses a tag whose commit is not on `main`, then installs, lints, type
checks, tests and builds the plugin on the Node in `.nvmrc`, makes the same
checks as the script, attests `main.js`, `manifest.json` and `styles.css`, and
creates the GitHub release with those three attached and the changelog entry
as its notes. Its progress is at
<https://github.com/AKonyshev/obsidian-dbml-studio/actions/workflows/release.yml>.

An attestation is GitHub's signed record that a file was built by this
repository's workflow from the tagged commit; anyone can check one with
`gh attestation verify main.js --repo AKonyshev/obsidian-dbml-studio`.

This repository's releases are the repository's "latest": the workflow does not
pass `--latest=false`, as the plugin is the only thing released here.

Should the workflow fail after the tag is pushed, a rerun of the script refuses
the existing tag. Fix what failed, then open the tag's run in the Actions tab
and choose "Re-run jobs". A re-run builds the same tagged commit again, so it
mends what lay outside the code — a step that failed by chance, a repository
setting; a fix in the code is a new release commit with a new version.

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
listed, every release the workflow makes reaches Obsidian users with no
further step.

The plugin lived in the DBML Studio repository until it moved here. If the
directory's entry still names that repository, the maintainer points it at
`AKonyshev/obsidian-dbml-studio` at community.obsidian.md before a release made
here can reach anybody through the directory.
