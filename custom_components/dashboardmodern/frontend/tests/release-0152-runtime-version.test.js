import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const versionUrl = new URL("../legacy/release-0152-version.js", import.meta.url);

test("runtime version marker identifies 0.14.12", async () => {
  const source = await readFile(versionUrl, "utf8");
  assert.match(source, /0\.14\.12/);
});
