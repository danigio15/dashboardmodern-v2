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
 * Questo giro: .sub-tab-btn eredita il font del documento, perche' un <button>
 * non lo fa da solo e le pillole delle stanze uscivano nel font di sistema. */
const vendoredCssSnapshots = {
  "dashboard-runtime-it.css": "d344fab1b44b791ccede567172784c5badc96d4e5489ad0c96275cf941491caa",
  "dashboard-runtime-en.css": "2dfe8778726520c4626ceb09a1a390ced68f8187492a8c628afe993607c07439",
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
