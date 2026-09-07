/* «Nella sezione elettrodomestici i cicli non si conteggiano giusti. Certi
 * partono solo quando entro nella sezione. Certi segnano tante ore in più.»
 * (#363)
 *
 * Due difetti, una radice: il contatore vedeva l'apparecchio solo mentre
 * qualcuno guardava quella pagina.
 *
 * - Il campionamento stava dentro il disegno delle schede, e le schede si
 *   disegnano solo quando la sezione si guarda. Una lavatrice partita alle otto
 *   risultava partita a mezzogiorno. Adesso si campiona sul disegno del guscio,
 *   che gira a ogni raffica di stati qualunque pagina si guardi.
 * - E la chiusura prendeva l'istante di ADESSO come fine del ciclo, buco
 *   compreso: la plancia chiusa per quattro ore le metteva tutte dentro la
 *   durata. Adesso un ciclo finisce dove finisce quello che si e' visto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createCycleTracker } from "../src/core/appliance-cycle-tracker.js";

function orologio(partenza) {
  let adesso = partenza;
  return { ora: () => adesso, avanza: (ms) => (adesso += ms) };
}

function magazzino() {
  let dentro = "";
  return { getItem: () => dentro, setItem: (_k, v) => (dentro = v) };
}

const MINUTO = 60_000;
const ORA = 60 * MINUTO;

test("un ciclo dura quanto si e' visto, non quanto e' passato", () => {
  const tempo = orologio(Date.parse("2026-09-07T08:00:00Z"));
  const cicli = createCycleTracker({ storage: magazzino(), now: tempo.ora });
  const acceso = [{ id: "lavatrice", mode: "running", watts: 2000, dailyKwh: 0 }];

  cicli.update(acceso);
  /* Un'ora e mezza di lavaggio, guardata: campioni ogni minuto. */
  for (let passo = 0; passo < 90; passo += 1) {
    tempo.avanza(MINUTO);
    cicli.update(acceso);
  }
  /* Poi la plancia si chiude per quattro ore, e quando si riapre e' spenta. */
  tempo.avanza(4 * ORA);
  cicli.update([{ id: "lavatrice", mode: "off", watts: 0, dailyKwh: 3 }]);

  const ultimo = cicli.record("lavatrice").last;
  assert.equal(ultimo.durationMinutes, 90, "novanta minuti, non trecentotrenta");
});

test("senza buchi la fine e' quella vera", () => {
  /* La regola nuova non deve accorciare un ciclo guardato fino in fondo. */
  const tempo = orologio(Date.parse("2026-09-07T08:00:00Z"));
  const cicli = createCycleTracker({ storage: magazzino(), now: tempo.ora });
  cicli.update([{ id: "forno", mode: "running", watts: 2400, dailyKwh: 0 }]);
  for (let passo = 0; passo < 40; passo += 1) {
    tempo.avanza(MINUTO);
    cicli.update([{ id: "forno", mode: "running", watts: 2400, dailyKwh: 0 }]);
  }
  tempo.avanza(MINUTO);
  cicli.update([{ id: "forno", mode: "off", watts: 0, dailyKwh: 1.6 }]);
  assert.equal(cicli.record("forno").last.durationMinutes, 41);
});

test("il campionamento non sta piu' dentro il disegno delle schede", () => {
  /* La sezione si disegna solo quando la si guarda: se il conteggio dei cicli
   * vive li' dentro, torna a dipendere da chi guarda. Il campione lo prende
   * `campionaICicli`, agganciata al disegno del guscio. */
  const sorgente = readFileSync(
    fileURLToPath(new URL("../src/sections/appliance-showcase-section.js", import.meta.url)),
    "utf8",
  );
  assert.match(sorgente, /export function campionaICicli\(\)/);
  assert.match(sorgente, /wrapFunction\("render", "__dmApplianceCycles", campionaICicli\)/);
  /* E dentro il disegno non ci deve piu' essere: una volta sola per raffica. */
  const disegno = sorgente.slice(sorgente.indexOf("const shell = host.querySelector"));
  assert.doesNotMatch(disegno, /cycles\.update\(/);
});
