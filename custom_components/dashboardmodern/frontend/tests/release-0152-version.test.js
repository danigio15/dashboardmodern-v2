import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../../manifest.json", import.meta.url);
const readmeUrl = new URL("../../../../README.md", import.meta.url);
const rootIconUrl = new URL("../../../../brand/icon.png", import.meta.url);
const rootLogoUrl = new URL("../../../../brand/logo.png", import.meta.url);
const productionEntryUrl = new URL("../legacy/report-mobile-fixes.js", import.meta.url);

test("the real UI hotfix release is consistently versioned as 0.15.3", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const readme = await readFile(readmeUrl, "utf8");

  assert.equal(manifest.version, "0.15.3");
  assert.match(readme, /version-0\.15\.3/);
  assert.match(readme, /Release 0\.15\.3/);
  assert.doesNotMatch(readme, /version-0\.14\.15|Release 0\.14\.15|Novità 0\.14\.15/);
  assert.match(
    readme,
    /https:\/\/raw\.githubusercontent\.com\/danigio15\/dashboardmodern-v2\/main\/assets\/logo@2x\.png/,
  );
});

test("HACS root brand assets are shipped", async () => {
  for (const url of [rootIconUrl, rootLogoUrl]) {
    const details = await stat(url);
    assert.ok(details.isFile());
    assert.ok(details.size > 1_000);
  }
});

test("the production entry reuses canonical modules instead of numbered owners", async () => {
  const source = await readFile(productionEntryUrl, "utf8");
  assert.match(source, /src\/core\/appliance-artwork\.js/);
  assert.doesNotMatch(source, /release-\d{4}[^"']*\.js/);
  assert.doesNotMatch(source, /new MutationObserver|setInterval\s*\(/);
});
