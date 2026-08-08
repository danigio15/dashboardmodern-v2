import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("appliance editor preview uses the same SVG artwork owner as appliance cards", async () => {
  const editor = await read("src/sections/appliance-editor-section.js");
  const cards = await read("src/sections/appliances-section.js");

  assert.match(editor, /import \{ applianceArtwork \} from "\.\.\/core\/appliance-artwork\.js"/);
  assert.match(editor, /canonicalApplianceVisualKey/);
  assert.match(editor, /function artworkPreview/);
  assert.match(editor, /applianceArtwork\(editorVisualKey\(value\), 72\)/);
  assert.match(editor, /preview\.innerHTML = artworkPreview/);
  assert.doesNotMatch(editor, /preview\.textContent = iconGlyph/);
  assert.match(cards, /applianceArtwork\(kind, 96\)/);
});

test("built-in action editor derives and persists the icon from the selected action type", async () => {
  const source = await read("src/sections/unified-editors-section.js");

  assert.match(source, /const ACTION_TYPES = Object\.freeze/);
  assert.match(source, /\["builtin_luci", "💡"/);
  assert.match(source, /icon\.readOnly = builtin/);
  assert.match(source, /entityField\.hidden = builtin/);
  assert.match(source, /icon: builtin \? actionTypeIcon\(type\)/);
  assert.match(source, /data-action-icon-preview/);
});

test("room and alert editors expose the same visual preview used by their section semantics", async () => {
  const unified = await read("src/sections/unified-editors-section.js");
  const alerts = await read("src/sections/alerts-section.js");

  assert.match(unified, /root\.cdIconMarkup\?\.\(icon, size\)/);
  assert.match(unified, /data-room-icon-preview/);
  assert.match(alerts, /function groupIcon/);
  assert.match(alerts, /data-alert-group-preview/);
  assert.match(alerts, /L’icona dell’avviso segue il gruppo selezionato/);
});
