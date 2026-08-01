import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checklistUrl = new URL("../../../../docs/RELEASE_0.14.12_CHECKLIST.md", import.meta.url);

test("the corrective release documents every reported acceptance point", async () => {
  const source = await readFile(checklistUrl, "utf8");
  for (const term of ["Temperature", "Appliances", "CD_PERIOD", "Report", "branding"]) {
    assert.match(source, new RegExp(term, "i"));
  }
});
