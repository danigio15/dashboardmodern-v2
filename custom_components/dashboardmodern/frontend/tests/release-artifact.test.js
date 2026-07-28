import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("HACS release artifact has root integration layout and exact provenance", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const archive = join(mkdtempSync(join(tmpdir(), "dm-release-")), "dashboardmodern.zip");
  execFileSync("python", [
    "scripts/build_release.py",
    "--expected-commit",
    head,
    "--output",
    archive,
  ]);
  const names = JSON.parse(
    execFileSync(
      "python",
      [
        "-c",
        "import json,sys,zipfile;print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))",
        archive,
      ],
      { encoding: "utf8" },
    ),
  );
  const readArchive = (path) =>
    execFileSync(
      "python",
      [
        "-c",
        "import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())",
        archive,
        path,
      ],
      { encoding: "utf8" },
    );

  assert.ok(names.includes("__init__.py"));
  assert.ok(names.includes("manifest.json"));
  assert.ok(names.includes("frontend/legacy/build-info.js"));
  assert.equal(names.some((name) => name.startsWith("custom_components/")), false);

  const buildInfo = readArchive("frontend/legacy/build-info.js");
  const manifest = JSON.parse(readArchive("manifest.json"));
  const sourceManifest = JSON.parse(
    readFileSync("custom_components/dashboardmodern/manifest.json", "utf8"),
  );

  assert.match(buildInfo, /"generated":true/);
  assert.match(buildInfo, new RegExp(`"commit":"${head}"`));
  assert.doesNotMatch(buildInfo, /UNBUILT/);
  assert.match(buildInfo, /"assetHash":"[a-f0-9]{16}"/);
  assert.equal(manifest.version, sourceManifest.version);
});
