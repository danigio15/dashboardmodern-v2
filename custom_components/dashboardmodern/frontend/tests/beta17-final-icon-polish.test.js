// DM-FIX-20260813A
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ROOM_ICON_CHOICES,
  actionPickerGlyph,
  isTemperatureProgressText,
} from "../src/sections/beta17-final-icon-polish-section.js";

test("beta17 removes the meaningless Temperature progress copy", () => {
  assert.equal(isTemperatureProgressText("AGGIORNAMENTO IN CORSO..."), true);
  assert.equal(isTemperatureProgressText("Aggiornamento in corso…"), true);
  assert.equal(isTemperatureProgressText("Update in progress..."), true);
  assert.equal(isTemperatureProgressText("Temperatura"), false);
});

test("beta17 renders action choices as direct colour glyphs and shares one room palette", () => {
  assert.equal(actionPickerGlyph("mdi:home"), "🏠");
  assert.equal(actionPickerGlyph("mdi:lightbulb"), "💡");
  assert.ok(ROOM_ICON_CHOICES.some(([icon]) => icon === "🛏️"));
  assert.ok(ROOM_ICON_CHOICES.some(([icon]) => icon === "🏠"));
  assert.ok(ROOM_ICON_CHOICES.some(([icon]) => icon === "🏊"));
});

test("beta17 loads before beta-entry and owns both insert/edit picker activation paths", async () => {
  const generator = await readFile(
    new URL("../../../../scripts/generate_build_info.py", import.meta.url),
    "utf8",
  );
  const source = await readFile(
    new URL("../src/sections/beta17-final-icon-polish-section.js", import.meta.url),
    "utf8",
  );
  const beta17 = generator.indexOf("beta17-final-icon-polish-section.js");
  const betaEntry = generator.indexOf("beta-entry-section.js");
  assert.ok(beta17 >= 0, "beta17 import is generated");
  assert.ok(betaEntry > beta17, "beta17 capture owner loads before beta-entry legacy handlers");
  assert.match(source, /\.dm-beta5-room-icon-trigger/);
  assert.match(source, /#dm-room-editor-modal \[data-room-icon-preview\]/);
  assert.match(source, /#dm-action-editor-modal \[data-action-icon-preview\]/);
  assert.match(source, /dm-beta17-room-picker/);
  assert.match(source, /dm-beta17-action-picker/);
  assert.match(source, /MutationObserver/);
});
