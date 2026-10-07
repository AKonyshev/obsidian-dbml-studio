/**
 * @jest-environment node
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "build-plugin.mjs");

/** A frame as `vendor-frame.mjs` leaves it, past ASCII so encoding shows. */
const HTML = "<!doctype html><title>frame — café</title>";
const BUILD = "v1.2.3-4-gabc1234\n";

let work = "";

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), "build-plugin-"));
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

const makeFrame = (files: Record<string, string>): string => {
  const frame = path.join(work, "frame");

  mkdirSync(frame);

  for (const [name, text] of Object.entries(files)) {
    writeFileSync(path.join(frame, name), text);
  }

  return frame;
};

const build = (
  frame: string,
  outfile = path.join(work, "main.js"),
): SpawnSyncReturns<string> =>
  spawnSync(
    process.execPath,
    [SCRIPT, "--frame", frame, "--outfile", outfile],
    { encoding: "utf8" },
  );

/** The gzipped frame main.js carries, as the base64 text it is written in. */
const packedFrame = (bundle: string): string =>
  // Every gzip stream starts 1f 8b 08, which base64 spells "H4sI".
  /"(H4sI[A-Za-z0-9+/=]+)"/.exec(bundle)?.[1] ?? "";

describe("build-plugin.mjs", () => {
  // The Community plugins directory installs main.js, manifest.json and
  // styles.css: a frame that is not inside main.js is not installed at all.
  it("carries the frame inside main.js, gzipped", () => {
    const result = build(makeFrame({ "embed.html": HTML, BUILD }));

    expect(result.status).toBe(0);

    const packed = packedFrame(
      readFileSync(path.join(work, "main.js"), "utf8"),
    );

    expect(packed).not.toBe("");
    expect(gunzipSync(Buffer.from(packed, "base64")).toString("utf8")).toBe(
      HTML,
    );
  });

  // The directory rebuilds main.js from the tagged source, on a Node of its
  // own choosing, and compares it with the released one. Two builds of the
  // same frame are the same bytes, and the packed frame is the one pinned
  // here: a gzip stamped with the time of the build, or packed by another
  // deflate, changes the hash, and this fails before a release does.
  it("packs the same frame to the same bytes, every time", () => {
    const frame = makeFrame({ "embed.html": HTML, BUILD });
    const first = path.join(work, "first.js");
    const second = path.join(work, "second.js");

    expect(build(frame, first).status).toBe(0);
    expect(build(frame, second).status).toBe(0);
    expect(readFileSync(second)).toEqual(readFileSync(first));

    const packed = packedFrame(readFileSync(first, "utf8"));

    expect(createHash("sha256").update(packed).digest("hex")).toBe(
      "fda33fcf008ebe93e4aa0af60896ec0cc8b3b62ec614b8cf22df46ef685ba1c4",
    );
  });

  it("carries the frame's BUILD exactly as written", () => {
    expect(build(makeFrame({ "embed.html": HTML, BUILD })).status).toBe(0);

    expect(readFileSync(path.join(work, "main.js"), "utf8")).toContain(
      JSON.stringify(BUILD),
    );
  });

  it("refuses to build without a frame, and says what comes first", () => {
    const result = build(path.join(work, "frame"));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path.join(work, "frame", "embed.html"));
    expect(result.stderr).toContain("npm run build");
  });

  it("refuses a frame without its BUILD, by name", () => {
    const result = build(makeFrame({ "embed.html": HTML }));

    expect(result.status).toBe(1);
    // The script's own sentence, not a stack trace from reading it anyway.
    expect(result.stderr).toContain(
      `build-plugin: no ${path.join(work, "frame", "BUILD")}`,
    );
  });
});
