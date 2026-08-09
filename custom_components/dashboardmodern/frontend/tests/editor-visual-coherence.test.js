import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("appliance Edit uses the same blue SVG owner and catalog as the original Add picker", async () => {
  const editor = await read("src/sections/appliance-editor-section.js");
  const model = await read("src/core/device-model.js");

  assert.match(editor, /APPLIANCE_CATALOG/);
  assert.match(editor, /canonicalApplianceVisualKey/);
  assert.match(editor, /root\.cdApplianceIcon\?\.\(key, size\)/);
  assert.match(editor, /preview\.innerHTML = typeIconMarkup\(canonical, 58\)/);
  assert.match(editor, /button\.innerHTML = typeIconMarkup\(key, 30\)/);
  assert.match(editor, /input type="hidden" name="icon"/);
  assert.doesNotMatch(editor, /<select class="ed-input" name="icon">/);
  assert.match(model, /export const APPLIANCE_CATALOG = Object\.freeze/);
  assert.match(model, /\{ key: "frigo", it: "Frigorifero"/);
  assert.match(model, /\{ key: "robot", it: "Robot aspirapolvere"/);
});

test("built-in action editor derives a default icon but persists a custom choice", async () => {
  const source = await read("src/sections/unified-editors-section.js");

  assert.match(source, /const ACTION_TYPES = Object\.freeze/);
  assert.match(source, /\["builtin_luci", "💡"/);
  assert.match(source, /icon\.readOnly = false/);
  assert.match(source, /entityField\.hidden = builtin/);
  assert.match(source, /icon: clean\(form\.elements\.icon\.value\) \|\| actionTypeIcon\(type\)/);
  assert.match(source, /L’icona è personalizzabile anche per le azioni integrate/);
  assert.doesNotMatch(source, /icon\.readOnly = builtin/);
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
