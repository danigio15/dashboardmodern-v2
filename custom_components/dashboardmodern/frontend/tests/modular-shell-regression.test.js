import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const legacy = path.resolve(here, "../legacy");

for (const [file, locale] of [
  ["dashboard.html", "it"],
  ["dashboard-en.html", "en"],
]) {
  test(`${file} remains a lightweight modular shell`, () => {
    const html = fs.readFileSync(path.join(legacy, file), "utf8");
    assert.ok(Buffer.byteLength(html) < 150_000, `${file} grew back into a monolith`);
    assert.doesNotMatch(html, /<style(?:\s|>)/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/i);
    assert.match(html, new RegExp(`dashboard-runtime-${locale}\.css`));
    assert.match(html, new RegExp(`dashboard-runtime-${locale}\.js`));
    assert.match(html, /report-mobile-fixes\.js/);
  });
}

test("temporary migration workflows and payloads are absent", () => {
  const root = path.resolve(here, "../../../../..");
  assert.equal(fs.existsSync(path.join(root, ".github/workflows/source-snapshot.yml")), false);
  assert.equal(
    fs.existsSync(path.join(root, ".github/workflows/apply-vendor-test-update.yml")),
    false,
  );
  assert.equal(fs.existsSync(path.join(root, "scripts/update_vendor_tests.py")), false);
});
