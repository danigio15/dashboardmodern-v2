/* La lavatrice di hOn entra intera, e il modulo indovina chi fa cosa.
 *
 * Il caso che ha chiesto la funzione: una Hoover con l'integrazione hOn da
 * HACS, ventisei entita' esposte, e la voglia di non scriverle a mano. Qui si
 * tiene il modulo a quella lavatrice — e a un frigorifero e a una presa, per
 * i casi in cui la regola giusta e' un'altra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  bindApplianceToDevice,
  deviceEntityGroups,
  guessApplianceType,
  integrationsWithDevices,
  proposeRoles,
  roomForArea,
  unbindAppliance,
} from "../src/core/appliance-device-binding.js";
import { normalizeDevice } from "../src/core/device-model.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  name,
  device_id: "wm-1",
  platform: "hon",
  translation_key: "",
  device_class: "",
  unit: "",
  state_class: "",
  category: "",
  disabled: false,
  hidden: false,
  ...extra,
});

/* Le entita' che hOn espone per una lavatrice, coi loro nomi inglesi. */
const HON_WASHER = [
  ent("sensor.lavatrice_machine_status", "Machine status", { translation_key: "washing_modes" }),
  ent("sensor.lavatrice_program_phase", "Program phase", { translation_key: "program_phases_wm" }),
  ent("sensor.lavatrice_remaining_time", "Remaining time", {
    translation_key: "remaining_time",
    unit: "min",
    device_class: "duration",
  }),
  ent("sensor.lavatrice_delay_time", "Delay time", { translation_key: "delay_time", unit: "min" }),
  ent("sensor.lavatrice_program", "Program", { translation_key: "programs_wm" }),
  ent("sensor.lavatrice_spin_speed", "Spin speed", { translation_key: "spin_speed", unit: "rpm" }),
  ent("sensor.lavatrice_temperature", "Temperature", {
    translation_key: "temperature",
    unit: "°C",
    device_class: "temperature",
  }),
  ent("sensor.lavatrice_energy_current", "Energy current", {
    translation_key: "energy_current",
    unit: "kWh",
    device_class: "energy",
  }),
  ent("sensor.lavatrice_energy_total", "Energy total", {
    translation_key: "energy_total",
    unit: "kWh",
    device_class: "energy",
    state_class: "total_increasing",
  }),
  ent("sensor.lavatrice_water_current", "Water current", {
    translation_key: "water_current",
    unit: "L",
  }),
  ent("sensor.lavatrice_water_total", "Water total", {
    translation_key: "water_total",
    unit: "L",
    state_class: "total_increasing",
  }),
  ent("sensor.lavatrice_power", "Power", {
    translation_key: "power",
    unit: "W",
    device_class: "power",
  }),
  ent("sensor.lavatrice_start_time", "Start time", {
    translation_key: "start_time",
    device_class: "timestamp",
  }),
  ent("binary_sensor.lavatrice_door", "Door", {
    translation_key: "door_open",
    device_class: "door",
  }),
  ent("binary_sensor.lavatrice_door_lock", "Door lock", { translation_key: "door_lock" }),
  ent("binary_sensor.lavatrice_remote_control", "Remote control", {
    translation_key: "remote_control",
  }),
  ent("binary_sensor.lavatrice_error", "Error", {
    translation_key: "error",
    device_class: "problem",
  }),
  ent("switch.lavatrice_wash", "Wash", { translation_key: "wash" }),
  ent("switch.lavatrice_pause", "Pause", { translation_key: "pause" }),
  ent("switch.lavatrice_extra_rinse_1", "Extra rinse 1", {
    translation_key: "extra_rinse_1",
    category: "config",
  }),
  ent("select.lavatrice_program", "Program", {
    translation_key: "programs_wm",
    category: "config",
  }),
  ent("select.lavatrice_temperature", "Temperature", {
    translation_key: "temperature",
    category: "config",
  }),
  ent("number.lavatrice_delay_time", "Delay time", {
    translation_key: "delay_time",
    category: "config",
    unit: "min",
  }),
  ent("button.lavatrice_refresh", "Refresh", {
    translation_key: "refresh",
    category: "diagnostic",
  }),
  ent("sensor.lavatrice_rssi", "RSSI", {
    translation_key: "rssi",
    category: "diagnostic",
    unit: "dBm",
  }),
  ent("sensor.lavatrice_last_update", "Last update", {
    translation_key: "last_update",
    category: "diagnostic",
    disabled: true,
  }),
];

const STATES = {
  "sensor.lavatrice_machine_status": { state: "running", attributes: {} },
  "sensor.lavatrice_program_phase": { state: "washing", attributes: {} },
  "sensor.lavatrice_remaining_time": { state: "42", attributes: { unit_of_measurement: "min" } },
  "sensor.lavatrice_power": { state: "1900", attributes: { unit_of_measurement: "W" } },
  "sensor.lavatrice_energy_total": {
    state: "412.5",
    attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
  },
  "switch.lavatrice_wash": { state: "on", attributes: {} },
  "select.lavatrice_program": {
    state: "eco_40_60",
    attributes: { options: ["eco_40_60", "cotton", "rapid_14"] },
  },
  "number.lavatrice_delay_time": { state: "0", attributes: { min: 0, max: 24, step: 1 } },
  "binary_sensor.lavatrice_door": { state: "off", attributes: {} },
  "sensor.lavatrice_rssi": { state: "-61", attributes: { unit_of_measurement: "dBm" } },
};

test("la lavatrice di hOn: ogni ruolo alla sua entità, e il ritardo non è il tempo rimanente", () => {
  const roles = proposeRoles(HON_WASHER, STATES, { type: "lavatrice" });
  assert.equal(roles.power_entity, "sensor.lavatrice_power");
  assert.equal(roles.state_entity, "sensor.lavatrice_machine_status");
  assert.equal(roles.remaining_entity, "sensor.lavatrice_remaining_time");
  assert.equal(roles.total_energy_entity, "sensor.lavatrice_energy_total");
  assert.equal(roles.last_energy_entity, "sensor.lavatrice_energy_current");
  assert.equal(roles.control_entity, "switch.lavatrice_wash");
  assert.equal(roles.alert_entity, "binary_sensor.lavatrice_error");
  assert.equal(roles.last_start_entity, "sensor.lavatrice_start_time");
  /* La temperatura di una lavatrice e' quella del programma: niente barra. */
  assert.equal(roles.temperature_entity, undefined);
  assert.equal(roles.daily_energy_entity, undefined);
  assert.equal(roles.cycle_duration_entity, undefined);
});

test("un frigorifero prende le sue due temperature, e non quella ambiente", () => {
  const fridge = [
    ent("sensor.frigo_fridge_temperature", "Fridge temperature", {
      unit: "°C",
      device_class: "temperature",
    }),
    ent("sensor.frigo_freezer_temperature", "Freezer temperature", {
      unit: "°C",
      device_class: "temperature",
    }),
    ent("sensor.frigo_ambient_temperature", "Ambient temperature", {
      unit: "°C",
      device_class: "temperature",
    }),
    ent("number.frigo_fridge_target", "Fridge target temperature", {
      unit: "°C",
      category: "config",
    }),
    ent("switch.frigo_super_cool", "Super cool", { category: "config" }),
    ent("sensor.frigo_power", "Power", { unit: "W" }),
  ];
  const roles = proposeRoles(fridge, {}, { type: "frigo" });
  assert.equal(roles.temperature_entity, "sensor.frigo_fridge_temperature");
  assert.equal(roles.temperature_entity_2, "sensor.frigo_freezer_temperature");
  assert.equal(roles.power_entity, "sensor.frigo_power");
  /* Un interruttore di configurazione non e' il tasto acceso/spento. */
  assert.equal(roles.control_entity, undefined);
});

test("una presa smart: interruttore, potenza, energia di oggi e contatore", () => {
  const plug = [
    ent("switch.presa_forno", "", { platform: "shelly" }),
    ent("sensor.presa_forno_power", "Power", { platform: "shelly", unit: "W" }),
    ent("sensor.presa_forno_energy", "Energy", {
      platform: "shelly",
      unit: "kWh",
      state_class: "total_increasing",
    }),
    ent("sensor.presa_forno_energy_today", "Energy today", { platform: "shelly", unit: "kWh" }),
    ent("sensor.presa_forno_voltage", "Voltage", { platform: "shelly", unit: "V" }),
    ent("sensor.presa_forno_current", "Current", { platform: "shelly", unit: "A" }),
  ];
  const roles = proposeRoles(plug, {});
  assert.equal(roles.control_entity, "switch.presa_forno");
  assert.equal(roles.power_entity, "sensor.presa_forno_power");
  assert.equal(roles.daily_energy_entity, "sensor.presa_forno_energy_today");
  assert.equal(roles.total_energy_entity, "sensor.presa_forno_energy");
  /* «Current» in ampere non e' l'energia del ciclo. */
  assert.equal(roles.last_energy_entity, undefined);
});

test("il tipo si legge dal nome, dal modello o dalle entità", () => {
  assert.equal(guessApplianceType({ name: "Lavatrice", model: "H-WASH 500" }), "lavatrice");
  assert.equal(guessApplianceType({ name: "Washer dryer", model: "HD 4149" }), "lavatrice");
  assert.equal(guessApplianceType({ name: "Asciugatrice", model: "H-DRY 500" }), "asciugatrice");
  assert.equal(guessApplianceType({ name: "Dishwasher", model: "SMS4HVW00E" }), "lavastoviglie");
  assert.equal(guessApplianceType({ name: "Kühlschrank", model: "KGN36" }), "generico");
  assert.equal(
    guessApplianceType({
      name: "Cucina",
      model: "31000",
      entities: [ent("sensor.x_spin_speed", "Spin speed")],
    }),
    "lavatrice",
  );
  assert.equal(guessApplianceType({ name: "Presa", model: "Plus Plug S" }), "generico");
});

test("collegare scrive il collegamento e riempie solo le caselle vuote", () => {
  const device = {
    id: "wm-1",
    name: "Lavatrice",
    manufacturer: "Hoover",
    model: "H-WASH 500",
    integration: "hon",
    area: "Lavanderia",
    entities: 25,
  };
  const rooms = [
    { id: "room-cucina", name: "Cucina" },
    { id: "room-lavanderia", name: "Lavanderia" },
  ];
  const { appliance, filled, kept } = bindApplianceToDevice(
    { id: "appl-1", name: "", icon: "generico", power_entity: "sensor.presa_lavatrice_power" },
    {
      device,
      entities: HON_WASHER,
      integration: { domain: "hon", name: "hOn" },
      states: STATES,
      rooms,
    },
  );
  assert.equal(appliance.device_id, "wm-1");
  assert.equal(appliance.integration, "hon");
  assert.equal(appliance.integration_name, "hOn");
  assert.equal(appliance.device_name, "Lavatrice");
  assert.equal(appliance.device_manufacturer, "Hoover");
  assert.equal(appliance.device_model, "H-WASH 500");
  assert.equal(appliance.name, "Lavatrice");
  assert.equal(appliance.visual_key, "lavatrice");
  assert.equal(appliance.device_type, "lavatrice");
  assert.equal(appliance.room_id, "room-lavanderia");
  /* La potenza c'era gia', dalla presa: resta quella. */
  assert.equal(appliance.power_entity, "sensor.presa_lavatrice_power");
  assert.ok(kept.includes("power_entity"));
  assert.equal(appliance.remaining_entity, "sensor.lavatrice_remaining_time");
  assert.equal(appliance.state_entity, "sensor.lavatrice_machine_status");
  assert.equal(appliance.control_entity, "switch.lavatrice_wash");
  assert.equal(appliance.total_energy_entity, "sensor.lavatrice_energy_total");
  assert.equal(appliance.history_entity, "sensor.lavatrice_energy_total");
  assert.equal(appliance.energy_entity, "sensor.lavatrice_energy_total");
  assert.ok(filled.includes("remaining_entity"));
  /* Le entita' accese del dispositivo restano in memoria; quella spenta in
   * Home Assistant no, non avrebbe niente da mostrare. */
  assert.equal(appliance.device_entities.length, HON_WASHER.length - 1);
  assert.ok(!appliance.device_entities.includes("sensor.lavatrice_last_update"));
  assert.ok(appliance.entities.includes("switch.lavatrice_wash"));
  assert.ok(!appliance.entities.includes("sensor.lavatrice_rssi"));
  /* E la passata che indovina dai nomi non deve rimettere dentro tutto. */
  assert.equal(appliance.metadata.dm_campi_scelti, true);

  /* E sopravvive alla normalizzazione, che tiene solo i campi che conosce. */
  const normalized = normalizeDevice(appliance, "appliances", { rooms, index: 0 });
  assert.equal(normalized.device_id, "wm-1");
  assert.equal(normalized.integration_name, "hOn");
  assert.equal(normalized.device_entities.length, HON_WASHER.length - 1);
  assert.equal(normalized.remaining_entity, "sensor.lavatrice_remaining_time");

  const unbound = unbindAppliance(normalized);
  assert.equal(unbound.device_id, undefined);
  assert.equal(unbound.device_entities, undefined);
  assert.equal(unbound.remaining_entity, "sensor.lavatrice_remaining_time");
});

test("un tipo scelto a mano non viene riscritto dal collegamento", () => {
  const { appliance } = bindApplianceToDevice(
    { id: "a", name: "Lavasciuga", visual_key: "asciugatrice", device_type: "asciugatrice" },
    { device: { id: "d", name: "Washer", integration: "hon" }, entities: HON_WASHER },
  );
  assert.equal(appliance.visual_key, "asciugatrice");
});

test("la stanza si trova per nome, accenti a parte", () => {
  const rooms = [
    { id: "r1", name: "Lavanderìa" },
    { id: "r2", name: "Cucina" },
  ];
  assert.equal(roomForArea("lavanderia", rooms), "r1");
  assert.equal(roomForArea("Bagno", rooms), "");
  assert.equal(roomForArea("", rooms), "");
});

test("il menu elenca le integrazioni con dentro i dispositivi che hanno entità", () => {
  const menu = integrationsWithDevices({
    integrations: [
      { domain: "shelly", name: "Shelly", custom: false },
      { domain: "hon", name: "hOn", custom: true },
      { domain: "sun", name: "Sun", custom: false },
    ],
    devices: [
      { id: "wm-1", name: "Lavatrice", integration: "hon", entities: 25 },
      { id: "plug-1", name: "Presa", integration: "shelly", entities: 4 },
      { id: "empty", name: "Vuoto", integration: "sun", entities: 0 },
    ],
  });
  assert.deepEqual(
    menu.map((item) => [item.domain, item.devices.map((device) => device.id)]),
    [
      ["hon", ["wm-1"]],
      ["shelly", ["plug-1"]],
    ],
  );
});

test("la finestra del dettaglio divide le entità in quattro famiglie", () => {
  const groups = deviceEntityGroups(HON_WASHER, STATES, {
    mapped: ["sensor.lavatrice_power"],
    locale: "it",
  });
  const names = (list) => list.map((row) => row.entity);
  assert.ok(names(groups.readings).includes("sensor.lavatrice_power"));
  assert.ok(groups.readings.find((row) => row.entity === "sensor.lavatrice_power").mapped);
  assert.equal(
    groups.readings.find((row) => row.entity === "sensor.lavatrice_remaining_time").value,
    "42 min",
  );
  assert.ok(names(groups.state).includes("sensor.lavatrice_machine_status"));
  assert.equal(
    groups.state.find((row) => row.entity === "binary_sensor.lavatrice_door").value,
    "Spento",
  );
  const program = groups.controls.find((row) => row.entity === "select.lavatrice_program");
  assert.deepEqual(program.control, {
    kind: "select",
    options: ["eco_40_60", "cotton", "rapid_14"],
    current: "eco_40_60",
  });
  assert.equal(
    groups.controls.find((row) => row.entity === "switch.lavatrice_wash").control.on,
    true,
  );
  assert.equal(
    groups.controls.find((row) => row.entity === "number.lavatrice_delay_time").control.kind,
    "number",
  );
  /* La diagnostica sta a parte, e chi e' spento in Home Assistant non c'e'. */
  assert.ok(names(groups.diagnostics).includes("sensor.lavatrice_rssi"));
  assert.ok(names(groups.diagnostics).includes("button.lavatrice_refresh"));
  assert.ok(!names(groups.diagnostics).includes("sensor.lavatrice_last_update"));
  /* Senza stato il valore e' un trattino, non «undefined». */
  assert.equal(
    groups.readings.find((row) => row.entity === "sensor.lavatrice_spin_speed").value,
    "—",
  );
});

/* La lavatrice vera di chi ha chiesto la funzione.
 *
 * Haier con «Haier hOn Revived» da HACS, Home Assistant in italiano: le
 * entita' arrivano coi nomi tradotti, e sono queste, una per una, come le
 * elenca la pagina del dispositivo. Niente sensore di potenza e niente
 * contatore: su questa macchina i watt non esistono, e tutto quello che la
 * card sa dire deve venire dagli stati del programma.
 */
const HAIER_IT = [
  ent("sensor.lavatrice_fase", "Fase", { translation_key: "prphase" }),
  ent("sensor.lavatrice_machine_status", "Machine Status", { translation_key: "machmode" }),
  ent("sensor.lavatrice_tempo_rimanente", "Tempo rimanente", {
    translation_key: "remaining_time",
    unit: "min",
  }),
  ent("sensor.lavatrice_centrifuga", "Centrifuga", { unit: "rpm" }),
  ent("sensor.lavatrice_efficienza_energetica", "Efficienza energetica", {}),
  ent("sensor.lavatrice_detersivo_liquido", "Detersivo liquido", { unit: "ml" }),
  ent("sensor.lavatrice_detersivo_in_polvere", "Detersivo in polvere", { unit: "ml" }),
  ent("sensor.lavatrice_livello_di_sporco", "Livello di sporco", {}),
  ent("sensor.lavatrice_capacita_di_carico", "Capacità di carico", { unit: "kg" }),
  ent("sensor.lavatrice_temperatura", "Temperatura", { unit: "°C", device_class: "temperature" }),
  ent("sensor.lavatrice_programma", "Programma", {}),
  ent("sensor.lavatrice_livello_vapore", "Livello vapore", {}),
  ent("select.lavatrice_centrifuga", "Centrifuga", { category: "config" }),
  ent("select.lavatrice_temperatura", "Temperatura", { category: "config" }),
  ent("select.lavatrice_programma", "Programma", { category: "config" }),
  ent("select.lavatrice_livello_vapore", "Livello vapore", { category: "config" }),
  ent("select.lavatrice_livello_di_sporco", "Livello di sporco", { category: "config" }),
  ent("switch.lavatrice_utilizzo_nelle_ore_notturne", "Utilizzo nelle ore notturne", {}),
  ent("sensor.lavatrice_lang", "lang", { category: "diagnostic" }),
  ent("switch.lavatrice", "Lavatrice", {}),
  ent("switch.lavatrice_pausa", "Pausa", {}),
  ent("switch.lavatrice_prelavaggio", "Prelavaggio", {}),
  ent("switch.lavatrice_acquaplus", "Acquaplus", {}),
  ent("switch.lavatrice_1_risciacquo", "+1 Risciacquo", {}),
  ent("switch.lavatrice_2_risciacqui", "+2 Risciacqui", {}),
];

test("la Haier italiana: il tasto acceso/spento è la macchina, non la pausa", () => {
  /* Il difetto che questa prova chiude: con dieci interruttori dai nomi
   * italiani nessuna parola inglese corrispondeva, tutti pareggiavano a sei,
   * e il tasto usciva a sorte. L'interruttore che porta il nome del
   * dispositivo e' quello principale, e in questa casa si chiama Lavatrice. */
  const roles = proposeRoles(HAIER_IT, {}, { type: "lavatrice", deviceName: "Lavatrice" });
  assert.equal(roles.control_entity, "switch.lavatrice");
  assert.equal(roles.state_entity, "sensor.lavatrice_machine_status");
  assert.equal(roles.remaining_entity, "sensor.lavatrice_tempo_rimanente");
  /* Nessun sensore in watt e nessun contatore: le caselle restano vuote
   * invece di prendersi il primo numero che passa. */
  assert.equal(roles.power_entity, undefined);
  assert.equal(roles.total_energy_entity, undefined);
  assert.equal(roles.daily_energy_entity, undefined);
  /* La temperatura di una lavatrice e' quella del programma, non una barra. */
  assert.equal(roles.temperature_entity, undefined);
  /* «Capacità di carico» in kg e «Detersivo» in ml non sono energia. */
  assert.equal(roles.last_energy_entity, undefined);
});

test("senza il nome del dispositivo, le parole italiane bastano a scartare le opzioni", () => {
  /* Il nome del dispositivo e' il segnale forte, ma non c'e' sempre: una
   * configurazione scritta a mano puo' non averlo. Allora devono bastare le
   * radici italiane, e nessuna opzione del programma deve vincere. */
  const roles = proposeRoles(HAIER_IT, {}, { type: "lavatrice" });
  assert.equal(roles.control_entity, "switch.lavatrice");
});

test("il collegamento della Haier riempie quello che c'è e lascia vuoto quello che manca", () => {
  const { appliance, filled } = bindApplianceToDevice(
    { id: "appl-haier", name: "" },
    {
      device: {
        id: "haier-1",
        name: "Lavatrice",
        manufacturer: "Haier",
        model: "HW90",
        integration: "hon",
        area: "Lavanderia",
      },
      entities: HAIER_IT,
      integration: { domain: "hon", name: "Haier hOn Revived" },
      states: {},
      rooms: [{ id: "room-lav", name: "Lavanderia" }],
    },
  );
  assert.equal(appliance.name, "Lavatrice");
  assert.equal(appliance.visual_key, "lavatrice");
  assert.equal(appliance.room_id, "room-lav");
  assert.equal(appliance.integration_name, "Haier hOn Revived");
  assert.equal(appliance.control_entity, "switch.lavatrice");
  assert.equal(appliance.state_entity, "sensor.lavatrice_machine_status");
  assert.equal(appliance.remaining_entity, "sensor.lavatrice_tempo_rimanente");
  assert.ok(!filled.includes("power_entity"));
  /* Le venticinque entita' restano tutte in memoria: quelle che la card non
   * disegna escono nel dettaglio, che e' il punto della richiesta. */
  assert.equal(appliance.device_entities.length, HAIER_IT.length);
});
