import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../../manifest.json", import.meta.url);

test("the real Home Assistant hotfix release is version 0.15.1", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.version, "0.15.1");
});
