import assert from "node:assert/strict";
import test from "node:test";

import { compileInlineScripts } from "./inline-syntax.js";

const shipped = new URL("../legacy/", import.meta.url);

for (const name of ["dashboard.html", "dashboard-en.html"]) {
  test(`${name}: every inline script in the shipped HTML compiles`, () => {
    const count = compileInlineScripts(new URL(name, shipped));
    assert.ok(count >= 4, `expected the complete vendored dashboard, got ${count} blocks`);
  });
}
