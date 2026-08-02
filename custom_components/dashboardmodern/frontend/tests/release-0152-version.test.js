import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../../manifest.json", import.meta.url);

test("the public corrective release is version 0.14.16", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.version, "0.14.16");
});
