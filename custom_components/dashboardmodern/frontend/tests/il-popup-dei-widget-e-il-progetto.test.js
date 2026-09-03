/* Il popup dei widget e' il progetto approvato: card, pillole e narrativa.
 *
 * «Nei widget dopo la parte analisi sopra non voglio vedere quell'elenco
 * bruttissimo di entita'... erano tutte card oltre alla parte di analisi. Se
 * ti approvo un progetto poi lo devi fare.» E «ora l'auto e' in carica ma non
 * dice quando finisce... altrimenti che abbiamo strutturato a fare il motore
 * AI». Queste prove tengono ferme le tre cose: le letture sono caselle, gli
 * acceso/spento pillole, i comandi comandi; l'auto in carica dice l'ora del
 * pieno con la STESSA formula della pagina EV; e la bolla della wallbox nel
 * flusso legge i kW come kW.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { analisiDellaSezione } from "../src/core/analisi-sezione.js";
import { flowStageModel } from "../src/core/energy-flow-topology.js";
import { applianceHeroArtwork } from "../src/core/appliance-hero-artwork.js";
import { applianceArtwork, canonicalArtworkType } from "../src/core/appliance-artwork.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const WIDGETS = readFileSync(join(QUI, "..", "src", "sections", "home-widgets-section.js"), "utf8");

test("l'auto in carica dice a che ora arriva al traguardo, come la pagina EV", () => {
  /* I numeri VERI del campo: 53% di carica, 1.61 kW di potenza, traguardo
   * 100. La pagina EV diceva «20H 21M RIM.»; la frase deve dire l'ora di
   * arrivo corrispondente, calcolata con la stessa formula (70 kWh assunti).
   * Mezzogiorno in punto + 20h26m — (100-53)*0.7/1.61 = 20.43h — fa le 8:26. */
  const mezzogiorno = new Date("2026-08-30T12:00:00").getTime();
  const lettura = analisiDellaSezione(
    {
      key: "ev",
      attiva: true,
      ring: 53,
      quante: 1,
      ricaricaKw: 1.61,
      targetSoc: null,
      rows: [{ name: "B10", km: 201 }],
    },
    (it) => it,
    mezzogiorno,
    null,
    "it",
  );
  assert.match(lettura.frase, /In carica al 53%/);
  assert.match(lettura.frase, /arriva al 100% verso le 08:26/);
});

test("senza la potenza del caricatore la frase resta quella di sempre", () => {
  const lettura = analisiDellaSezione(
    { key: "ev", attiva: true, ring: 53, quante: 1, rows: [] },
    (it) => it,
    Date.now(),
    null,
    "it",
  );
  assert.equal(lettura.frase, "In carica, al 53%.");
});

test("la potenza scritta in watt vale quanto quella scritta in kilowatt", () => {
  const alle = (kw) =>
    analisiDellaSezione(
      { key: "ev", attiva: true, ring: 53, quante: 1, ricaricaKw: kw, rows: [] },
      (it) => it,
      new Date("2026-08-30T12:00:00").getTime(),
      null,
      "it",
    ).frase;
  assert.equal(alle(1610), alle(1.61));
});

test("le letture del popup sono caselle e pillole, non un elenco di righe", () => {
  /* I dettagli a sola lettura non producono piu' righe: le numeriche vanno
   * nelle caselle (carteDalleRighe), le acceso/spento nelle pillole. */
  for (const funzione of [
    "function energyDetail",
    "function temperatureDetail",
    "function batteriesDetail",
    "function customDetail",
  ]) {
    const corpo = WIDGETS.slice(WIDGETS.indexOf(funzione), WIDGETS.indexOf(funzione) + 400);
    assert.match(corpo, /return "";/, `${funzione} non deve piu' fare lista`);
  }
  assert.match(WIDGETS, /\.filter\(\(row\) => row\.comando\)/, "rowsDetail tiene solo i comandi");
  assert.match(WIDGETS, /carteDalleRighe/, "le righe di lettura diventano caselle");
  assert.match(WIDGETS, /"elettrodomestici",\n\]\);/, "anche chi lavora e' una casella");
  assert.match(WIDGETS, /\.slice\(0, 12\)/, "le pillole arrivano a dodici");
});

test("il tasto Chiudi del popup sta a destra", () => {
  assert.match(
    WIDGETS,
    /\.dm-w-close\{\n  grid-column:1\/-1;grid-row:1;justify-self:end;/,
    "come in tutti gli altri popup",
  );
});

test("la bolla del flusso legge i kW come kW", () => {
  /* «Valore carico wallbox mostrato nei flussi errato: 2 W, invece nel popup
   * potenza pari a 1.67 kW» — lo stato grezzo si leggeva senza unita'. */
  const modello = flowStageModel({
    loads: [{ id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wb_kw" }],
    states: {
      "sensor.wb_kw": { state: "1.61", attributes: { unit_of_measurement: "kW" } },
    },
    period: "instant",
    locale: "it-IT",
  });
  const bolla = modello.nodes.find((nodo) => nodo.id === "load-wallbox");
  assert.equal(bolla.value, 1610);
  assert.match(bolla.text, /1\.610|1610/);
});

test("Boiler e friggitrice ad aria hanno il loro disegno, fermo e animato", () => {
  assert.equal(canonicalArtworkType("accumulo"), "storage-boiler");
  assert.equal(canonicalArtworkType("friggitrice"), "air-fryer");
  /* Idempotenti, e senza rubare il disegno allo scaldabagno. */
  assert.equal(canonicalArtworkType("storage-boiler"), "storage-boiler");
  assert.equal(canonicalArtworkType("air-fryer"), "air-fryer");
  assert.equal(canonicalArtworkType("scaldabagno"), "boiler");
  assert.match(applianceArtwork("accumulo", 30), /data-dm-art="storage-boiler"/);
  assert.match(applianceArtwork("friggitrice", 30), /data-dm-art="air-fryer"/);
  assert.match(applianceHeroArtwork("accumulo"), /data-dm-hero="storage-boiler"/);
  assert.match(applianceHeroArtwork("friggitrice"), /data-dm-hero="air-fryer"/);
});
