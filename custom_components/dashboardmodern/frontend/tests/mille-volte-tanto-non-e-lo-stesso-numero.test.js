/* Un contatore in Wh non vale mille volte uno in kWh.
 *
 * Home Assistant lascia scegliere l'unita' a chi produce il contatore: Wh e
 * MWh sono legittime quanto kWh. La plancia pero' scriveva «kWh» sotto ogni
 * numero e il numero lo prendeva e basta. Un contatore giornaliero da 1234 Wh
 * — che sono 1,234 kWh — si leggeva 1234 kWh: mille volte tanto, e senza
 * niente sullo schermo che lo facesse sospettare.
 *
 * La cosa da provare non e' solo che il numero adesso e' giusto. E' che la
 * conversione stia in UN posto solo: la tessera della Home e la sezione
 * Energia leggono le stesse entita', e se una delle due convertisse e l'altra
 * no direbbero due numeri diversi sulla stessa cosa — che e' il guasto
 * peggiore dei due, perche' toglie anche il modo di accorgersene.
 *
 * Il Recorder converte gia' per conto suo: gli si chiede
 * `units: { energy: "kWh" }`. Quelle righe qui non si toccano. Si toccano
 * solo le righe della domanda di ripiego, quella per le versioni di Home
 * Assistant che `units` non lo conoscono.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  HomeAssistantBroker,
  inKilowattora,
  righeInKilowattora,
  smistaIPiani,
  sourcePlans,
} from "../src/core/period-service.js";

/* Lo stesso consumo vero — 1,234 kWh — dichiarato in tre unita' diverse. */
const CONTATORI = [
  { entity: "sensor.casa_oggi_wh", state: "1234", unit: "Wh" },
  { entity: "sensor.casa_oggi_kwh", state: "1.234", unit: "kWh" },
  { entity: "sensor.casa_oggi_mwh", state: "0.001234", unit: "MWh" },
];

function casa({ entity, state, unit }) {
  return {
    energy: { house: { daily_energy: entity } },
    states: {
      [entity]: {
        entity_id: entity,
        state,
        attributes: { unit_of_measurement: unit, device_class: "energy" },
      },
    },
  };
}

function letturaDelGiorno({ energy, states }) {
  const plans = sourcePlans(energy, "day", states);
  return smistaIPiani(plans, new Date(), states).valori.get("house");
}

test("tre contatori con la stessa energia vera danno lo stesso numero", () => {
  const letti = CONTATORI.map((contatore) => letturaDelGiorno(casa(contatore)));
  letti.forEach((valore, indice) => {
    assert.ok(
      Math.abs(valore - 1.234) < 1e-9,
      `${CONTATORI[indice].unit}: letto ${valore} invece di 1,234 kWh`,
    );
  });
});

test("un sensore che non dichiara l'unita' vale kilowattora, come prima", () => {
  const entity = "sensor.casa_oggi_muto";
  const valore = letturaDelGiorno({
    energy: { house: { daily_energy: entity } },
    states: {
      [entity]: { entity_id: entity, state: "7.5", attributes: { device_class: "energy" } },
    },
  });
  assert.equal(valore, 7.5);
});

test("un contatore senza stato resta senza valore, non diventa zero", () => {
  const entity = "sensor.casa_oggi_vuoto";
  const valore = letturaDelGiorno({
    energy: { house: { daily_energy: entity } },
    states: {
      [entity]: {
        entity_id: entity,
        state: "unavailable",
        attributes: { unit_of_measurement: "Wh", device_class: "energy" },
      },
    },
  });
  assert.equal(valore, undefined, "senza lettura non si inventa un numero");
});

test("il piano si porta dietro l'unita' dichiarata dalla sua entita'", () => {
  const { energy, states } = casa(CONTATORI[0]);
  const [piano] = sourcePlans(energy, "day", states);
  assert.equal(piano.unita, "wh");
});

test("la conversione conosce le tre unita' e lascia stare tutto il resto", () => {
  assert.equal(inKilowattora(1234, "Wh"), 1.234);
  assert.equal(inKilowattora(1.234, "kWh"), 1.234);
  assert.equal(inKilowattora(0.001234, "MWh"), 1.234);
  assert.equal(inKilowattora(7.5, ""), 7.5);
  assert.equal(inKilowattora("non un numero", "Wh"), null);
});

test("le righe che parlano gia' kilowattora non si convertono una seconda volta", () => {
  const righe = [
    { start: 1, sum: 10 },
    { start: 2, sum: 20 },
  ];
  assert.equal(righeInKilowattora(righe, "kWh"), righe, "sono proprio le stesse righe");
  assert.equal(righeInKilowattora(righe, ""), righe);
});

test("le righe della domanda di ripiego si portano in kilowattora", () => {
  const righe = [
    { start: 1, sum: 1000 },
    { start: 2, sum: 2500 },
  ];
  assert.deepEqual(
    righeInKilowattora(righe, "Wh").map((riga) => riga.sum),
    [1, 2.5],
  );
  assert.deepEqual(
    righe.map((riga) => riga.sum),
    [1000, 2500],
    "le righe di partenza restano intatte",
  );
});

/* Un broker che rifiuta `units` come le vecchie versioni di Home Assistant, e
 * risponde alla seconda domanda con le righe nell'unita' del sensore. */
function brokerAllaVecchiaManiera() {
  const broker = new HomeAssistantBroker();
  const domande = [];
  broker.request = async (payload) => {
    domande.push(payload);
    if (payload.units) throw new Error("extra keys not allowed @ data['units']");
    return {
      "sensor.casa_totale": [
        { start: 1, sum: 1000 },
        { start: 2, sum: 3000 },
      ],
    };
  };
  return { broker, domande };
}

test("col Recorder vecchio le righe arrivano in Wh e vengono convertite qui", async () => {
  const { broker, domande } = brokerAllaVecchiaManiera();
  const righe = await broker.statistics(
    ["sensor.casa_totale"],
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-02T00:00:00.000Z"),
    "day",
    { "sensor.casa_totale": "wh" },
  );
  assert.equal(domande.length, 2, "prima con units, poi senza");
  assert.deepEqual(
    righe["sensor.casa_totale"].map((riga) => riga.sum),
    [1, 3],
  );
});

test("col Recorder che conosce units le righe non si toccano: converte lui", async () => {
  const broker = new HomeAssistantBroker();
  broker.request = async () => ({
    "sensor.casa_totale": [
      { start: 1, sum: 1000 },
      { start: 2, sum: 3000 },
    ],
  });
  const righe = await broker.statistics(
    ["sensor.casa_totale"],
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-02T00:00:00.000Z"),
    "day",
    /* L'unita' del sensore e' Wh, ma la risposta e' gia' in kWh perche' e'
     * stato chiesto: riconvertirla la sballerebbe di mille nell'altro verso. */
    { "sensor.casa_totale": "wh" },
  );
  assert.deepEqual(
    righe["sensor.casa_totale"].map((riga) => riga.sum),
    [1000, 3000],
  );
});

/* Il pezzo di sorgente fra una funzione e la sua chiusura. */
function corpoDi(sorgente, firma) {
  const inizio = sorgente.indexOf(firma);
  assert.notEqual(inizio, -1, `non c'e' piu' nessuna ${firma}`);
  const fine = sorgente.indexOf("\n}\n", inizio);
  assert.notEqual(fine, -1, `${firma} non si chiude`);
  return sorgente.slice(inizio, fine);
}

const TESSERA = readFileSync(
  new URL("../src/sections/beta4-mobile-polish-section.js", import.meta.url),
  "utf8",
);
const SEZIONE = readFileSync(new URL("../src/sections/energy-section.js", import.meta.url), "utf8");

test("la tessera della Home legge le caselle della sezione, mai il sensore configurato", () => {
  const corpo = corpoDi(TESSERA, "function currentBundleDay(");
  const nomi = [...corpo.matchAll(/"([^"]+)"/g)].map((trovato) => trovato[1]);
  assert.ok(nomi.length >= 6, "i totali del giorno sono spariti dalla tessera");
  nomi
    .filter((nome) => nome.includes("."))
    .forEach((nome) => {
      assert.ok(
        nome.startsWith("dm.energy_"),
        `la tessera legge ${nome} per conto suo: da li' ricomincia a dire un numero diverso dalla sezione`,
      );
    });
});

test("le caselle che la sezione scrive si dichiarano in kilowattora", () => {
  const corpo = corpoDi(SEZIONE, "function writeDerived(");
  assert.match(
    corpo,
    /unit_of_measurement:\s*"kWh"/,
    "la sezione scrive il numero senza dire in che unita' e'",
  );
});
