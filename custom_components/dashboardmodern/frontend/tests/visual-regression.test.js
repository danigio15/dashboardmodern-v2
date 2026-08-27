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
 *    pezzo lo crea — e si riallarga appena il telefono si gira;
 *  - tutte le finestre della plancia hanno una veste sola: erano nate una alla
 *    volta e si vedeva — un anello bianco cucito nel bordo che sul tema scuro
 *    faceva da taglio, un'entrata lunga mezzo secondo, e un tasto di chiusura
 *    che pesava piu' del titolo. */
const vendoredCssSnapshots = {
  "dashboard-runtime-it.css": "4006d424e4bb452981ec408a24d168b98bdd5d6f1f3943283b8809bcf1e781b6",
  "dashboard-runtime-en.css": "da68e488bad4d1da52a2b7dd5b22e828653093c0ac0c66945715c86680ca3390",
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
