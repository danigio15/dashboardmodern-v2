import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../../manifest.json", import.meta.url), "utf8"),
);

test("the release manifest is versioned correctly", () => {
  assert.equal(manifest.version, "1.0.0-beta.31.1");
});
