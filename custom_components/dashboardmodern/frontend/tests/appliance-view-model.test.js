import assert from "node:assert/strict";
import test from "node:test";
import { createApplianceViewModel } from "../src/core/appliance-view-model.js";

const device = {
  id: "washer",
  name: "Lavatrice",
  power_entity: "sensor.washer_power",
  control_entity: "switch.washer",
  total_energy_entity: "sensor.washer_energy",
  threshold_standby: 1,
  threshold_run: 5,
};
const states = (power, control = "on") => ({
  "sensor.washer_power": { state: String(power), attributes: { unit_of_measurement: "W" } },
  "switch.washer": { state: control, attributes: {} },
  "sensor.washer_energy": {
    state: "184.2",
    attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
  },
});

test("one appliance view model owns status, summary, badge, action and history", () => {
  const model = createApplianceViewModel(device, states(12), [], "it");
  assert.equal(model.mode, "running");
  assert.equal(model.label, "IN FUNZIONE");
  assert.equal(model.badge, model.summary.mode);
  assert.equal(model.summary.label, model.label);
  assert.equal(model.action.service, "turn_off");
  assert.equal(model.historyEntity, "sensor.washer_energy");
});

test("con «senza tasto» l'interruttore mappato legge lo stato ma non offre il tasto", () => {
  /* «Aggiungere la possibilita' di disabilitare lo switch on/off»: chi mappa
   * l'interruttore del frigo per leggere lo stato non vuole spegnerlo da una
   * card. La lettura resta identica, sparisce solo l'azione. */
  const model = createApplianceViewModel(
    { ...device, switch_disabled: true },
    states(12),
    [],
    "it",
  );
  assert.equal(model.action.visible, false);
  assert.equal(model.mode, "running");
  assert.equal(model.controlEntity, "switch.washer");
  // Senza il flag il tasto resta, com'e' sempre stato.
  assert.equal(createApplianceViewModel(device, states(12), [], "it").action.visible, true);
});

test("appliance thresholds produce STANDBY and SPENTO deterministically", () => {
  assert.equal(createApplianceViewModel(device, states(2), [], "it").label, "STANDBY");
  assert.equal(createApplianceViewModel(device, states(0, "off"), [], "it").label, "SPENTO");
});

test("a powered smart plug at 0 W is not reported as IN FUNZIONE", () => {
  const model = createApplianceViewModel(
    { ...device, entities: ["switch.washer", "sensor.washer_power", "sensor.washer_energy"] },
    states(0, "on"),
    [],
    "it",
  );
  assert.equal(model.stateEntity, "");
  assert.equal(model.mode, "standby");
  assert.equal(model.label, "STANDBY");
});

test("canonical state_entity drives status even without power or control entities", () => {
  const model = createApplianceViewModel(
    { id: "dryer", name: "Asciugatrice", state_entity: "sensor.dryer_state" },
    { "sensor.dryer_state": { state: "running", attributes: {} } },
    [],
    "it",
  );
  assert.equal(model.stateEntity, "sensor.dryer_state");
  assert.equal(model.mode, "running");
  assert.equal(model.label, "IN FUNZIONE");
});

test("generic ON state means standby when a power sensor says 0 W", () => {
  const model = createApplianceViewModel(
    { ...device, state_entity: "binary_sensor.washer_ready" },
    { ...states(0, "on"), "binary_sensor.washer_ready": { state: "on", attributes: {} } },
    [],
    "it",
  );
  assert.equal(model.mode, "standby");
  assert.equal(model.label, "STANDBY");
});

test("monthly energy measurements do not masquerade as lifetime history", () => {
  const monthly = "sensor.energy_mese_microonde";
  const model = createApplianceViewModel(
    {
      id: "microwave",
      monthly_energy_entity: monthly,
      history_entity: monthly,
      report_entity: monthly,
    },
    {
      [monthly]: {
        state: "3.2",
        attributes: {
          unit_of_measurement: "kWh",
          state_class: "measurement",
          device_class: "energy",
        },
      },
    },
    [],
    "it",
  );
  assert.equal(model.historyEntity, "");
});

test("legacy status_entity remains supported after migration", () => {
  const model = createApplianceViewModel(
    { id: "dishwasher", status_entity: "sensor.dishwasher_status" },
    { "sensor.dishwasher_status": { state: "off", attributes: {} } },
    [],
    "en",
  );
  assert.equal(model.stateEntity, "sensor.dishwasher_status");
  assert.equal(model.mode, "off");
  assert.equal(model.label, "OFF");
});

test("off_delay_minutes keeps the card running through the 0 W drying phase", () => {
  const holds = new Map();
  const delayed = { ...device, off_delay_minutes: 30 };
  const at = (power, control, now) =>
    createApplianceViewModel(delayed, states(power, control), [], "it", { now, holds });
  const t0 = Date.parse("2026-08-16T10:00:00");
  assert.equal(at(1800, "on", t0).mode, "running");
  // Drying: 0 W with the plug still on, inside the configured window.
  assert.equal(at(0, "on", t0 + 10 * 60000).mode, "running");
  assert.equal(at(0, "on", t0 + 29 * 60000).mode, "running");
  // Window expired: the cycle is over and the hold is forgotten.
  assert.equal(at(0, "on", t0 + 31 * 60000).mode, "standby");
  assert.equal(at(0, "on", t0 + 32 * 60000).mode, "standby");
});

test("a new power reading above threshold restarts the end-of-cycle window", () => {
  const holds = new Map();
  const delayed = { ...device, off_delay_minutes: 10 };
  const at = (power, now) =>
    createApplianceViewModel(delayed, states(power, "on"), [], "it", { now, holds });
  const t0 = Date.parse("2026-08-16T10:00:00");
  assert.equal(at(900, t0).mode, "running");
  assert.equal(at(0, t0 + 8 * 60000).mode, "running");
  // The rinse pump spikes again: the window restarts from here.
  assert.equal(at(700, t0 + 9 * 60000).mode, "running");
  assert.equal(at(0, t0 + 17 * 60000).mode, "running");
  assert.equal(at(0, t0 + 20 * 60000).mode, "standby");
});

test("an explicit off wins immediately over the end-of-cycle delay", () => {
  const holds = new Map();
  const delayed = { ...device, off_delay_minutes: 30 };
  const t0 = Date.parse("2026-08-16T10:00:00");
  assert.equal(
    createApplianceViewModel(delayed, states(1800, "on"), [], "it", { now: t0, holds }).mode,
    "running",
  );
  // The user switches the smart plug off: no guessing, the card goes off now.
  assert.equal(
    createApplianceViewModel(delayed, states(0, "off"), [], "it", { now: t0 + 60000, holds }).mode,
    "off",
  );
  // And the hold is gone: turning the plug back on does not resurrect the cycle.
  assert.equal(
    createApplianceViewModel(delayed, states(0, "on"), [], "it", { now: t0 + 120000, holds }).mode,
    "standby",
  );
});

test("without off_delay_minutes the ladder is untouched by the hold", () => {
  const holds = new Map();
  const t0 = Date.parse("2026-08-16T10:00:00");
  assert.equal(
    createApplianceViewModel(device, states(1800), [], "it", { now: t0, holds }).mode,
    "running",
  );
  assert.equal(
    createApplianceViewModel(device, states(0, "on"), [], "it", { now: t0 + 1000, holds }).mode,
    "standby",
  );
});

test("unknown and unavailable configured states are not presented as OFF", () => {
  for (const value of ["unknown", "unavailable"]) {
    const model = createApplianceViewModel(
      { id: "offline", state_entity: "sensor.offline_state" },
      { "sensor.offline_state": { state: value, attributes: {} } },
      [],
      "en",
    );
    assert.equal(model.mode, "unavailable");
    assert.equal(model.label, "UNAVAILABLE");
  }
});

/* La scadenza del ritardo bussa da sola.
 *
 * Un elettrodomestico che ha smesso di consumare non manda piu' nessun cambio
 * di stato — e' per questo che il ritardo esiste — quindi il ritardo scadeva
 * solo alla prossima chiamata del modello, che poteva non arrivare per ore: la
 * lavastoviglie restava IN FUNZIONE a ciclo finito. Adesso il modello mette
 * una sveglia sulla scadenza e chi disegna la sente.
 */
test("il ritardo di fine ciclo avvisa chi disegna quando scade", async () => {
  const { createApplianceViewModel, onRunHoldExpiry, resetRunHolds } =
    await import("../src/core/appliance-view-model.js");
  resetRunHolds();
  const sveglie = [];
  const stacca = onRunHoldExpiry(() => sveglie.push(Date.now()));
  const originale = globalThis.setTimeout;
  const pianificate = [];
  globalThis.setTimeout = (callback, delay) => {
    pianificate.push({ callback, delay });
    return pianificate.length;
  };
  try {
    const holds = new Map();
    const ritardata = { ...device, off_delay_minutes: 30 };
    const t0 = Date.parse("2026-08-16T10:00:00");
    const al = (power, now) =>
      createApplianceViewModel(ritardata, states(power, "on"), [], "it", { now, holds });
    assert.equal(al(1800, t0).mode, "running");
    // Niente sveglia finche' consuma: la scadenza non e' ancora cominciata.
    assert.equal(pianificate.length, 0);
    assert.equal(al(0, t0 + 60000).mode, "running");
    assert.equal(pianificate.length, 1, "il ritardo in corso mette la sua sveglia");
    // Suona dopo i trenta minuti dall'ultimo consumo, con un pelo di margine.
    assert.equal(pianificate[0].delay, 29 * 60000 + 250);
    pianificate[0].callback();
    assert.equal(sveglie.length, 1, "chi disegna viene avvisato");
  } finally {
    globalThis.setTimeout = originale;
    stacca();
    resetRunHolds();
  }
});

test("«heating» e «cleaning» sono modi di dire che sta lavorando", () => {
  /* Due parole che qui mancavano, e che la finestra dei sotto-carichi conosceva
   * quando aveva una regola sua. Adesso che la regola e' una sola dovevano
   * arrivare qui, altrimenti un termosifone in fase bassa o un robot che sta
   * pulendo con la ventola al minimo direbbero SPENTO mentre lavorano — e lo
   * direbbero su tutt'e due le schermate. */
  const conStato = (stato, potenza) =>
    createApplianceViewModel(
      { ...device, state_entity: "sensor.fase", control_entity: "" },
      {
        "sensor.washer_power": {
          state: String(potenza),
          attributes: { unit_of_measurement: "W" },
        },
        "sensor.fase": { state: stato, attributes: {} },
      },
      [],
      "it",
    ).mode;

  assert.equal(conStato("heating", 0), "running", "il termostato che scalda");
  assert.equal(conStato("cleaning", 0), "running", "l'aspirapolvere che pulisce");
  /* E le parole di prima restano tali e quali. */
  assert.equal(conStato("heat", 0), "running");
  assert.equal(conStato("running", 0), "running");
  assert.equal(conStato("idle", 0), "off");
});

/* Senza sensore di potenza, lo stato del programma decide da solo.
 *
 * Dal campo: «prevedi che se non viene messo il sensore potenza il cambio
 * stato acceso e in funzione lo devi capire dagli stati dei programmi». Una
 * lavatrice connessa spesso non ha nessuna presa smart sotto: i watt non
 * esistono, e l'unica cosa che parla e' la parola che l'integrazione
 * pubblica. Qui ci sono le parole vere di cinque integrazioni.
 */
const senzaWatt = (stato) => ({
  device: { id: "hon-washer", name: "Lavatrice", state_entity: "sensor.lavatrice_machine_status" },
  states: { "sensor.lavatrice_machine_status": { state: stato, attributes: {} } },
});

function modoSenzaWatt(stato) {
  const { device: d, states: s } = senzaWatt(stato);
  return createApplianceViewModel(d, s, [], "it", { holds: new Map() }).mode;
}

test("senza watt, le fasi di un ciclo dicono IN FUNZIONE", () => {
  /* hOn: il modo macchina e le quattro fasi che si vedono su una Hoover. */
  for (const parola of ["running", "washing", "rinse", "spin", "drying", "steam"]) {
    assert.equal(modoSenzaWatt(parola), "running", `hOn «${parola}»`);
  }
  /* Home Connect scrive Run, Miele in_use, SmartThings wash e weightSensing,
   * e ognuno con le sue maiuscole e i suoi underscore. */
  for (const parola of ["Run", "in_use", "inUse", "wash", "weightSensing", "PreWash", "Cooking"]) {
    assert.equal(modoSenzaWatt(parola), "running", `«${parola}»`);
  }
});

test("senza watt, pronta e finita dicono SPENTO", () => {
  for (const parola of [
    "ready",
    "end",
    "finished",
    "Finished",
    "program_ended",
    "off",
    "initial",
  ]) {
    assert.equal(modoSenzaWatt(parola), "off", `«${parola}»`);
  }
});

test("senza watt, in pausa e avvio ritardato dicono STANDBY e non SPENTO", () => {
  /* «Acceso ma fermo» e' una risposta vera: la macchina non sta lavorando, ma
   * dire SPENTO a un ciclo in pausa o programmato per le tre di notte
   * significa far sparire dalla plancia un bucato che c'e'. */
  for (const parola of [
    "pause",
    "Pause",
    "scheduled",
    "delayed_start",
    "DelayedStart",
    "programmed",
    "waiting_to_start",
  ]) {
    assert.equal(modoSenzaWatt(parola), "standby", `«${parola}»`);
  }
});

test("una parola che non conosciamo lascia parlare i watt", () => {
  /* Il vocabolario non indovina: se la parola non e' fra quelle note, la
   * decisione torna dov'era, alla potenza. */
  assert.equal(modoSenzaWatt("mistero_totale"), "off");
  const model = createApplianceViewModel(
    { id: "x", state_entity: "sensor.s", power_entity: "sensor.p", threshold_run: 5 },
    {
      "sensor.s": { state: "mistero_totale", attributes: {} },
      "sensor.p": { state: "1900", attributes: { unit_of_measurement: "W" } },
    },
    [],
    "it",
    { holds: new Map() },
  );
  assert.equal(model.mode, "running");
});

test("i watt e la parola non si contraddicono: comanda chi dice che si sta lavorando", () => {
  const conWatt = (stato, watt) =>
    createApplianceViewModel(
      { id: "y", state_entity: "sensor.s", power_entity: "sensor.p", threshold_run: 5 },
      {
        "sensor.s": { state: stato, attributes: {} },
        "sensor.p": { state: String(watt), attributes: { unit_of_measurement: "W" } },
      },
      [],
      "it",
      { holds: new Map() },
    ).mode;
  /* L'asciugatura della lavastoviglie: zero watt, ma il ciclo non e' finito. */
  assert.equal(conWatt("drying", 0), "running");
  /* Uno stato «finito» rimasto indietro non spegne una macchina che tira. */
  assert.equal(conWatt("finished", 1900), "running");
  /* E fermo davvero e' fermo. */
  assert.equal(conWatt("finished", 0), "off");
});

test("lo stato si sceglie da solo quando nessuno l'ha configurato", () => {
  /* Una configurazione vecchia ha solo la lista `entities`: il sensore della
   * fase si riconosce dal nome piu' la parola che dice adesso. */
  const model = createApplianceViewModel(
    { id: "z", entities: ["sensor.lavatrice_program_phase", "sensor.lavatrice_rssi"] },
    {
      "sensor.lavatrice_program_phase": { state: "spin", attributes: {} },
      "sensor.lavatrice_rssi": { state: "-61", attributes: { unit_of_measurement: "dBm" } },
    },
    [],
    "it",
    { holds: new Map() },
  );
  assert.equal(model.stateEntity, "sensor.lavatrice_program_phase");
  assert.equal(model.mode, "running");
});
