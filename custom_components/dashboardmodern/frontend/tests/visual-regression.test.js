import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

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
const cssSnapshots = {
  "animations.css": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
  "base.css": "fa970aadde7eb8abab9810d30752c83029a98a20840f084d97db398d5d110b16",
  "components.css": "94a0b080613493c4910d2e8688c2b363c71978061fd5670177af21fc6424a8db",
  "responsive.css": "c55a48eac52c6e16374133290d132ace51411c80f6f9b44eed1ccdcd12364701",
  "shell.css": "289ea9a1f20049ba82581602379fe5d95a73c26af9c98c4d0f3ee70517dc98a5",
  "tokens.css": "2b0936bbc5ef18d4c6f4a7c1cc5aab24b7b1498abb7f924dcf1d1a1c151b2f36",
};

for (const file of ["dashboard.html", "dashboard-en.html"]) {
  const source = readFileSync(new URL(file, legacy), "utf8");
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

test("global layout CSS files retain byte-for-byte snapshots", () => {
  for (const [file, expected] of Object.entries(cssSnapshots)) {
    const value = readFileSync(new URL(`../src/styles/${file}`, import.meta.url));
    assert.equal(createHash("sha256").update(value).digest("hex"), expected, file);
  }
});
