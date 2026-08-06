import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { compileInlineScripts } from "./inline-syntax.js";
import { legacyAssetUrl, readLegacyHtml } from "./legacy-source.js";

for (const [name, locale] of [
  ["dashboard.html", "it"],
  ["dashboard-en.html", "en"],
]) {
  test(`${name}: shipped HTML is a shell and external classic scripts compile`, () => {
    assert.equal(compileInlineScripts(legacyAssetUrl(name)), 0);
    const html = readLegacyHtml(name);
    const localScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+\.js)["'][^>]*><\/script>/gi)]
      .map((match) => match[1]);
    assert.ok(localScripts.includes(`dashboard-runtime-${locale}.js`));
    assert.ok(localScripts.includes(`dashboard-watchdog-${locale}.js`));
    for (const file of localScripts) {
      const source = readFileSync(legacyAssetUrl(file), "utf8");
      if (/\btype=["']module["']/.test(html)) continue;
      new vm.Script(source, { filename: file });
    }
  });
}
