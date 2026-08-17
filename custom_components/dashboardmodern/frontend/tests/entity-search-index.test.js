/* The picker's search: what it finds, what it proposes, and what it costs.
 *
 * The cost assertions are deliberately about work done, not milliseconds: how
 * many records a keystroke scans and how many rows it ranks are properties of
 * the algorithm, while a timing threshold only measures the machine running the
 * suite. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntityIndex,
  createSearchSession,
  fieldHints,
  foldText,
  prepareHints,
  queryScore,
  rankMatches,
  searchEntityIndex,
} from "../src/core/entity-search-index.js";

const HOUSE = [
  { id: "sensor.cucina_temperatura", name: "Cucina Temperatura", dc: "temperature", unit: "°C", area: "Cucina", state: "21.4" },
  { id: "sensor.cucina_umidita", name: "Cucina Umidità", dc: "humidity", unit: "%", area: "Cucina", state: "48" },
  { id: "sensor.salotto_temperatura", name: "Salotto Temperatura", dc: "temperature", unit: "°C", area: "Salotto", state: "22.8" },
  { id: "sensor.citta_meteo", name: "Città Meteo", state: "sole" },
  { id: "sensor.consumo_totale", name: "Consumo Totale", dc: "energy", unit: "kWh", sc: "total_increasing", state: "4210" },
  { id: "light.cucina_faretti", name: "Faretti Cucina", area: "Cucina", state: "on" },
  { id: "switch.forno", name: "Forno", state: "off" },
  { id: "climate.salotto", name: "Clima Salotto", area: "Salotto", state: "heat" },
  { id: "automation.risveglio", name: "Risveglio", state: "on" },
  { id: "sensor.bagno_temperatura", name: "Bagno Temperatura", dc: "temperature", unit: "°C", area: "Bagno", state: "unavailable" },
];

const ids = (result) => result.rows.map((row) => row.record.id);

function syntheticHouse(count) {
  const domains = ["sensor", "binary_sensor", "switch", "light", "cover", "climate"];
  const words = ["cucina", "salotto", "bagno", "temperatura", "potenza", "presa", "tapparella", "giardino"];
  const list = [];
  for (let position = 0; position < count; position += 1) {
    const domain = domains[position % domains.length];
    const first = words[position % words.length];
    const second = words[(position * 7) % words.length];
    list.push({
      id: `${domain}.${first}_${second}_${position}`,
      name: `${first} ${second} ${position}`,
      state: "on",
    });
  }
  return list;
}

test("folding makes accents and case irrelevant to a search", () => {
  assert.equal(foldText("Città"), "citta");
  assert.equal(foldText("Umidità Salotto"), "umidita salotto");
  const index = buildEntityIndex(HOUSE);
  assert.deepEqual(ids(searchEntityIndex(index, "città")), ["sensor.citta_meteo"]);
  assert.deepEqual(ids(searchEntityIndex(index, "UMIDITA")), ["sensor.cucina_umidita"]);
});

test("every term must match, and the closest match ranks first", () => {
  const index = buildEntityIndex(HOUSE);
  assert.deepEqual(ids(searchEntityIndex(index, "cucina temperatura")), ["sensor.cucina_temperatura"]);
  assert.equal(searchEntityIndex(index, "cucina inesistente").matched, 0);
  const cucina = ids(searchEntityIndex(index, "cucina"));
  assert.deepEqual(cucina.slice().sort(), [
    "light.cucina_faretti",
    "sensor.cucina_temperatura",
    "sensor.cucina_umidita",
  ]);
  // A whole-id prefix beats a match that only appears inside the name.
  assert.equal(ids(searchEntityIndex(index, "switch.forno"))[0], "switch.forno");
});

test("an unavailable entity is ranked below an equally good live one", () => {
  const index = buildEntityIndex(HOUSE);
  const rows = ids(searchEntityIndex(index, "temperatura"));
  assert.equal(rows.length, 3);
  // Same name shape, same device class, shortest id of the three — last only
  // because Home Assistant is not reporting a value for it.
  assert.equal(rows[rows.length - 1], "sensor.bagno_temperatura");
});

test("the field describes itself, and the search proposes accordingly", () => {
  const hints = fieldHints({
    ref: "sensor.temperatura_cucina",
    placeholder: "sensor.temperatura (°C)",
    label: "🌡️ Temperatura stanza",
  });
  assert.ok(hints.domains.has("sensor"));
  assert.ok(hints.deviceClasses.has("temperature"));
  assert.ok(hints.units.has("°C"));
  assert.ok(hints.keywords.includes("temperatura"));

  const index = buildEntityIndex(HOUSE);
  const proposed = searchEntityIndex(index, "", { hints });
  // With no query at all, the two temperature sensors of the house come first
  // and are marked, instead of the alphabetically first entity.
  assert.deepEqual(ids(proposed).slice(0, 2), ["sensor.cucina_temperatura", "sensor.salotto_temperatura"]);
  assert.ok(proposed.rows[0].hinted);
  assert.ok(proposed.hinted >= 2);
  assert.equal(proposed.rows.find((row) => row.record.id === "automation.risveglio")?.hinted, false);
});

test("a light field proposes lights and an energy field proposes meters", () => {
  const index = buildEntityIndex(HOUSE);
  const light = fieldHints({ ref: "light.cucina", label: "Luce principale" });
  assert.equal(ids(searchEntityIndex(index, "", { hints: light }))[0], "light.cucina_faretti");
  const energy = fieldHints({ id: "ed-en-tot", label: "Energia totale casa (kWh)" });
  assert.ok(energy.units.has("kWh"));
  assert.equal(ids(searchEntityIndex(index, "", { hints: energy }))[0], "sensor.consumo_totale");
});

test("the hint table is computed once per field and reused across keystrokes", () => {
  const index = buildEntityIndex(HOUSE);
  const hints = fieldHints({ ref: "sensor.temperatura_cucina" });
  const first = prepareHints(index, hints);
  assert.equal(prepareHints(index, hints), first);
  assert.equal(first.scores.length, index.size);
  // The query score never carries the hint bonus, which is what lets the table
  // stay valid while the query changes.
  const record = index.records.find((entry) => entry.id === "sensor.cucina_temperatura");
  assert.equal(queryScore(record, { folded: "", terms: [], empty: true }), record.penalty);
});

test("extending a query rescans only the previous matches", () => {
  const index = buildEntityIndex(syntheticHouse(1200));
  const session = createSearchSession();
  const first = searchEntityIndex(index, "cuc", { session });
  assert.equal(first.scanned, 1200);
  const second = searchEntityIndex(index, "cucina", { session });
  assert.equal(second.scanned, first.matched);
  assert.ok(second.scanned < 1200);
  const third = searchEntityIndex(index, "cucina bagno", { session });
  assert.equal(third.scanned, second.matched);

  // Narrowing must not lose rows: the same query from a cold session finds the
  // same set.
  const cold = searchEntityIndex(index, "cucina bagno", { session: createSearchSession() });
  assert.equal(third.matched, cold.matched);
  assert.deepEqual(ids(third), ids(cold));

  // Shortening the query is not a narrowing, so it rescans everything.
  const back = searchEntityIndex(index, "cuc", { session });
  assert.equal(back.scanned, 1200);
  assert.equal(back.matched, first.matched);
});

test("only one page is ranked, and paging continues it without gaps", () => {
  const index = buildEntityIndex(syntheticHouse(900));
  const session = createSearchSession();
  const result = searchEntityIndex(index, "cucina", { session, limit: 60 });
  assert.equal(result.rows.length, 60);
  assert.ok(result.matched > 60);
  assert.equal(result.truncated, true);

  const second = rankMatches(index, session, { offset: 60, limit: 60, query: "cucina" });
  const seen = new Set([...ids(result), ...second.map((row) => row.record.id)]);
  assert.equal(seen.size, result.rows.length + second.length);
});

test("domain counts describe the whole match set, not the visible page", () => {
  const index = buildEntityIndex(HOUSE);
  const result = searchEntityIndex(index, "", { withDomains: true, limit: 2 });
  assert.equal(result.rows.length, 2);
  assert.equal(result.domains.get("sensor"), 6);
  assert.equal(result.domains.get("light"), 1);
  const filtered = searchEntityIndex(index, "", { domain: "light" });
  assert.deepEqual(ids(filtered), ["light.cucina_faretti"]);
  assert.equal(filtered.filtered, 1);
  assert.equal(filtered.matched, HOUSE.length);
});

test("the suggested filter narrows the view without narrowing the search", () => {
  const index = buildEntityIndex(HOUSE);
  const hints = fieldHints({ ref: "sensor.temperatura_cucina", label: "Temperatura" });
  const suggested = searchEntityIndex(index, "", { hints, hintedOnly: true });
  const shown = ids(suggested);
  assert.deepEqual(shown.slice(0, 3), [
    "sensor.cucina_temperatura",
    "sensor.salotto_temperatura",
    "sensor.bagno_temperatura",
  ]);
  // The field asks for a sensor, so a light whose name carries the same room
  // word is not proposed for it.
  assert.ok(shown.every((id) => id.startsWith("sensor.")));
  assert.equal(suggested.filtered, shown.length);
  // The match set behind it is still the whole house, so the next keystroke
  // narrows from everything and clearing the filter costs nothing.
  assert.equal(suggested.matched, HOUSE.length);
  assert.equal(suggested.hinted, shown.length);
  const paged = rankMatches(index, createSearchSession(), { offset: 0, limit: 5, hints, hintedOnly: true });
  assert.equal(paged.length, 0, "paging uses the session's own match set");
});

test("index building tolerates both metadata and raw Home Assistant states", () => {
  const index = buildEntityIndex([
    { entity_id: "sensor.raw", state: "12", attributes: { friendly_name: "Raw", device_class: "power", unit_of_measurement: "W" } },
    { id: "sensor.meta", name: "Meta", dc: "power", unit: "W", state: "8" },
    { id: "not-an-entity" },
    null,
  ]);
  assert.equal(index.size, 2);
  const raw = index.records[0];
  assert.equal(raw.name, "Raw");
  assert.equal(raw.dc, "power");
  assert.equal(raw.unit, "W");
  const power = fieldHints({ label: "Potenza istantanea (W)" });
  assert.equal(searchEntityIndex(index, "", { hints: power }).hinted, 2);
});

test("the same list is indexed once", () => {
  const entries = syntheticHouse(200);
  const first = buildEntityIndex(entries);
  assert.equal(buildEntityIndex(entries), first);
  assert.notEqual(buildEntityIndex(entries, { version: "changed" }), first);
});
