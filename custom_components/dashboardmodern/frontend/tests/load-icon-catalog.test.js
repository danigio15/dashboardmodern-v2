// DM-FIX-20260817E
/* The icon catalogue offered when configuring a load.
 *
 * The picker used to offer the action catalogue: a list built around what a
 * dashboard button *does* — a scene, a script, an alert, the alarm, a camera —
 * which is the wrong question for a circle that measures consumption, and which
 * carried none of the areas of a house. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  LOAD_ICON_CATALOG,
  loadCatalogMatch,
  loadGlyph,
} from "../src/core/personalization-catalog.js";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = path.join(frontend, "src", "sections");

const italian = (name) => LOAD_ICON_CATALOG.find((item) => item.it === name);

test("the areas of a house are offered: a circle is as often a room as an appliance", () => {
  for (const room of ["Cucina", "Salone", "Garage", "Bagno", "Camera", "Giardino", "Cantina"]) {
    const entry = italian(room);
    assert.ok(entry, `${room} is missing from the load catalogue`);
    assert.equal(entry.group, "room");
  }
});

test("what actually draws power is offered, well past the five the action list had", () => {
  for (const appliance of [
    "Forno",
    "Lavatrice",
    "Asciugatrice",
    "Lavastoviglie",
    "Frigorifero",
    "Boiler",
    "Pompa di calore",
    "Condizionatore",
    "Auto elettrica",
    "Fotovoltaico",
    "Irrigazione",
    "Server / NAS",
  ]) {
    const entry = italian(appliance);
    assert.ok(entry, `${appliance} is missing from the load catalogue`);
    assert.equal(entry.group, "appliance");
  }
  assert.ok(
    LOAD_ICON_CATALOG.filter((item) => item.group === "appliance").length >= 30,
    "the appliance half is meant to cover a whole house",
  );
});

test("what can never be a load is not offered", () => {
  // Security and cameras were in the action list and made no sense on a circle
  // that reads a meter.
  const tokens = LOAD_ICON_CATALOG.map((item) => item.mdi);
  for (const excluded of [
    "mdi:shield-home",
    "mdi:cctv",
    "mdi:movie-open",
    "mdi:script-text-play",
    "mdi:bell",
    "mdi:star",
    "mdi:toggle-switch-outline",
  ])
    assert.equal(tokens.includes(excluded), false, `${excluded} is not a load`);
});

test("no icon is offered twice, so the same tile never appears in both groups", () => {
  const tokens = LOAD_ICON_CATALOG.map((item) => item.mdi);
  const ids = LOAD_ICON_CATALOG.map((item) => item.id);
  assert.equal(new Set(tokens).size, tokens.length, "duplicate mdi token");
  assert.equal(new Set(ids).size, ids.length, "duplicate id");
  // The laundry room is the case this guards: its icon *is* the washing machine.
  assert.equal(italian("Lavanderia"), undefined);
  assert.ok(italian("Lavatrice"));
});

test("every entry carries a glyph that can actually be drawn", () => {
  for (const item of LOAD_ICON_CATALOG) {
    assert.ok(item.glyph, `${item.id} has no glyph`);
    assert.doesNotMatch(item.glyph, /^mdi:/, `${item.id} would print its token`);
    assert.match(item.mdi, /^mdi:/);
    assert.ok(item.it && item.en, `${item.id} is not labelled in both languages`);
  }
});

test("a token resolves to its own glyph, and an unknown one to a plug rather than a star", () => {
  assert.equal(loadGlyph("mdi:stove"), "🍳");
  assert.equal(loadGlyph("mdi:washing-machine"), "🧺");
  assert.equal(loadGlyph("mdi:car-electric"), "🚗");
  assert.equal(loadGlyph("mdi:garage"), "🚗");
  // An emoji already chosen goes straight through.
  assert.equal(loadGlyph("🔥"), "🔥");
  // A load that never matches must not fall back to the action list's star.
  assert.equal(loadGlyph("mdi:not-a-real-icon"), "🔌");
  assert.equal(loadGlyph(""), "🔌");
  // A token saved before this catalogue existed still resolves.
  assert.equal(loadGlyph("mdi:water"), "🚰");
  assert.equal(loadCatalogMatch("mdi:toaster-oven")?.it, "Forno");
});

test("the loads editor asks for the load catalogue, under a heading that says so", async () => {
  const engine = await readFile(path.join(sections, "icon-engine-section.js"), "utf8");
  const editor = await readFile(path.join(sections, "energy-loads-editor-section.js"), "utf8");
  /* Un campo solo, e lo usano tutti e due: il carico e il dispositivo dentro
   * il carico. Prima il secondo aveva una casella di testo e basta — «quando
   * faccio aggiungi dispositivi non fa scegliere icona» — perche' erano due
   * campi diversi per la stessa domanda. */
  assert.match(editor, /openIconPicker\(input, "load"\)/);
  assert.match(editor, /function iconField\(id, valore, onChange\)/);
  assert.equal(editor.match(/openIconPicker\(/g)?.length, 1);
  /* Il carico e il dispositivo lo chiamano tutti e due. */
  assert.match(editor, /iconField\(`dm-loads-\$\{load\.id\}-icon`/);
  assert.match(editor, /iconField\(`dm-loads-\$\{child\.id\}-icon`/);
  assert.match(engine, /Scegli icona del carico/);
  assert.match(engine, /Choose load icon/);
  // The two halves are labelled, because one flat grid of this length buries
  // what is being looked for.
  assert.match(engine, /Aree della casa/);
  assert.match(engine, /Apparecchi e impianti/);
});
