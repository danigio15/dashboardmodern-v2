/* L'anno del Report chiede i giorni, non i mesi. E questa volta sul percorso vero.
 *
 * «Wallbox niente, e stiamo a quattro rilasci inutili: continui a non
 *  risolvere.» Ed è giusto, e la ragione è precisa.
 *
 * Il conto sbagliato era noto e corretto da un pezzo: sommare i giorni invece
 * di sottrarre i contatori dei mesi (`mesiDaiGiorni`, e la prova che lo tiene
 * fermo è `la-wallbox-conta-i-giorni-non-i-mesi`). Solo che quella correzione
 * vive su UNA porta — `DashboardModernEnergyService.statisticsWithGrowth` —
 * e il pacchetto dell'Energia non ci passa: il Report costruisce il suo anno
 * con `valoriPerArchi`, che chiede le statistiche direttamente e ne ricava la
 * crescita con `crescitaNellArco`. Cioè per SOTTRAZIONE fra i due estremi,
 * che è esattamente il conto dichiarato sbagliato dieci righe più sotto nel
 * file.
 *
 * Perciò: silenziata la funzione del guscio che scriveva il numero vecchio, a
 * scriverlo è rimasto il nostro, con lo stesso errore. Sullo schermo non era
 * cambiato niente — 546 sulla 1.4.14, 546 sulla 1.4.15, 546 sulla 1.4.16 — e
 * ogni volta era stata corretta una porta diversa da quella che disegna.
 *
 * Queste prove stanno sul percorso che disegna:
 *
 *  1. l'arco dell'anno si chiede a GIORNI. Chiedendolo a mesi, su un contatore
 *     che si azzera, nessun conto può più tornare: i secchielli mensili del
 *     Recorder portano il totale DI QUEL MESE, e da dodici numeri che non
 *     stanno su una scala comune il consumo dell'anno non si ricava;
 *  2. la crescita di un arco è la SOMMA delle crescite dei suoi secchielli,
 *     non la differenza fra il primo e l'ultimo. Sul contatore di sempre le
 *     due cose sono lo stesso numero — le differenze si annullano a catena —
 *     e su quello che si azzera solo la prima è vera.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { crescitaNellArco, periodRange } from "../src/core/period-service.js";

/* Una wallbox vera: nove mesi, e il contatore che riparte da zero ogni primo.
 * I mesi sommano 1440,76 kWh, che è il numero che l'utente legge sul suo
 * sensore — e quello che la plancia deve dire. */
const MESI = [180.4, 142.9, 210.6, 96.2, 88.5, 201.3, 175.8, 190.05, 155.01];
const VERO = MESI.reduce((somma, quanto) => somma + quanto, 0);

/* Come il Recorder scrive un mese, a giorni: dentro il mese il contatore
 * cresce, e il primo del mese dopo riparte da zero. */
function giorniDellAnno({ prima = null } = {}) {
  const righe = prima ? [prima] : [];
  MESI.forEach((totale, mese) => {
    const alGiorno = totale / 4;
    let contatore = 0;
    for (let giorno = 1; giorno <= 4; giorno += 1) {
      contatore += alGiorno;
      righe.push({ start: new Date(2026, mese, giorno).toISOString(), sum: contatore });
    }
  });
  return righe;
}

/* Gli stessi nove mesi come li chiedeva l'anno: un secchiello per mese, col
 * contatore che a fine mese vale il totale di quel mese. */
const A_MESI = MESI.map((totale, mese) => ({
  start: new Date(2026, mese, 1).toISOString(),
  sum: totale,
}));

/* La riga che il Recorder porta sempre insieme alle altre: quella subito
 * PRIMA del confine. Su un contatore che si azzera è il totale di dicembre, su
 * uno di sempre è la cumulata a fine anno scorso. */
const DICEMBRE = { start: new Date(2025, 11, 31).toISOString(), sum: 120.5 };

const ARCO = periodRange("year", new Date(2026, 8, 20), new Date(2026, 8, 20));

test("l'arco dell'anno si chiede a giorni: dai mesi il conto non si ricava", () => {
  /* È la scelta che rendeva impossibile ogni correzione a valle: con i
   * secchielli mensili di un contatore che si azzera, l'informazione per
   * ricostruire l'anno non c'è più nella risposta. */
  assert.equal(ARCO.period, "day");
});

test("l'anno di una wallbox che si azzera ogni mese è la somma dei suoi mesi", () => {
  const cresciuto = crescitaNellArco(giorniDellAnno({ prima: DICEMBRE }), ARCO);
  assert.ok(cresciuto != null, "l'anno deve dare un numero");
  assert.equal(Math.round(cresciuto * 100) / 100, Math.round(VERO * 100) / 100);
});

test("il difetto, scritto per intero: sottrarre gli estremi ne perdeva la maggior parte", () => {
  /* Come contava: l'ultimo contatore meno il primo, con lo zero come
   * pavimento. Sui nove mesi qui sopra fa 155,01 − 180,4 → sotto zero →
   * zero, oppure una frazione a seconda di dove cade la baseline. Il numero
   * vero è 1440,76: ecco da dove nasceva un 546. */
  const allaVecchiaManiera = (righe) => {
    const valori = righe.map((riga) => riga.sum);
    return Math.max(0, valori.at(-1) - valori[0]);
  };
  assert.ok(
    allaVecchiaManiera(A_MESI) < VERO / 2,
    `sottraendo gli estremi si perde piu' della metà: ${allaVecchiaManiera(A_MESI)} invece di ${VERO}`,
  );
});

test("sul contatore di sempre il numero non cambia di una virgola", () => {
  /* La correzione non deve spostare niente dove funzionava: su un contatore
   * che non torna mai indietro, la somma delle crescite e la differenza fra
   * gli estremi sono lo stesso numero — le differenze si annullano a catena. */
  let contatore = 500;
  const righe = MESI.flatMap((totale, mese) => {
    const alGiorno = totale / 4;
    return Array.from({ length: 4 }, (_, giorno) => {
      contatore += alGiorno;
      return { start: new Date(2026, mese, giorno + 1).toISOString(), sum: contatore };
    });
  });
  const cresciuto = crescitaNellArco(
    [{ start: new Date(2025, 11, 31).toISOString(), sum: 500 }, ...righe],
    ARCO,
  );
  assert.equal(Math.round(cresciuto * 100) / 100, Math.round(VERO * 100) / 100);
});

test("un arco senza righe dentro resta senza risposta, non diventa zero", () => {
  /* Uno zero scritto al posto di un numero che non si è potuto leggere è una
   * bugia, ed è la ragione per cui questo conto torna `null`. */
  assert.equal(crescitaNellArco([], ARCO), null);
});

test("un ritocco all'indietro del Recorder non è un azzeramento", () => {
  /* Il rovescio della correzione qui sopra, e me lo sono preso in faccia: il
   * Recorder ritocca le sue somme all'indietro di pochissimo — 1300,0 che
   * diventa 1299,2 — e «sceso vuol dire azzerato» leggeva quel ritocco come
   * un contatore ripartito da zero. Il secchiello prendeva 1299,2, cioè tutta
   * la storia del contatore contata come consumo di un'ora, e l'anno della
   * rete importata usciva 1310 invece di 10.
   *
   * Un azzeramento riporta il contatore a zero; una correzione toglie
   * briciole. Si distinguono da quanto resta. */
  const arco = periodRange("year", new Date(2026, 8, 20), new Date(2026, 8, 20));
  const righe = [
    { start: new Date(2026, 0, 1).toISOString(), sum: 1290 },
    { start: new Date(2026, 4, 1).toISOString(), sum: 1300 },
    /* Il ritocco: otto decimi in meno su milletrecento. */
    { start: new Date(2026, 6, 1).toISOString(), sum: 1299.2 },
    { start: new Date(2026, 8, 1).toISOString(), sum: 1300 },
  ];
  assert.equal(crescitaNellArco(righe, arco), 10);
});

test("e un contatore che riparte davvero conta da capo, anche a mesi vicini", () => {
  /* La soglia non deve essere così stretta da mangiarsi un riavvio vero. Un
   * mese scarso seguito da un mese pieno — 88,5 poi 201,3 — riparte da zero e
   * il primo giorno vale già più della metà del mese prima: è comunque un
   * riavvio, e il suo consumo va contato. */
  const arco = periodRange("year", new Date(2026, 8, 20), new Date(2026, 8, 20));
  const righe = [
    { start: new Date(2026, 3, 28).toISOString(), sum: 88.5 },
    { start: new Date(2026, 4, 1).toISOString(), sum: 50.325 },
    { start: new Date(2026, 4, 2).toISOString(), sum: 100.65 },
  ];
  assert.equal(
    crescitaNellArco(righe, arco, { continuazione: true }),
    Math.round((50.325 + 50.325) * 1000) / 1000,
  );
});
