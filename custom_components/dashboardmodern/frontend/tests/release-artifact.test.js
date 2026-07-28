import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("HACS release artifact contains generated provenance for its exact HEAD", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const archive = join(mkdtempSync(join(tmpdir(), "dm-release-")), "dashboardmodern.zip");
  execFileSync("python", [
    "scripts/build_release.py",
    "--expected-commit",
    head,
    "--output",
    archive,
  ]);
  const buildInfo = execFileSync(
    "python",
    [
      "-c",
      "import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).read('custom_components/dashboardmodern/frontend/legacy/build-info.js').decode())",
      archive,
    ],
    { encoding: "utf8" },
  );
  const manifest = execFileSync(
    "python",
    [
      "-c",
      "import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).read('custom_components/dashboardmodern/manifest.json').decode())",
      archive,
    ],
    { encoding: "utf8" },
  );
  assert.match(buildInfo, /"generated":true/);
  assert.match(buildInfo, new RegExp(`"commit":"${head}"`));
  assert.doesNotMatch(buildInfo, /UNBUILT/);
  assert.match(buildInfo, /"assetHash":"[a-f0-9]{16}"/);
  assert.equal(JSON.parse(manifest).version, "0.14.0");
});
