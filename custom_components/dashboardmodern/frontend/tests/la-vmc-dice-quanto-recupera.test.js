/* «Sarebbe bellissimo avere nei climate la possibilità di inserire i dati delle
 * 4 temperature delle macchine VMC per la ventilazione meccanica… compresi i
 * bypass, modalità estate/inverno ecc.» (#371)
 *
 * Le quattro temperature non sono quattro numeri qualunque: messe come i due
 * flussi che si incrociano dicono da sole se la macchina sta facendo il suo
 * lavoro, e la differenza fra loro è il recupero — l'unico numero che dice se
 * vale quello che costa, e che nessuna card mostra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPI_VMC,
  MASSIMO_VMC,
  SALTO_MINIMO,
  entitaDellaVmc,
  letturaVmc,
  normalizzaVmcTutte,
  recuperoDiCalore,
  vmcDisegnabili,
  vmcParla,
} from "../src/core/vmc-model.js";

const stato = (state, attributes = {}) => ({ state, attributes });

/* Un inverno vero: fuori −5, dentro 22, entra in casa a 18 e se ne va a 2. */
const INVERNO = {
  "sensor.out": stato("-5", { unit_of_measurement: "°C" }),
  "sensor.sup": stato("18", { unit_of_measurement: "°C" }),
  "sensor.ret": stato("22", { unit_of_measurement: "°C" }),
  "sensor.exh": stato("2", { unit_of_measurement: "°C" }),
  "binary_sensor.bypass": stato("off"),
  "binary_sensor.estate": stato("off"),
  "binary_sensor.filtri": stato("off"),
  "sensor.rpm_in": stato("1250", { unit_of_measurement: "rpm" }),
};

const MACCHINA = {
  id: "vmc-1",
  nome: "Comfoair",
  esterna: "sensor.out",
  immissione: "sensor.sup",
  ripresa: "sensor.ret",
  espulsione: "sensor.exh",
  bypass: "binary_sensor.bypass",
  estate: "binary_sensor.estate",
  filtri: "binary_sensor.filtri",
  ventola_immissione: "sensor.rpm_in",
};

test("il recupero è quanto della differenza la macchina si riprende", () => {
  // (18 − (−5)) / (22 − (−5)) = 23/27 = 85%.
  assert.equal(recuperoDiCalore(-5, 18, 22), 85);
  // D'estate vale lo stesso: è un rapporto fra differenze, non guarda il segno.
  assert.equal(recuperoDiCalore(34, 27, 25), 78);
});

test("a mezza stagione il recupero non si dice", () => {
  /* Dentro e fuori a due gradi di distanza: il denominatore è quasi zero e il
   * risultato salta fra il dieci e il duecento per cento a ogni aggiornamento.
   * Un numero che balla non è un'informazione, è rumore. */
  assert.equal(recuperoDiCalore(20, 21, 22), null);
  assert.equal(recuperoDiCalore(20, 21, 20 + SALTO_MINIMO), 33);
  // E senza uno dei tre numeri non si inventa niente.
  assert.equal(recuperoDiCalore(null, 18, 22), null);
  assert.equal(recuperoDiCalore(-5, null, 22), null);
});

test("oltre il cento per cento non è recupero", () => {
  /* È una batteria che scalda, o un sensore nella casella sbagliata: si taglia
   * invece di stampare 140. */
  assert.equal(recuperoDiCalore(-5, 30, 22), 100);
  assert.equal(recuperoDiCalore(-5, -10, 22), 0);
});

test("le quattro temperature escono già divise nei due flussi", () => {
  /* Così chi disegna le mette incrociate senza doverci pensare. */
  const lettura = letturaVmc(MACCHINA, INVERNO);
  assert.equal(lettura.temperature.esterna.verso, "entra");
  assert.equal(lettura.temperature.esterna.posto, "prima");
  assert.equal(lettura.temperature.immissione.verso, "entra");
  assert.equal(lettura.temperature.immissione.posto, "dopo");
  assert.equal(lettura.temperature.ripresa.verso, "esce");
  assert.equal(lettura.temperature.espulsione.verso, "esce");
  assert.equal(lettura.recupero, 85);
  assert.equal(vmcParla(lettura), true);
});

test("il bypass aperto si dice, invece di sembrare un recupero crollato", () => {
  const conBypass = letturaVmc(MACCHINA, {
    ...INVERNO,
    "binary_sensor.bypass": stato("on"),
    "sensor.sup": stato("-4", { unit_of_measurement: "°C" }),
  });
  assert.equal(conBypass.bypassAperto, true);
  // Il numero c'è comunque: è chi disegna a decidere che col bypass non serve.
  assert.equal(conBypass.recupero, 4);
});

test("i filtri da cambiare sono un avviso, non un dato in più", () => {
  const sporchi = letturaVmc(MACCHINA, { ...INVERNO, "binary_sensor.filtri": stato("on") });
  assert.deepEqual(sporchi.avvisi, [{ chiave: "filtri_da_cambiare", gravita: "attenzione" }]);
  assert.deepEqual(letturaVmc(MACCHINA, INVERNO).avvisi, []);
});

test("una macchina che non risponde non ha niente da dire", () => {
  const muta = letturaVmc(MACCHINA, {
    "sensor.out": stato("unavailable"),
    "sensor.sup": stato("unknown"),
  });
  assert.equal(vmcParla(muta), false);
  assert.equal(muta.recupero, null);
});

test("la configurazione si ripulisce, e le macchine hanno un id ciascuna", () => {
  const elenco = normalizzaVmcTutte([{ nome: "A" }, { nome: "B" }, { id: "vmc-1", nome: "C" }]);
  assert.equal(new Set(elenco.map((voce) => voce.id)).size, 3);
  // Il tetto è un tetto: quattro macchine sono già un palazzo.
  assert.equal(normalizzaVmcTutte(Array.from({ length: 20 }, () => ({}))).length, MASSIMO_VMC);
  // Una macchina senza nemmeno una casella non si disegna.
  assert.deepEqual(vmcDisegnabili([{ nome: "Vuota" }]), []);
  assert.equal(vmcDisegnabili([MACCHINA]).length, 1);
});

test("le entità nominate si contano una volta sola", () => {
  const entita = entitaDellaVmc([MACCHINA, { ...MACCHINA, id: "vmc-2" }]);
  assert.equal(entita.length, 8);
  assert.ok(entita.includes("sensor.out"));
  // Tutte le caselle dichiarate esistono nel modello normalizzato.
  const unita = normalizzaVmcTutte([{}])[0];
  for (const campo of CAMPI_VMC) assert.equal(typeof unita[campo], "string");
});
