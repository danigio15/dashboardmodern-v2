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
    /* Un solo <style> e' ammesso, ed e' quello critico del velo d'avvio: i
     * fogli grandi si caricano senza bloccare, quindi il velo deve potersi
     * dipingere PRIMA che arrivino — e uno stile che deve dipingersi prima
     * dei fogli non puo' stare in un foglio. Resta un velo, non un vestito:
     * piccolo, e con quel nome. Tutto il resto degli stili vive fuori. */
    const stili = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/gi)];
    assert.equal(stili.length, 1, `${file}: gli stili vivono nei fogli, non nella pagina`);
    assert.match(stili[0][1], /id="dm-avvio-critico"/);
    assert.ok(stili[0][2].length < 3000, `${file}: lo stile del velo sta ingrassando`);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/i);
    assert.ok(html.includes(`dashboard-runtime-${locale}.css`));
    assert.ok(html.includes(`dashboard-runtime-${locale}.js`));
    assert.ok(html.includes("modules-entry.js"));
  });
}

test("temporary migration workflows and payloads are absent", () => {
  const root = path.resolve(here, "../../../..");
  assert.equal(fs.existsSync(path.join(root, ".github/workflows/source-snapshot.yml")), false);
  assert.equal(
    fs.existsSync(path.join(root, ".github/workflows/apply-vendor-test-update.yml")),
    false,
  );
  assert.equal(fs.existsSync(path.join(root, "scripts/update_vendor_tests.py")), false);
});
