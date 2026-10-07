/**
 * @jest-environment node
 */
import {
  execFileSync,
  spawnSync,
  type SpawnSyncReturns,
} from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Only what needs no network and changes nothing: the arguments, and each
// refusal that comes before the build. The scripts are run from copies inside
// a throwaway repository whose `origin` is a local bare one, so `main`, a
// clean tree and "equal to origin/main" can each be arranged — and broken —
// here. The release itself is the workflow's, and of the workflow only its
// text is checked.
const ROOT = path.join(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "release-github.sh");
const CHECKS = path.join(ROOT, "scripts", "release-checks.sh");
const WORKFLOW = path.join(ROOT, ".github", "workflows", "release.yml");

const MANIFEST = {
  id: "dbml-studio",
  name: "DBML Studio",
  version: "0.2.0",
  minAppVersion: "1.13.7",
  description: "Draws diagrams.",
  author: "AKonyshev",
  isDesktopOnly: true,
};

const CHANGELOG = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "- Not out yet.",
  "",
  "## [0.2.0] - 2026-10-06",
  "",
  "### Added",
  "",
  "- Something.",
  "",
  "## [0.1.0] - 2026-09-29",
  "",
  "- The first one.",
  "",
].join("\n");

let work = "";

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), "release-github-"));
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

/**
 * The environment with every `GIT_*` variable taken out. Under the pre-commit
 * hook git exports GIT_DIR, GIT_INDEX_FILE and others naming the repository
 * being committed to, and a `git init` or `git add` that inherits them acts
 * on that repository instead of the throwaway one — an early version of this
 * test marked the real repository bare that way. Nothing git runs here, or in
 * the script under test, may see them.
 */
const isolatedEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(process.env)) {
    // And a frame from a local checkout, should the shell running the tests
    // name one: the script refuses to release with it.
    if (!name.startsWith("GIT_") && name !== "DBML_FRAME_SOURCE") {
      env[name] = value;
    }
  }

  return {
    ...env,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    // No global or system config: a user's hooks or templates stay out.
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  };
};

const git = (cwd: string, ...args: string[]): string => {
  // A last guard: every repository this test touches is under `work`.
  if (!cwd.startsWith(work) || work === "") {
    throw new Error(`refusing to run git outside the test's folder: ${cwd}`);
  }

  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: isolatedEnv(),
  });
};

interface RepoOptions {
  manifest?: Record<string, unknown>;
  versions?: Record<string, string>;
}

/**
 * Both scripts, and the files they read, in `dir`: release-github.sh calls
 * release-checks.sh beside it.
 */
const writeReleaseFiles = (dir: string, options: RepoOptions = {}): void => {
  const scripts = path.join(dir, "scripts");

  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, path.join(scripts, "release-github.sh"));
  copyFileSync(CHECKS, path.join(scripts, "release-checks.sh"));
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(options.manifest ?? MANIFEST),
  );
  writeFileSync(
    path.join(dir, "versions.json"),
    JSON.stringify(options.versions ?? { "0.2.0": "1.13.7" }),
  );
  writeFileSync(path.join(dir, "CHANGELOG.md"), CHANGELOG);
};

/** A repository on `main`, clean, pushed to its `origin`. */
const makeRepo = (options: RepoOptions = {}): string => {
  const origin = path.join(work, "origin.git");
  const repo = path.join(work, "repo");

  git(work, "init", "--quiet", "--bare", "--initial-branch=main", origin);
  git(work, "init", "--quiet", "--initial-branch=main", repo);
  writeReleaseFiles(repo, options);
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "-m", "init");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "--quiet", "origin", "main");

  return repo;
};

/**
 * The script copied into a folder that is no repository at all, for the
 * argument tests: should one of them get past the arguments, the git it runs
 * has no repository to act on — not even this one.
 */
const looseScript = (): string => {
  const scripts = path.join(work, "loose", "scripts");

  mkdirSync(scripts, { recursive: true });
  copyFileSync(SCRIPT, path.join(scripts, "release-github.sh"));
  copyFileSync(CHECKS, path.join(scripts, "release-checks.sh"));

  return path.join(scripts, "release-github.sh");
};

const releaseWith = (
  extraEnv: NodeJS.ProcessEnv,
  repo: string | null,
  ...args: string[]
): SpawnSyncReturns<string> =>
  spawnSync(
    "bash",
    [
      repo === null
        ? looseScript()
        : path.join(repo, "scripts", "release-github.sh"),
      ...args,
    ],
    { encoding: "utf8", input: "", env: { ...isolatedEnv(), ...extraEnv } },
  );

const release = (
  repo: string | null,
  ...args: string[]
): SpawnSyncReturns<string> => releaseWith({}, repo, ...args);

describe("release-github.sh, its arguments", () => {
  it("says how it is used with --help, and does nothing", () => {
    const result = release(null, "--help");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release:github");
    expect(result.stdout).toContain("--check");
  });

  it("refuses to run without a version", () => {
    const result = release(null);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage");
  });

  it("refuses an option it does not know", () => {
    const result = release(null, "0.2.0", "--force");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--force");
  });

  // The directory wants the tag to be exactly the version: x.y.z, no "v".
  it("refuses a version that is not x.y.z", () => {
    const result = release(null, "v0.2.0");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("v0.2.0");
  });

  it("refuses two versions", () => {
    const result = release(null, "0.2.0", "0.3.0");

    expect(result.status).toBe(2);
  });
});

describe("release-github.sh, before it builds anything", () => {
  it("refuses off main", () => {
    const repo = makeRepo();

    git(repo, "checkout", "--quiet", "-b", "feature");

    const result = release(repo, "0.2.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("main");
    expect(result.stderr).toContain("feature");
  });

  it("refuses a tree with changes in it", () => {
    const repo = makeRepo();

    writeFileSync(path.join(repo, "stray.txt"), "left over");

    const result = release(repo, "0.2.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("stray.txt");
  });

  it("refuses a main that is not origin/main", () => {
    const repo = makeRepo();

    git(repo, "commit", "--quiet", "--allow-empty", "-m", "unpushed");

    const result = release(repo, "0.2.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("origin/main");
  });

  it("refuses a version the manifest does not have", () => {
    const repo = makeRepo();
    const result = release(repo, "0.3.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("manifest.json");
    expect(result.stderr).toContain("0.2.0");
  });

  it("refuses a version versions.json does not list", () => {
    const repo = makeRepo({ versions: { "0.1.0": "1.5.0" } });
    const result = release(repo, "0.2.0", "--check");

    expect(result.status).toBe(1);
    // Says what to add, not only that something is wrong.
    expect(result.stderr).toContain(
      'versions.json has no 0.2.0; add "0.2.0": "1.13.7"',
    );
  });

  it("refuses a versions.json that names another minAppVersion", () => {
    const repo = makeRepo({ versions: { "0.2.0": "1.5.0" } });
    const result = release(repo, "0.2.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("1.13.7");
  });

  it("refuses a version the changelog has no entry for", () => {
    const repo = makeRepo({
      manifest: { ...MANIFEST, version: "0.4.0" },
      versions: { "0.4.0": "1.13.7" },
    });
    const result = release(repo, "0.4.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CHANGELOG.md");
  });

  it("refuses a version already tagged", () => {
    const repo = makeRepo();

    git(repo, "tag", "0.2.0");

    const result = release(repo, "0.2.0", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("already");
  });

  // A frame from a local checkout of DBML Studio is for trying out; what is
  // released is the pinned package's, which the workflow rebuilds.
  it("refuses to release with DBML_FRAME_SOURCE set", () => {
    const repo = makeRepo();
    const result = releaseWith(
      { DBML_FRAME_SOURCE: path.join(work, "dbml-studio") },
      repo,
      "0.2.0",
      "--check",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DBML_FRAME_SOURCE is set");
  });

  // As for scripts/vendor-frame.mjs, an empty one names no source. Off main,
  // so that the refusal after it stops the script before any build.
  it("takes an empty DBML_FRAME_SOURCE for unset", () => {
    const repo = makeRepo();

    git(repo, "checkout", "--quiet", "-b", "feature");

    const result = releaseWith(
      { DBML_FRAME_SOURCE: "" },
      repo,
      "0.2.0",
      "--check",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("DBML_FRAME_SOURCE");
    expect(result.stderr).toContain("release from main, not from feature");
  });

  // The release is the workflow's now: the script tags, and attaches nothing.
  it("creates no release and builds no zip", () => {
    const script = readFileSync(SCRIPT, "utf8");

    expect(script).not.toContain("gh release");
    expect(script).not.toContain(".zip");
    expect(script).not.toContain("package-obsidian-plugin");
  });
});

/** release-checks.sh, copied with the files it reads into a folder of its own. */
const checksDir = (options: RepoOptions = {}): string => {
  const dir = path.join(work, "checks");

  writeReleaseFiles(dir, options);

  return dir;
};

const checks = (dir: string, ...args: string[]): SpawnSyncReturns<string> =>
  spawnSync("bash", [path.join(dir, "scripts", "release-checks.sh"), ...args], {
    cwd: dir,
    encoding: "utf8",
    env: isolatedEnv(),
  });

describe("release-checks.sh, a version", () => {
  it("accepts a version the manifest, versions.json and changelog agree on", () => {
    const result = checks(checksDir(), "0.2.0");

    expect(result.status).toBe(0);
  });

  // The release's notes are the version's section, its heading left out, and
  // neither the unreleased section above it nor the older one below.
  it("writes the version's changelog section to --notes", () => {
    const dir = checksDir();
    const result = checks(dir, "0.2.0", "--notes", "notes.md");

    expect(result.status).toBe(0);
    expect(readFileSync(path.join(dir, "notes.md"), "utf8")).toBe(
      ["", "### Added", "", "- Something.", ""].join("\n"),
    );
  });

  it("writes no notes for a version it refuses", () => {
    const dir = checksDir();
    const result = checks(dir, "0.3.0", "--notes", "notes.md");

    expect(result.status).toBe(1);
    expect(existsSync(path.join(dir, "notes.md"))).toBe(false);
  });

  it("refuses a version that is not x.y.z", () => {
    const result = checks(checksDir(), "0.2");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("x.y.z");
  });

  it("refuses --notes without a file", () => {
    const result = checks(checksDir(), "0.2.0", "--notes");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--notes");
  });
});

describe("release-checks.sh --built", () => {
  const FRAME_BUILD = "v1.2.3-4-gabc1234\n";

  /**
   * A main.js of `size` bytes, carrying the frame's BUILD or not, beside an
   * installed dbml-frame whose BUILD is `packageBuild` (none when null).
   */
  const built = (
    size: number,
    carriesBuild: boolean,
    packageBuild: string | null = FRAME_BUILD,
  ): string => {
    const dir = checksDir();
    const head = carriesBuild
      ? `var DBML_FRAME_BUILD = ${JSON.stringify(FRAME_BUILD)};\n`
      : 'var DBML_FRAME_BUILD = "another";\n';

    if (packageBuild !== null) {
      const pkg = path.join(dir, "node_modules", "dbml-frame");

      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        path.join(pkg, "package.json"),
        JSON.stringify({ name: "dbml-frame", version: "1.2.3" }),
      );
      writeFileSync(path.join(pkg, "BUILD"), packageBuild);
    }

    mkdirSync(path.join(dir, "frame"));
    writeFileSync(path.join(dir, "frame", "BUILD"), FRAME_BUILD);
    writeFileSync(
      path.join(dir, "main.js"),
      head + "/".repeat(Math.max(0, size - head.length)),
    );

    return dir;
  };

  it("accepts a main.js that carries the frame", () => {
    const result = checks(built(1_000_000, true), "--built");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("v1.2.3-4-gabc1234");
  });

  it("refuses a main.js too small to carry the frame", () => {
    const result = checks(built(999_999, true), "--built");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("too small to carry the frame");
  });

  // Big enough, but of another frame: the BUILD string is the proof.
  it("refuses a main.js without the frame's BUILD", () => {
    const result = checks(built(2_000_000, false), "--built");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "main.js does not carry the frame of build v1.2.3-4-gabc1234",
    );
  });

  // DBML_FRAME_SOURCE vendors a frame from a local checkout; its BUILD is
  // not the pinned package's, and a release does not ship it.
  it("refuses a frame that is not the installed dbml-frame's", () => {
    const result = checks(
      built(2_000_000, true, "v9.9.9-1-gfeed123\n"),
      "--built",
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "frame/BUILD is v1.2.3-4-gabc1234, but the installed dbml-frame is v9.9.9-1-gfeed123",
    );
  });

  it("refuses when dbml-frame is not installed", () => {
    const result = checks(built(2_000_000, true, null), "--built");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dbml-frame is not installed");
  });

  it("refuses, naming it, a main.js not built", () => {
    const dir = checksDir();
    const result = checks(dir, "--built");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path.join(dir, "main.js"));
    expect(result.stderr).toContain("npm run build");
  });
});

describe("the release workflow", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");

  /** A top-level key's block, comments and blank lines out. */
  const block = (key: string): string[] => {
    const lines = workflow.split("\n");
    const start = lines.indexOf(`${key}:`);
    const end = lines.findIndex(
      (line, index) => index > start && /^[a-z]/.test(line),
    );

    return lines
      .slice(start + 1, end === -1 ? undefined : end)
      .map((line) => line.replace(/\s+#.*$|^\s*#.*$/, ""))
      .filter((line) => line.trim() !== "");
  };

  // The tag is the bare version the directory reads. A branch push, a pull
  // request or a "v" tag releases nothing.
  it("runs for bare-version tags and nothing else", () => {
    expect(block("on")).toEqual([
      "  push:",
      '    tags: ["[0-9]+.[0-9]+.[0-9]+"]',
    ]);
  });

  const PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"];

  // The directory installs these three and reports any other file on a
  // release as unsupported: the zip it once carried among them.
  it("attaches main.js, manifest.json and styles.css, and nothing else", () => {
    const create = /gh release create[^\n]*(?:\n {10}[^\n]*)*/.exec(workflow);
    const command = create?.[0].replace(/\s+/g, " ").trim() ?? "";
    const files = command.split(" --notes-file notes.md ")[1]?.split(" ");

    expect(files).toEqual(PLUGIN_FILES);
    expect(workflow).not.toContain(".zip");
  });

  // The directory asks for an attestation on each file it installs: a file
  // released but not attested is reported as missing one.
  it("attests exactly the files it releases", () => {
    const lines = workflow.split("\n");
    const start = lines.findIndex((line) => line.trim() === "subject-path: |");
    const indent = start === -1 ? 0 : lines[start].search(/\S/);
    const paths: string[] = [];

    for (const line of start === -1 ? [] : lines.slice(start + 1)) {
      if (line.trim() === "" || line.search(/\S/) <= indent) break;
      paths.push(line.trim());
    }

    expect(paths).toEqual(PLUGIN_FILES);
  });

  // The main-only guard needs origin/main in the checkout, which only the
  // whole history brings; without it every release would be refused.
  it("refuses a tag whose commit is not on main", () => {
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain(
      'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
    );
  });

  // The token may write to the repository; left in .git/config, every
  // install script and test could use it. And a release builds from what it
  // installs itself, not from another run's cache.
  it("leaves no credentials in the checkout and restores no cache", () => {
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/^\s*cache:/m);
  });

  // The repository's releases are all the plugin's, so unlike in the
  // monorepo, where the extension's own release is the one "latest" names,
  // there is nothing here for the plugin's to step aside for.
  it("does not mark the release as not latest: latest here is the plugin", () => {
    expect(workflow).not.toContain("--latest=false");
  });

  // A tag can be moved to other code; a commit cannot. The comment names the
  // release the commit is, for the reader and for whoever updates it.
  it("pins every action to a commit", () => {
    const uses = [...workflow.matchAll(/uses:\s*(\S+)(.*)$/gm)];

    expect(uses.length).toBeGreaterThan(0);

    for (const [, action, rest] of uses) {
      expect(action).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
      expect(rest).toMatch(/^ # v\d+\.\d+\.\d+$/);
    }
  });
});
