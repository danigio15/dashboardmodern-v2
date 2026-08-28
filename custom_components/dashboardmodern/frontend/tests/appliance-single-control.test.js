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
const stability = await readFile(
  new URL("../src/sections/beta27-release-stability-section.js", import.meta.url),
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

/* Il tasto di accensione lo dimensiona uno solo.
 *
 * Prima erano due: la sezione lo squadrava, e il foglio delle rifiniture — che
 * si rimette apposta per ultimo nella cascata — lo ridimensionava di nuovo con
 * un selettore piu' forte. Finche' i due numeri coincidevano non si vedeva
 * niente; il giorno che uno dei due cambiava, vinceva quello sbagliato. Adesso
 * quel foglio non tocca piu' la sezione Elettrodomestici, e la prova serve a
 * non farcelo tornare. */
test("nessun altro foglio rimette in tondo il tasto che la sezione ha squadrato", () => {
  assert.doesNotMatch(stability, /data-dm-power-toggle/);
  assert.doesNotMatch(stability, /appl-/);
  assert.match(behavior, /\.dm-appliance-power-toggle,[^{]*\{[^}]*[^-]width:\d+px/s);
});

test("a toggle drawn by an earlier build is redrawn, not left showing the word", () => {
  // ensureToggle reuses the button it finds in the card, so a stale one still
  // carries the old text until the icon is written over it.
  assert.match(behavior, /dataset\.dmIcon !== "power"/);
});
