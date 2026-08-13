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

test("beta17 renders action choices as direct colour glyphs and shares one canonical room palette", () => {
  assert.equal(actionPickerGlyph("mdi:home"), "🏠");
  assert.equal(actionPickerGlyph("mdi:lightbulb"), "💡");
  assert.ok(ROOM_ICON_CHOICES.some(([icon]) => icon === "🛏️"));
  assert.ok(ROOM_ICON_CHOICES.some(([icon]) => icon === "🏠"));
  assert.ok(ROOM_ICON_CHOICES.some(([icon]) => icon === "🏊"));
  assert.ok(ROOM_ICON_CHOICES.length >= 20);
});

test("beta18 moves picker ownership to the canonical icon engine", async () => {
  const generator = await readFile(
    new URL("../../../../scripts/generate_build_info.py", import.meta.url),
    "utf8",
  );
  const betaEntry = await readFile(new URL("../src/sections/beta-entry-section.js", import.meta.url), "utf8");
  const beta17 = await readFile(
    new URL("../src/sections/beta17-final-icon-polish-section.js", import.meta.url),
    "utf8",
  );
  const engine = await readFile(new URL("../src/sections/icon-engine-section.js", import.meta.url), "utf8");
  assert.ok(generator.includes("beta17-final-icon-polish-section.js"));
  assert.match(betaEntry, /icon-engine-section\.js/);
  assert.match(engine, /modal\.id = "dm-visual-picker"/);
  assert.match(engine, /\.dm-beta5-room-icon-trigger/);
  assert.match(engine, /\.dm-beta6-qa-icon-trigger/);
  assert.match(engine, /data-dm-icon-engine/);
  assert.doesNotMatch(beta17, /openStableRoomPicker|openStableActionPicker|queuePreviewRepair/);
  assert.doesNotMatch(beta17, /dm-visual-picker/);
});
