/* The Gestione Luci popup: what each light is given to control it with, and
 * who owns the paint. The controls are built from the entity's own
 * capabilities, so these assertions are about a dimmer having a dimmer and a
 * relay not being offered a colour wheel it would reject. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { lightView } from "../src/core/light-model.js";
import {
  renderLightControlMarkup,
  renderLightsPopupMarkup,
} from "../src/sections/lights-scene-section.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const scene = await read("../src/sections/lights-scene-section.js");
const editor = await read("../src/sections/lights-alerts-section.js");
const runtime = await read("../src/sections/section-runtime.js");

const strip = lightView("light.strip", {
  name: "Strip TV",
  room: "Salone",
  state: {
    state: "on",
    attributes: {
      supported_color_modes: ["hs", "color_temp"],
      color_mode: "hs",
      brightness: 128,
      rgb_color: [255, 0, 0],
      min_color_temp_kelvin: 2202,
      max_color_temp_kelvin: 6535,
      effect_list: ["Arcobaleno", "Fuoco"],
      effect: "Fuoco",
    },
  },
});
const spots = lightView("light.faretti", {
  name: "Faretti",
  room: "Salone",
  state: { state: "on", attributes: { supported_color_modes: ["brightness"], brightness: 255 } },
});
const relay = lightView("switch.garage", {
  name: "Lampada garage",
  room: "Garage",
  state: { state: "off", attributes: {} },
});
const missing = lightView("light.staccata", { name: "Staccata", room: "Cantina" });

test("every light gets the controls its entity declares, and no others", () => {
  const html = renderLightsPopupMarkup([strip, spots, relay]);
  // A dimmer and an RGB strip carry the brightness track on the card itself:
  // the common case is "a bit less light", not "open a dialog".
  assert.equal((html.match(/data-dm-light-brightness/g) || []).length, 2);
  assert.match(html, /data-dm-light="light\.strip"[\s\S]*?data-dm-light-open/);
  // The relay has nothing to tune, so it is not offered a controls button.
  const relayCard = html.slice(html.indexOf('data-dm-light="switch.garage"'));
  assert.doesNotMatch(relayCard.slice(0, 1200), /data-dm-light-open/);
  assert.doesNotMatch(relayCard.slice(0, 1200), /data-dm-light-brightness/);
  assert.match(relayCard, /data-kind="switch">SWITCH/);
});

test("the card is painted with the colour the lamp is emitting", () => {
  const html = renderLightsPopupMarkup([strip, spots, relay]);
  assert.match(html, /--dm-light-color:#ff0000;--dm-light-ink:#ffffff;--dm-light-level:50%/);
  // A lamp with no colour of its own keeps the dashboard amber, and the ink on
  // it flips to dark so the glyph and the power button stay readable.
  assert.match(html, /--dm-light-color:#f59e0b;--dm-light-ink:#0f172a;--dm-light-level:0%/);
  assert.match(html, /data-dm-light-state>ACCESA · 50%/);
  assert.match(html, /data-dm-light-state>SPENTA/);
});

test("a configured light whose entity is gone is shown as unavailable", () => {
  const html = renderLightsPopupMarkup([strip, missing]);
  assert.match(html, /data-dm-light="light\.staccata" data-dm-light-available="false"/);
  assert.match(html, /data-dm-light-state>NON DISPONIBILE/);
});

test("rooms keep the legacy grouping and gain their own on/off command", () => {
  const html = renderLightsPopupMarkup([strip, spots, relay]);
  assert.match(html, /data-dm-light-group="Salone"[\s\S]*?dm-lightx-room-count">2\/2/);
  assert.match(html, /data-dm-light-room="off" data-dm-light-room-name="Salone">Spegni/);
  // One light in its own room is still merged into the closing group, where the
  // card carries the room as its title and the light name below it.
  assert.match(html, /data-dm-light-group="Altre zone"/);
  assert.match(html, /<span class="lgx-name">Garage<\/span>\s*<span class="lgx-sub">Lampada garage/);
  assert.match(html, /<b>2<\/b><span>accese<\/span>/);
  assert.match(html, /data-dm-light-all="off">Spegni tutte/);
});

test("an empty popup says where lights are added and which entities count", () => {
  const html = renderLightsPopupMarkup([]);
  assert.match(html, /Tutte spente/);
  assert.match(html, /light\.\* sia switch\.\*/);
  assert.doesNotMatch(html, /data-dm-light=/);
});

test("the control sheet offers colour, white and effects to the lamp that has them", () => {
  const html = renderLightControlMarkup(strip);
  assert.match(html, /data-block="brightness"/);
  assert.match(html, /data-block="color"/);
  assert.match(html, /data-block="white"/);
  assert.match(html, /data-block="effect"/);
  assert.match(html, /data-dm-light-hue/);
  assert.match(html, /data-dm-light-saturation/);
  assert.match(html, /type="color" value="#ff0000" data-dm-light-hex/);
  assert.equal((html.match(/data-dm-light-color="#/g) || []).length, 12);
  // The white track never leaves what the lamp reports, so a value it would
  // refuse cannot be sent from the slider.
  assert.match(html, /min="2202" max="6535"/);
  assert.match(html, /<option value="Fuoco" selected>Fuoco<\/option>/);
});

test("a dimmer gets a dimmer, and a relay gets a power button and an explanation", () => {
  const dim = renderLightControlMarkup(spots);
  assert.match(dim, /data-block="brightness"/);
  assert.doesNotMatch(dim, /data-block="color"/);
  assert.doesNotMatch(dim, /data-block="white"/);

  const plain = renderLightControlMarkup(relay);
  assert.doesNotMatch(plain, /data-block=/);
  assert.match(plain, /data-dm-light-power/);
  assert.match(plain, /collegata a uno switch/);
  assert.match(plain, /🔌/);

  const gone = renderLightControlMarkup(missing);
  assert.match(gone, /Entità non disponibile/);
});

test("the popup has one paint owner and stays event-driven", () => {
  // apriGestioneLuci is decorated rather than replaced: it is the only writer
  // of the runtime's lexical currentPopupType, which is what makes the tick
  // call updateGestioneLuci at all.
  assert.match(scene, /root\.apriGestioneLuci = ownedOpen/);
  assert.match(scene, /root\.updateGestioneLuci = ownedUpdate/);
  assert.match(scene, /if \(typeof open === "function" && !open\[MARKER\]\)/);
  assert.doesNotMatch(scene, /setInterval\s*\(/);
  assert.doesNotMatch(scene, /MutationObserver/);
  // Values are written into the cards that exist; markup is rebuilt only when
  // the shape of the list changes.
  assert.match(scene, /lightsSignature\(views\) !== state\.signature/);
  assert.match(scene, /function syncCard\(card, view\)/);
  assert.equal((runtime.match(/lights-scene-section\.js/g) || []).length, 1);
  assert.equal((runtime.match(/installLightsSceneSection\(\)/g) || []).length, 1);
});

test("commands go through the model and the legacy service bridge", () => {
  assert.match(scene, /lightCommand\(view, change\)/);
  assert.match(scene, /root\.dmCallHaService === "function"/);
  // A drag must not become one service call per pixel, and the value the user
  // set must survive the ticks that arrive before the lamp reports it.
  assert.match(scene, /const LIVE_MS = 320/);
  assert.match(scene, /const HOLD_MS = 6000/);
  assert.match(scene, /function applyLive\(view, field, value\)/);
});

test("the Luci tab accepts a switch and says what each light can do", () => {
  assert.match(editor, /import \{ LIGHT_DOMAINS, isLightEntity, lightView \}/);
  assert.match(editor, /if \(!isLightEntity\(entity\) \|\| !name\)/);
  assert.doesNotMatch(editor, /\^light\\\.\[a-z0-9_\]\+\$/);
  assert.match(editor, /placeholder="light\.salone · switch\.lampada"/);
  assert.match(editor, /function lightMeta\(id\)/);
  assert.match(editor, /class="dm-light-badges"/);
  // The badges describe the entity currently in the field, not the one the
  // modal was opened with.
  assert.match(editor, /entityInput\.addEventListener\("input", describe\)/);
  assert.match(editor, /root\.dmOpenLightControl\?\.\(clean\(entityInput\.value\)\)/);
});
