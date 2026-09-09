/* La tessera dell'energia dice anche com'è andato il giorno.
 *
 * «Oltre ai dati del consumo attuale istantaneo inserirei, sotto in basso in
 *  piccolino, anche quelli della produzione, importazione ecc. del giorno. Per
 *  avere il colpo d'occhio necessario.» (#429)
 *
 * Il numero grande resta la potenza di adesso; sotto, dove prima c'era il solo
 * consumo di casa, adesso ci sono anche produzione, prelievo e immissione.
 * Quali entità dicano quei numeri non lo decide la tessera: lo dice
 * `PERIOD_SOURCES`, la stessa tabella con cui la sezione Energia costruisce i
 * suoi piani.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const sezioni = { rooms: [{ id: "r1", name: "Salone" }], energy: {} };
globalThis.DashboardModernModules = { store: { getSection: (nome) => sezioni[nome] } };

const { modelliDelleTessere } = await import("../src/sections/home-widgets-section.js");
const { sommaOggi } = await import("../src/core/energy-plants.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const kwh = (valore) => ({ state: String(valore), attributes: { unit_of_measurement: "kWh" } });
const STATI = {
  "sensor.casa_w": { state: "820", attributes: { unit_of_measurement: "W" } },
  "sensor.casa_oggi": kwh(12.34),
  "sensor.pv_oggi": kwh(8.12),
  "sensor.prelievo_oggi": kwh(5.2),
  "sensor.immissione_oggi": kwh(2.44),
};
for (const [id, voce] of Object.entries(STATI)) voce.entity_id = id;
globalThis._RAW_STATES = STATI;

function tessera(energia) {
  sezioni.energy = energia;
  const modelli = modelliDelleTessere(STATI) || [];
  return modelli.find((widget) => widget?.key === "energia") || null;
}

test("sotto la potenza ci sono i numeri del giorno, tutti quelli mappati", () => {
  const energia = tessera({
    house: { power: "sensor.casa_w", daily_energy: "sensor.casa_oggi" },
    solar: { daily_energy: "sensor.pv_oggi" },
    grid: {
      daily_import_energy: "sensor.prelievo_oggi",
      daily_export_energy: "sensor.immissione_oggi",
    },
  });
  assert.ok(energia, "la tessera dell'energia non c'è");
  assert.equal(
    energia.caption,
    "Oggi 12,3 kWh · Produzione 8,1 · Prelievo 5,2 · Immissione 2,4",
  );
  // L'unità si scrive una volta: gli altri numeri sono gli stessi kilowattora.
  assert.equal((energia.caption.match(/kWh/g) || []).length, 1);
  assert.deepEqual(energia.oggi, {
    house: 12.34,
    solar: 8.12,
    gridImport: 5.2,
    gridExport: 2.44,
  });
});

test("chi ha mappato solo il consumo legge la didascalia di prima", () => {
  /* La proprietà che tiene: chi non ha chiesto niente non si accorge che
   * questa parte è cambiata. */
  const energia = tessera({
    house: { power: "sensor.casa_w", daily_energy: "sensor.casa_oggi" },
  });
  assert.equal(energia.caption, "Oggi 12,3 kWh");
  assert.equal(energia.today, 12.34);
});

test("senza nemmeno il consumo la didascalia resta quella di sempre", () => {
  const energia = tessera({ house: { power: "sensor.casa_w" } });
  assert.equal(energia.caption, "potenza di casa");
  assert.equal(energia.today, null);
  assert.deepEqual(energia.oggi, {});
});

test("due impianti fanno una casa sola, e i kilowattora si sommano", () => {
  /* La percentuale di una batteria si media — due al 50% non fanno il 100% —
   * ma i kilowattora del giorno di due contatori si sommano. */
  assert.deepEqual(sommaOggi([{ house: 3, solar: 1 }, { house: 4 }]), { house: 7, solar: 1 });
  // Una sorgente che nessun impianto misura resta fuori: due «non lo so» non
  // fanno zero.
  assert.deepEqual(sommaOggi([{ house: null }, {}]), {});
  assert.deepEqual(sommaOggi([null, "no", undefined]), {});
  assert.deepEqual(sommaOggi(), {});
});

test("quale entità dice il giorno lo decide la tabella dei piani, non la tessera", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  assert.match(ponte, /import \{ PERIOD_SOURCES \} from "\.\.\/core\/period-service\.js";/);
  assert.match(ponte, /for \(const piano of PERIOD_SOURCES\) \{/);
  assert.match(ponte, /piano\.periodKeys\.day\]\) \|\| \(primo \? piano\.slots\.day : ""\)/);
  /* Nessun nome di entità del giorno riscritto a mano qui: erano due elenchi
   * per la stessa cosa, e prima o poi la sezione e la tessera avrebbero letto
   * due entità diverse per lo stesso numero. */
  assert.doesNotMatch(ponte, /daily_import_energy|daily_export_energy|dm\.energy_consumo_casa_oggi/);
  // E la finestra del dettaglio scrive il giorno sotto la potenza di ciascuna,
  // li' con le parole intere, che nella finestra ci stanno.
  assert.match(ponte, /sotto: delGiorno\[riga\.group\]/);
  assert.match(ponte, /const glifi = GLIFI_ENERGIA;/);
  // Un disegno per sorgente, in un posto solo: due mappe uguali sono il modo
  // di far comparire un sole di qua e una spina di la' per la stessa corrente.
  assert.equal((ponte.match(/house: "🏠", solar: "☀️"/g) || []).length, 0);
});
