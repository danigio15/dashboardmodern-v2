/* «Valori wallbox nel report sballati.»
 *
 * Sulla riga della Wallbox, in Attività dispositivi: «☀️ 1188.7 kWh 🔌 184.0
 * kWh» e, tre centimetri a destra sulla stessa riga, «0,0 kWh». Due numeri che
 * si contraddicono guardandosi, e il primo era il contatore di vita della
 * colonnina — millequattrocento chilowattora in un mese, per un'auto che in
 * quel mese non ha caricato.
 *
 * La riga la disegna il guscio, e i suoi due numeri nascono d'accordo perché
 * nascono dallo stesso valore. Poi passa di qui la sezione e riscrive quello a
 * destra col valore del Recorder — che è quello giusto: nel mese corrente il
 * guscio sottrae la lettura d'inizio mese con una chiamata allo storico, e se
 * quella chiamata fallisce si tiene il contatore intero. Ma si riscriveva
 * mezza riga: la quota sotto restava calcolata sul contatore di vita.
 *
 * Chi possiede il numero possiede la riga.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { scriviLaQuota, splitFor } from "../src/sections/energy-section.js";

/* Una riga come la disegna il guscio, ridotta a quello che serve. */
function rigaFinta(solare, rete) {
  const pezzi = [{ textContent: `☀️ ${solare} kWh` }, { textContent: `🔌 ${rete} kWh` }];
  const dentro = { dataset: {}, querySelectorAll: (sel) => (sel === "span" ? pezzi : []) };
  return {
    pezzi,
    dentro,
    querySelector: (sel) => (sel === ".ed-dev-name div" ? dentro : null),
  };
}

test("la quota si rifa' sullo stesso valore del numero a destra", () => {
  const riga = rigaFinta("1188.7", "184.0");
  /* Il mese vero: casa 100 kWh, dalla rete 20 — un quinto dalla rete. E la
   * wallbox in quel mese ha caricato zero. */
  scriviLaQuota(riga, splitFor({ house: 100, gridImport: 20 }, 0));
  assert.equal(riga.pezzi[0].textContent, "☀️ 0,0 kWh");
  assert.equal(riga.pezzi[1].textContent, "🔌 0,0 kWh");
});

test("e quando il dispositivo ha consumato, la quota segue la casa", () => {
  const riga = rigaFinta("0.0", "0.0");
  scriviLaQuota(riga, splitFor({ house: 100, gridImport: 20 }, 10));
  assert.equal(riga.pezzi[0].textContent, "☀️ 8,0 kWh");
  assert.equal(riga.pezzi[1].textContent, "🔌 2,0 kWh");
});

test("una riga senza quel pezzo non fa danni", () => {
  const nuda = { querySelector: () => null };
  assert.doesNotThrow(() => scriviLaQuota(nuda, { solar: 1, grid: 2 }));
  const monca = {
    querySelector: () => ({ dataset: {}, querySelectorAll: () => [{ textContent: "" }] }),
  };
  assert.doesNotThrow(() => scriviLaQuota(monca, { solar: 1, grid: 2 }));
});

test("senza produzione tutto viene dalla rete", () => {
  const quota = splitFor({ house: 0, gridImport: 0 }, 5);
  assert.equal(quota.grid, 5);
  assert.equal(quota.solar, 0);
});
