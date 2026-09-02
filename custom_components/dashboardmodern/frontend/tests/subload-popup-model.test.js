// DM-FIX-20260817C
import assert from "node:assert/strict";
import test from "node:test";

import {
  formatKwh,
  formatWatts,
  subloadPopupModel,
  subloadState,
} from "../src/core/subload-popup-model.js";
import { createApplianceViewModel, resetRunHolds } from "../src/core/appliance-view-model.js";

const KITCHEN = { id: "cucina", name: "Cucina", icon: "🍳", color: "#f97316" };

function child(id, name, overrides = {}) {
  return { id, name, icon: "🔌", power: `sensor.${id}_power`, ...overrides };
}

test("the popup total is the sum of the appliances, the same number the circle shows", () => {
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [child("forno", "Forno"), child("frigo", "Frigorifero")],
    states: {
      "sensor.forno_power": { state: "1800" },
      "sensor.frigo_power": { state: "95" },
    },
  });
  assert.equal(model.total, 1895);
  assert.equal(model.totalText, "1,90 kW");
  assert.equal(model.count, 2);
  assert.equal(model.running, 2);
});

test("appliances are ranked by draw, with the share measured inside the group", () => {
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [child("frigo", "Frigorifero"), child("forno", "Forno"), child("radio", "Radio")],
    states: {
      "sensor.frigo_power": { state: "95" },
      "sensor.forno_power": { state: "1800" },
      "sensor.radio_power": { state: "0" },
    },
  });
  assert.deepEqual(
    model.items.map(({ name }) => name),
    ["Forno", "Frigorifero", "Radio"],
  );
  assert.equal(model.items[0].share, 1);
  assert.ok(model.items[1].share > 0 && model.items[1].share < 0.1);
  assert.equal(model.items[2].share, 0);
});

test("idle is not an error state, and a missing reading is not an off one", () => {
  const states = {
    "sensor.forno_power": { state: "1800" },
    "sensor.frigo_power": { state: "1.5" },
    "sensor.radio_power": { state: "0" },
  };
  assert.equal(subloadState(child("forno", "Forno"), states).key, "running");
  assert.equal(subloadState(child("frigo", "Frigo"), states).key, "standby");
  assert.equal(subloadState(child("radio", "Radio"), states).key, "off");
  assert.equal(subloadState(child("assente", "Assente"), states).key, "unknown");
  // Off and standby are neutral surfaces; only a fault-free accent for running.
  assert.notEqual(subloadState(child("radio", "Radio"), states).color, "#e11d48");
});

/* ── la stessa parola della sezione Elettrodomestici ────────────────────────
 *
 * «tutti e otto dicono IN FUNZIONE anche a 0 W»: nel filmato la finestra del
 * cerchio Elettrodomestici segna «8/8 IN FUNZIONE» con sei apparecchi a zero
 * watt. Qui c'era una seconda regola, piu' corta, in cui un interruttore acceso
 * bastava a dire «in funzione» — mentre la carta dello stesso apparecchio, due
 * schermate piu' in la', diceva STANDBY. Due regole per la stessa domanda sono
 * due risposte diverse sulla stessa casa.
 *
 * Adesso la domanda la fa una funzione sola: `createApplianceViewModel`, quella
 * della sezione Elettrodomestici. Un interruttore generico acceso a zero watt
 * vuol dire che c'e' corrente, non che l'apparecchio stia lavorando.
 */
test("una presa accesa a zero watt e' STANDBY, come dice la carta dell'apparecchio", () => {
  const presa = child("frigo", "Frigorifero", { control_entity: "switch.presa_frigo" });
  const states = {
    "switch.presa_frigo": { state: "on" },
    "sensor.frigo_power": { state: "0", attributes: { unit_of_measurement: "W" } },
  };
  assert.equal(subloadState(presa, states).key, "standby");

  /* E la stessa parola, chiesta all'altra strada: e' questa l'uguaglianza
   * richiesta, non una somiglianza. */
  assert.equal(
    createApplianceViewModel(
      { ...presa, power_entity: "sensor.frigo_power" },
      states,
    ).mode,
    subloadState(presa, states).key,
  );
});

test("a dire IN FUNZIONE sono i watt, o uno stato che lo dice con parole sue", () => {
  /* Un sensore di attivita' chiamato per quello che e': la lavatrice a meta'
   * ciclo consuma quasi niente e resta IN FUNZIONE. */
  const lavatrice = child("lavatrice", "Lavatrice", {
    state_entity: "binary_sensor.lavatrice_running",
  });
  assert.equal(
    subloadState(lavatrice, {
      "binary_sensor.lavatrice_running": { state: "on" },
      "sensor.lavatrice_power": { state: "0", attributes: { unit_of_measurement: "W" } },
    }).key,
    "running",
  );

  /* Uno stato che dice `running` con parole sue vale uguale. */
  const forno = child("forno", "Forno", { state_entity: "sensor.forno_state" });
  assert.equal(
    subloadState(forno, {
      "sensor.forno_state": { state: "running" },
      "sensor.forno_power": { state: "0", attributes: { unit_of_measurement: "W" } },
    }).key,
    "running",
  );

  /* E lo spento dichiarato vince sul filo di corrente, come sulla carta. */
  assert.equal(
    subloadState(lavatrice, {
      "binary_sensor.lavatrice_running": { state: "off" },
      "sensor.lavatrice_power": { state: "2", attributes: { unit_of_measurement: "W" } },
    }).key,
    "off",
  );
});

test("un contatore in kW sono watt, non un numero letto e basta", () => {
  /* La finestra leggeva il numero e via: 0,27 kW diventavano «0 W», cioe' un
   * apparecchio spento mentre stava consumando duecentosettanta watt — e la sua
   * carta, due schermate piu' in la', diceva 270 W e IN FUNZIONE. */
  const condizionatore = child("clima", "Condizionatore");
  const states = {
    "sensor.clima_power": { state: "0.27", attributes: { unit_of_measurement: "kW" } },
  };
  const model = subloadPopupModel({ load: KITCHEN, children: [condizionatore], states });
  assert.equal(model.items[0].power, 270);
  assert.equal(model.items[0].state, "running");
});

test("il ritardo di fine ciclo vale anche qui: la stessa memoria, lo stesso ciclo", () => {
  /* La lavastoviglie che asciuga consuma 0 W ma il ciclo non e' finito. La
   * sezione Elettrodomestici lo sa gia' fare con `off_delay_minutes`; la
   * finestra del cerchio non lo sapeva, perche' aveva una regola sua. */
  resetRunHolds();
  const lavastoviglie = child("lavastoviglie", "Lavastoviglie", { off_delay_minutes: 30 });
  const acceso = {
    "sensor.lavastoviglie_power": { state: "900", attributes: { unit_of_measurement: "W" } },
  };
  const asciuga = {
    "sensor.lavastoviglie_power": { state: "0", attributes: { unit_of_measurement: "W" } },
  };
  assert.equal(subloadState(lavastoviglie, acceso).key, "running");
  assert.equal(
    subloadState(lavastoviglie, asciuga).key,
    "running",
    "il ciclo non e' finito: la finestra dice spento mentre la carta dice in funzione",
  );
  resetRunHolds();
  assert.equal(subloadState(lavastoviglie, asciuga).key, "off");
});

test("an appliance with no reading shows as absent, never as zero", () => {
  const model = subloadPopupModel({ load: KITCHEN, children: [child("forno", "Forno")], states: {} });
  assert.equal(model.items[0].power, null);
  assert.equal(model.items[0].powerText, "—");
  assert.equal(model.total, null);
  assert.equal(model.totalText, "—");
});

test("readings are formatted the way the dashboard formats them", () => {
  assert.equal(formatWatts(950), "950 W");
  assert.equal(formatWatts(1895), "1,90 kW");
  assert.equal(formatWatts(1895, "en-GB"), "1.90 kW");
  assert.equal(formatWatts(null), "—");
  assert.equal(formatKwh(2.34), "2,3 kWh");
  assert.equal(formatKwh(null), "");
});

test("the legacy popup rows are read as they are, without a second config", () => {
  // `pwr`/`bin` are the shapes the hosted popup already stores.
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [{ id: "forno", name: "Forno", pwr: "sensor.forno_power", bin: "binary_sensor.forno" }],
    states: {
      "sensor.forno_power": { state: "1800" },
      "binary_sensor.forno": { state: "on" },
    },
  });
  assert.equal(model.items[0].power, 1800);
  assert.equal(model.items[0].state, "running");
});

test("a circle with nothing inside says so instead of showing an empty grid", () => {
  const model = subloadPopupModel({ load: KITCHEN, children: [], states: {} });
  assert.equal(model.count, 0);
  assert.equal(model.total, null);
  assert.deepEqual(model.items, []);
});

test("the popup names the circle it was opened from, with its period", () => {
  const model = subloadPopupModel({ load: KITCHEN, children: [child("forno", "Forno")], states: {} });
  // The modal heading was a static "CARICHI": nothing said which circle it was.
  assert.equal(model.name, "Cucina");
  assert.equal(model.icon, "🍳");
  assert.equal(model.id, "cucina");
});

/* ── ogni apparecchio col suo disegno ──────────────────────────────────────
 *
 * «Nel popup energetico dei carichi elettrodomestici le icone riportate non
 * sono quelle inserite»: otto apparecchi e otto prese uguali. Il tipo arrivava
 * fin qui e veniva buttato via. */

test("il tipo dell'elettrodomestico arriva fino alla carta", () => {
  const model = subloadPopupModel({
    load: KITCHEN,
    children: [
      { id: "lav", name: "Lavatrice", device_type: "lavatrice" },
      { id: "fri", name: "Frigorifero", type: "frigorifero" },
      { id: "cnd", name: "Condizionatore", visual_key: "condizionatori" },
      { id: "gen", name: "Frog" },
    ],
    states: {},
  });
  const di = (id) => model.items.find((item) => item.id === id);
  assert.equal(di("lav").visual, "lavatrice");
  assert.equal(di("fri").visual, "frigorifero");
  /* Il campo del catalogo vince sul tipo, come nell'elenco della scheda
   * Carichi: e' quello che chi configura ha scelto a mano. */
  assert.equal(di("cnd").visual, "condizionatori");
  // Chi un tipo non ce l'ha non ne riceve uno inventato: resta il carattere.
  assert.equal(di("gen").visual, "");
  assert.equal(di("gen").icon, "🔌");
});

test("le due schede che parlano della stessa lavatrice la leggono allo stesso modo", async () => {
  /* L'elenco della scheda Carichi risolveva gia' il tipo cosi'; il popup no, e
   * per questo mostravano due lavatrici diverse. La regola e' una sola, e
   * queste due righe la tengono uguale nei due posti. */
  const { readFile } = await import("node:fs/promises");
  const regola = /visual_key \|\| child\.visual \|\| child\.device_type \|\| child\.type/;
  for (const dove of ["../src/core/energy-loads-config.js", "../src/core/subload-popup-model.js"]) {
    const fonte = await readFile(new URL(dove, import.meta.url), "utf8");
    assert.match(fonte, regola, dove);
  }
});

/* ── il periodo decide i numeri, non solo la scritta ───────────────────────
 *
 * «I popup giornaliera e mensile non riportano i dati corretti: portano quelli
 * attualmente in consumo.» La finestra scriveva GIORNO o MESE in testata e poi
 * mostrava i watt di adesso, con sotto «kWh oggi» anche guardando il mese. */

const CASA = { id: "elettro", name: "Elettrodomestici", icon: "🔌", color: "#0ea5e9" };
const DENTRO = [
  { id: "cond", name: "Condizionatore", power: "sensor.cond_power", daily: "sensor.cond_day", monthly: "sensor.cond_month" },
  { id: "frigo", name: "Frigorifero", power: "sensor.frigo_power", daily: "sensor.frigo_day", monthly: "sensor.frigo_month" },
];
const STATI = {
  "sensor.cond_power": { state: "1170" },
  "sensor.cond_day": { state: "7.5" },
  "sensor.cond_month": { state: "41.2" },
  "sensor.frigo_power": { state: "84" },
  "sensor.frigo_day": { state: "0.7" },
  "sensor.frigo_month": { state: "21" },
};
const perPeriodo = (period) =>
  subloadPopupModel({ load: CASA, children: DENTRO, states: STATI, period });

test("in ISTANTANEO il numero grande sono i watt, e sotto i kWh di oggi", () => {
  const model = perPeriodo("instant");
  const cond = model.items.find((item) => item.id === "cond");
  assert.equal(cond.valoreText, "1,17 kW");
  assert.equal(cond.sottoText, "7,5 kWh");
  assert.equal(cond.sottoQuando, "oggi");
  assert.equal(model.totalText, "1,25 kW");
});

test("nel GIORNO il numero grande è l'energia di oggi, e sotto i watt di adesso", () => {
  const model = perPeriodo("day");
  const cond = model.items.find((item) => item.id === "cond");
  assert.equal(cond.valoreText, "7,5 kWh");
  assert.equal(cond.sottoText, "1,17 kW");
  assert.equal(cond.sottoQuando, "adesso");
  // Il totale in testata è la somma di quel periodo, non dei watt.
  assert.equal(model.totalText, "8,2 kWh");
});

test("nel MESE il numero grande è l'energia del mese", () => {
  const model = perPeriodo("month");
  assert.equal(model.items.find((item) => item.id === "cond").valoreText, "41,2 kWh");
  assert.equal(model.items.find((item) => item.id === "frigo").valoreText, "21,0 kWh");
  assert.equal(model.totalText, "62,2 kWh");
});

test("l'ordine e la barra seguono il periodo che si sta guardando", () => {
  /* Nel Giorno il condizionatore ha consumato piu' del frigo, e la barra
   * confronta dentro il periodo: ordinare per watt lascerebbe in cima chi in
   * questo momento tira di piu', che nel Mese non vuol dire niente. */
  const mese = perPeriodo("month");
  assert.deepEqual(mese.items.map((item) => item.id), ["cond", "frigo"]);
  assert.equal(mese.items[0].share, 1);
  assert.ok(Math.abs(mese.items[1].share - 21 / 41.2) < 1e-9);
});

test("un periodo sconosciuto non inventa numeri: resta l'istantaneo", () => {
  assert.equal(perPeriodo("settimana").periodo, "instant");
  assert.equal(perPeriodo().periodo, "instant");
});

test("un apparecchio senza contatore del mese non finisce nel totale", () => {
  /* Non lo si conta come zero: «non lo so» e «non ha consumato» sono due cose
   * diverse, e la seconda detta al posto della prima fa una somma piu' bassa
   * del vero senza dirlo. */
  const model = subloadPopupModel({
    load: CASA,
    children: [...DENTRO, { id: "muto", name: "Frog", power: "sensor.muto_power" }],
    states: { ...STATI, "sensor.muto_power": { state: "0" } },
    period: "month",
  });
  assert.equal(model.items.find((item) => item.id === "muto").valore, null);
  assert.equal(model.totalText, "62,2 kWh");
});
