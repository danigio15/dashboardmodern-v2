import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const manifest = JSON.parse(
  readFileSync("custom_components/dashboardmodern/manifest.json", "utf8"),
);

const buildField = (name, value) =>
  new RegExp(`${name}\\s*:\\s*${JSON.stringify(value).replaceAll(".", "\\.")}`);

test("build info is generated from HEAD and exposes one canonical release version", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const output = join(mkdtempSync(join(tmpdir(), "dm-build-")), "build-info.js");
  execFileSync("python", [
    "scripts/generate_build_info.py",
    "--expected-commit",
    head,
    "--output",
    output,
  ]);
  const source = readFileSync(output, "utf8");
  assert.match(source, new RegExp(head));
  assert.match(source, buildField("integrationVersion", manifest.version));
  assert.match(source, buildField("dashboardVersion", manifest.version));
  assert.doesNotMatch(source, /dashboardVersion\s*:\s*["']0\.14\.0["']/);
  assert.match(source, /moduleVersion\s*:\s*14/);
  assert.match(source, /schemaVersion\s*:\s*4/);
  assert.match(source, /assetHash\s*:\s*["'][a-f0-9]{16}["']/);
});

test("build generation rejects a different expected commit", () => {
  const result = spawnSync(
    "python",
    ["scripts/generate_build_info.py", "--expected-commit", "0".repeat(40)],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /build commit mismatch/);
});
