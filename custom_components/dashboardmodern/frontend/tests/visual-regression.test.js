import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readLegacyBundle } from "./legacy-source.js";

const legacy = new URL("../legacy/", import.meta.url);
const expectedTabs = [
  "home",
  "energy",
  "appliances-main",
  "ev",
  "boiler",
  "clima",
  "temp",
  "tapparelle",
  "irrigazione",
  "piscina",
  "security",
  "server",
  "config",
];
/* Le impronte cambiano solo con una modifica voluta al foglio vendorizzato.
 * Questo giro sono due:
 *
 *  - il telefono non decide piu' lui quanto e' grande un carattere. Android
 *    gonfia da solo il testo dentro i contenitori che scorrono in orizzontale,
 *    ed e' per questo che il font delle linguette delle stanze in Temperature
 *    tornava «sballato» ogni volta che lo si rimpiccioliva in CSS;
 *  - le linguette dell'editor stanno in colonna. Erano diciassette voci in una
 *    fila che scorreva, tre visibili per volta: adesso si vedono tutte e il
 *    corpo della scheda si apre accanto invece che sotto. Da telefono tenuto in
 *    piedi la colonna si stringe al simbolo — il nome lo nasconde chi quel
 *    pezzo lo crea — e si riallarga appena il telefono si gira. */
const vendoredCssSnapshots = {
  "dashboard-runtime-it.css": "376764c49898df3d3c0e62642936cdcdc1fe96efecbe9bd9ee828a2b9ac551cc",
  "dashboard-runtime-en.css": "2f3c647a390364d51fefbf2f83b32e094f70f001adf18726d60220d6c2892ffb",
};

for (const file of ["dashboard.html", "dashboard-en.html"]) {
  const source = readLegacyBundle(file);
  test(`${file}: navbar order and structural classes retain their DOM snapshot`, () => {
    const nav = source.match(/<nav class="tabs bottom-nav-bar">([\s\S]*?)<\/nav>/)?.[1] || "";
    assert.deepEqual(
      [...nav.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]),
      expectedTabs,
    );
    for (const token of [
      "tab active",
      "icon",
      "text",
      "page active",
      "weather-widget",
      "cam-card",
      "appl-wide-card",
    ])
      assert.match(source, new RegExp(`class="[^"]*${token}`));
  });
  test(`${file}: Lights has assignment/reorder but no room lifecycle controls`, () => {
    const editor = source.slice(
      source.indexOf("function editorRenderLuci"),
      source.indexOf("function cdLuciAddRoom"),
    );
    assert.match(editor, /cdLuciSetRoom/);
    assert.match(editor, /cdLuciMove/);
    assert.doesNotMatch(
      editor,
      /ed-new-luci-room|cdLuciRenameRoom|cdLuciDeleteRoom|cdLuciAddRoom\(/,
    );
  });
  test(`${file}: canonical CRUD branches do not write legacy storage`, () => {
    for (const functionName of ["edApplSave", "edApplDel", "dmSaveCameras"]) {
      const start = source.indexOf(`function ${functionName}`);
      const body = source.slice(start, source.indexOf("\n}", start) + 2);
      const canonical = body.match(/if\(store\)\{?([\s\S]*?)(?:return;?|\}\s*else)/)?.[1] || "";
      assert.doesNotMatch(canonical, /localStorage\.(?:setItem|removeItem)/, functionName);
    }
  });
}

test("language-specific vendored layout styles retain byte-for-byte snapshots", () => {
  for (const [file, expected] of Object.entries(vendoredCssSnapshots)) {
    const value = readFileSync(new URL(`../legacy/${file}`, import.meta.url));
    assert.equal(createHash("sha256").update(value).digest("hex"), expected, file);
  }
});

test("shared legacy CSS does not own appliance card geometry", () => {
  const source = readFileSync(new URL("../legacy/dashboard-runtime.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-page-grid/);
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-wide-card/);
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-ic/);
  assert.doesNotMatch(source, /\.appl-action-btn\s*\{/);
});
