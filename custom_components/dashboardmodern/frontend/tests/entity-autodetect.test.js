/* What the 🪄 button decides, held to the cases that made the old detector
 * wrong: a slot in kWh taking a sensor in W, "oggi" taking a monthly meter, an
 * early slot stealing the entity a later one matched exactly, and rooms falling
 * back to name guessing while the Home Assistant areas sat unused. */
import assert from "node:assert/strict";
import test from "node:test";
import { buildEntityIndex } from "../src/core/entity-search-index.js";
import {
  buildPostings,
  detectCategories,
  detectSlots,
  parseSlotPlan,
  periodOf,
  scoreSlotCandidate,
} from "../src/core/entity-autodetect.js";

const sensor = (id, name, extra = {}) => ({ id, name, state: "1", ...extra });

const HOUSE = [
  sensor("sensor.solaredge_produzione_oggi", "Produzione solare oggi", { dc: "energy", unit: "kWh", sc: "total_increasing", area: "Tetto" }),
  sensor("sensor.solaredge_produzione_mese", "Produzione solare mese", { dc: "energy", unit: "kWh", sc: "total_increasing" }),
  sensor("sensor.solaredge_potenza_pv", "Potenza fotovoltaico", { dc: "power", unit: "W" }),
  sensor("sensor.casa_consumo_oggi", "Consumo casa oggi", { dc: "energy", unit: "kWh", sc: "total_increasing" }),
  sensor("sensor.casa_potenza", "Potenza consumo casa", { dc: "power", unit: "W" }),
  sensor("sensor.batteria_soc", "Stato carica batteria", { dc: "battery", unit: "%" }),
  sensor("sensor.speedtest_download", "Speedtest download", { unit: "Mbit/s" }),
  sensor("sensor.speedtest_upload", "Speedtest upload", { unit: "Mbit/s" }),
  sensor("sensor.cucina_temperatura", "Temperatura cucina", { dc: "temperature", unit: "°C", area: "Cucina" }),
  sensor("sensor.cucina_umidita", "Umidità cucina", { dc: "humidity", unit: "%", area: "Cucina" }),
  sensor("sensor.salotto_temperatura", "Temperatura salotto", { dc: "temperature", unit: "°C", area: "Salotto" }),
  sensor("sensor.mansarda_temperatura", "Temperatura mansarda", { dc: "temperature", unit: "°C" }),
  sensor("sensor.mansarda_umidita", "Umidità mansarda", { dc: "humidity", unit: "%" }),
  sensor("light.cucina", "Luce cucina", { area: "Cucina", state: "on" }),
  sensor("light.salotto", "Luce salotto", { area: "Salotto", state: "off" }),
  sensor("climate.salotto", "Clima salotto", { area: "Salotto", state: "cool" }),
  sensor("climate.termosifone_bagno", "Termosifone bagno", { area: "Bagno", state: "heat" }),
  sensor("camera.ingresso", "Camera ingresso", { area: "Ingresso", state: "idle" }),
  sensor("binary_sensor.porta_ingresso", "Porta ingresso", { dc: "door", state: "off" }),
  sensor("binary_sensor.finestra_bypass", "Finestra bypass", { dc: "window", state: "off" }),
  sensor("sensor.telecomando_batteria", "Batteria telecomando", { dc: "battery", unit: "%" }),
  sensor("script.apri_cancello", "Apri cancello", { state: "off" }),
  sensor("weather.casa", "Meteo casa", { state: "sunny" }),
  sensor("alarm_control_panel.antifurto", "Antifurto", { state: "disarmed" }),
];

const index = () => buildEntityIndex(HOUSE, { version: `t${Math.random()}` });

const plan = (ref, lbl, section = "energy") => parseSlotPlan({ ref, lbl }, section);

function assign(slots, options = {}) {
  const built = index();
  const result = detectSlots(built.records, slots, { postings: buildPostings(built.records), ...options });
  return Object.fromEntries(result.assignments.map((item) => [item.ref, item.id]));
}

test("a slot label states its own constraints", () => {
  const energy = plan("dm.energy_produzione_solare_oggi", "Produzione solare oggi (kWh)");
  assert.deepEqual(energy.units, ["kWh", "Wh", "MWh"]);
  assert.deepEqual(energy.deviceClasses, ["energy"]);
  assert.equal(energy.period, "d");

  const mode = plan("dm.ev_modalita_ricarica_evcc", "Modalità ricarica EVCC (select)", "ev");
  assert.deepEqual(mode.domains, ["select", "input_select"]);

  const script = plan("dm.home_script_apertura_cancello", "Script apertura cancello", "home");
  assert.deepEqual(script.domains, ["script", "scene", "automation"]);

  // Prose after an em dash describes the field to the person, not to the matcher.
  const washer = plan("dm.lavatrice_potenza", "Potenza presa lavatrice (W) — per lavatrici non smart: >5W = in funzione", "lavatrice");
  assert.deepEqual(washer.units, ["W", "kW"]);
  assert.ok(!washer.keys.some((keys) => keys.includes("funzione")));
});

test("the unit in the label is a constraint, not a preference", () => {
  const built = index();
  const power = built.records.find((record) => record.id === "sensor.solaredge_potenza_pv");
  const energyPlan = plan("dm.energy_produzione_solare_oggi", "Produzione solare oggi (kWh)");
  // A sensor in W can never answer a slot in kWh, however well its words match.
  assert.equal(scoreSlotCandidate(power, energyPlan), -Infinity);
});

test("a daily slot never takes a monthly meter", () => {
  assert.equal(periodOf("Produzione solare mese"), "m");
  const result = assign([
    plan("dm.energy_produzione_solare_oggi", "Produzione solare oggi (kWh)"),
    plan("dm.energy_produzione_solare_mese", "Produzione solare mese (kWh)"),
  ]);
  assert.equal(result["dm.energy_produzione_solare_oggi"], "sensor.solaredge_produzione_oggi");
  assert.equal(result["dm.energy_produzione_solare_mese"], "sensor.solaredge_produzione_mese");
});

test("the strongest claim on an entity wins, whatever the slot order", () => {
  /* Declared in the order that used to lose: the generic power slot comes
   * first and would have taken the photovoltaic sensor on a word match. */
  const result = assign([
    plan("dm.energy_potenza_consumo_casa", "Potenza consumo casa (W)"),
    plan("dm.energy_potenza_fotovoltaico", "Potenza fotovoltaico (W)"),
  ]);
  assert.equal(result["dm.energy_potenza_fotovoltaico"], "sensor.solaredge_potenza_pv");
  assert.equal(result["dm.energy_potenza_consumo_casa"], "sensor.casa_potenza");
});

test("one entity is never proposed for two slots, nor re-proposed when already configured", () => {
  const first = assign([
    plan("dm.server_speedtest_download", "Speedtest Download (Mbit/s)", "server"),
    plan("dm.server_speedtest_upload", "Speedtest Upload (Mbit/s)", "server"),
  ]);
  assert.equal(first["dm.server_speedtest_download"], "sensor.speedtest_download");
  assert.equal(first["dm.server_speedtest_upload"], "sensor.speedtest_upload");

  const taken = assign([plan("dm.server_speedtest_download", "Speedtest Download (Mbit/s)", "server")], {
    taken: new Set(["sensor.speedtest_download"]),
  });
  assert.equal(taken["dm.server_speedtest_download"], undefined);
});

test("domains stated by the label are honoured", () => {
  const result = assign([
    plan("dm.home_meteo", "Meteo (entità weather)", "home"),
    plan("dm.security_centrale_allarme", "Centrale allarme (alarm_control_panel)", "security"),
    plan("dm.home_script_apertura_cancello", "Script apertura cancello", "home"),
  ]);
  assert.equal(result["dm.home_meteo"], "weather.casa");
  assert.equal(result["dm.security_centrale_allarme"], "alarm_control_panel.antifurto");
  assert.equal(result["dm.home_script_apertura_cancello"], "script.apri_cancello");
});

test("two equally plausible candidates are reported instead of guessed", () => {
  const records = buildEntityIndex(
    [
      sensor("sensor.pannello_sonda", "Sonda temperatura", { dc: "temperature", unit: "°C" }),
      sensor("sensor.serbatoio_sonda", "Sonda temperatura", { dc: "temperature", unit: "°C" }),
    ],
    { version: "ambiguous" },
  );
  const result = detectSlots(records.records, [plan("dm.boiler_sonda_temperatura_1", "Sonda temperatura 1 (°C)", "boiler")]);
  assert.deepEqual(result.assignments, []);
  assert.equal(result.undecided.length, 1);
  assert.equal(result.undecided[0].reason, "ambiguous");
});

test("the small words a label uses to tell two slots apart are kept", () => {
  /* "Temperatura AC inverter" and "Temperatura DC inverter" are the same label
   * once two-letter words are dropped, and so are "Sonda temperatura 1" and its
   * neighbours once digits are. Both pairs used to end up undecided. */
  const built = buildEntityIndex(
    [
      sensor("sensor.inverter_temperatura_ac", "Temperatura AC", { dc: "temperature", unit: "°C" }),
      sensor("sensor.inverter_temperatura_dc", "Temperatura DC", { dc: "temperature", unit: "°C" }),
      sensor("sensor.sonda_1", "Sonda 1", { dc: "temperature", unit: "°C" }),
      sensor("sensor.sonda_2", "Sonda 2", { dc: "temperature", unit: "°C" }),
    ],
    { version: "short-words" },
  );
  const result = detectSlots(built.records, [
    plan("dm.energy_temperatura_ac_inverter", "Temperatura AC inverter (°C)"),
    plan("dm.energy_temperatura_dc_inverter", "Temperatura DC inverter (°C)"),
    plan("dm.boiler_sonda_temperatura_2", "Sonda temperatura 2 (°C)", "boiler"),
  ]);
  const byRef = Object.fromEntries(result.assignments.map((item) => [item.ref, item.id]));
  assert.equal(byRef["dm.energy_temperatura_ac_inverter"], "sensor.inverter_temperatura_ac");
  assert.equal(byRef["dm.energy_temperatura_dc_inverter"], "sensor.inverter_temperatura_dc");
  assert.equal(byRef["dm.boiler_sonda_temperatura_2"], "sensor.sonda_2");
});

test("rooms come from the Home Assistant areas, with the humidity twin of each", () => {
  const { rooms } = detectCategories(index().records);
  assert.deepEqual(rooms.slice(0, 2), [
    { name: "Cucina", icon: "🌡️", temp: "sensor.cucina_temperatura", hum: "sensor.cucina_umidita" },
    { name: "Salotto", icon: "🌡️", temp: "sensor.salotto_temperatura" },
  ]);
  // A sensor with no area still lands, through its name and its id twin.
  const mansarda = rooms.find((room) => room.temp === "sensor.mansarda_temperatura");
  assert.equal(mansarda.hum, "sensor.mansarda_umidita");
});

test("lights, climate units and cameras carry their area in the name", () => {
  const { lights, climate, cameras } = detectCategories(index().records);
  assert.equal(lights["light.cucina"], "Luce cucina");
  assert.equal(cameras[0].entity, "camera.ingresso");
  const heating = climate.find((unit) => unit.entity === "climate.termosifone_bagno");
  assert.equal(heating.type, "termo");
  assert.equal(heating.name, "Bagno");
  assert.equal(climate.find((unit) => unit.entity === "climate.salotto").type, "clima");
});

test("alert groups keep the openings and the batteries apart, and drop the bypass", () => {
  const { groups } = detectCategories(index().records);
  assert.deepEqual(groups.win, ["binary_sensor.porta_ingresso"]);
  assert.deepEqual(groups.batt, ["sensor.batteria_soc", "sensor.telecomando_batteria"]);
  assert.deepEqual(groups.luci, ["light.cucina", "light.salotto"]);
  assert.deepEqual(groups.risc, ["climate.termosifone_bagno"]);
  assert.deepEqual(groups.clima, ["climate.salotto"]);
});

test("a slot only looks at the entities that share a word with it", () => {
  const many = [];
  for (let position = 0; position < 4000; position += 1) {
    many.push(sensor(`sensor.filler_${position}`, `Filler ${position}`, { unit: "W" }));
  }
  const built = buildEntityIndex([...HOUSE, ...many], { version: "scale" });
  const postings = buildPostings(built.records);
  const plans = [plan("dm.energy_produzione_solare_oggi", "Produzione solare oggi (kWh)")];
  const result = detectSlots(built.records, plans, { postings });
  assert.equal(result.assignments[0].id, "sensor.solaredge_produzione_oggi");
  // Four thousand unrelated entities never enter the scoring at all.
  assert.ok(result.scanned <= 8, `scored ${result.scanned} pairs`);
});
