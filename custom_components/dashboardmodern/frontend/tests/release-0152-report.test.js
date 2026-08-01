import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixesUrl = new URL("../legacy/release-0150-fixes.js", import.meta.url);

test("the packaged Report runtime still decorates appliance previews", async () => {
  const source = await readFile(fixesUrl, "utf8");
  assert.match(source, /dm-report-icon-preview/);
  assert.match(source, /mdiGlyph/);
  assert.match(source, /object-fit:contain/);
});
