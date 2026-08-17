import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(
  new URL("../src/sections/appliance-layout-section.js", import.meta.url),
  "utf8",
);
const behavior = await readFile(
  new URL("../src/sections/appliances-section.js", import.meta.url),
  "utf8",
);

test("appliance layout never hides an action by DOM position", () => {
  assert.doesNotMatch(layout, /\.appl-action-btn:first-child/);
  assert.doesNotMatch(layout, /:has\(\[data-dm-power-toggle/);
});

test("appliance behavior hides only the legacy power action and preserves History", () => {
  assert.match(behavior, /hideLegacyPowerOnly/);
  assert.match(behavior, /storico\|history/i);
  assert.match(behavior, /restoreLegacyActions/);
});

test("the power toggle draws a glyph, and its wording survives as the accessible name", () => {
  // "Spegni" did not fit the card on a phone and was clipped mid-word against
  // the History button, so nothing may write the label back as visible text.
  assert.doesNotMatch(behavior, /setText\(button, model\.action\.label\)/);
  assert.match(behavior, /button\.innerHTML = POWER_ICON/);
  // Losing the word entirely would leave an unlabelled control.
  assert.match(behavior, /setAttribute\("aria-label", model\.action\.label\)/);
  assert.match(behavior, /setAttribute\("title", model\.action\.label\)/);
});

test("the power toggle is sized for its glyph, not for the widest label", () => {
  // The 88px floor existed only to fit the word, and it is what pushed the
  // button into the control beside it.
  assert.doesNotMatch(behavior, /min-width:88px/);
  assert.match(behavior, /\.dm-appliance-power-toggle svg/);
});

test("a toggle drawn by an earlier build is redrawn, not left showing the word", () => {
  // ensureToggle reuses the button it finds in the card, so a stale one still
  // carries the old text until the icon is written over it.
  assert.match(behavior, /dataset\.dmIcon !== "power"/);
});
