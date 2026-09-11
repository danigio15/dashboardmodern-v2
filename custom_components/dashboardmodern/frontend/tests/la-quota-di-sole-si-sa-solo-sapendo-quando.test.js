/* «Wallbox sempre sbagliato.»
 *
 * La card diceva 49,4 kWh dal fotovoltaico e 18,7 dalla rete. I numeri veri,
 * dati da chi ha l'impianto: 22,8 dal sole e 45,3 dalla rete. Il rovescio.
 *
 * Il conto di prima prendeva la quota di rete di TUTTA LA CASA nel mese e la
 * incollava sui kWh della colonnina — e infatti 18,7 / 68,1 fa 0,2746, che e'
 * esattamente la quota di rete della casa. Non misurava: copiava.
 *
 * Qui si prova il conto nuovo, che guarda QUANDO l'auto ha caricato.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  quotaDiRete,
  quotaSolareDelDispositivo,
} from "../src/core/quota-solare-del-dispositivo.js";

const ORA = 3_600_000;
/* Un giorno qualunque a mezzanotte, in millisecondi: le prove non chiedono mai
 * l'ora al calendario, o cambierebbero risposta a seconda di quando girano. */
const MEZZANOTTE = Date.UTC(2026, 8, 7);
const alle = (ora) => MEZZANOTTE + ora * ORA;

const secchielli = (righe) => righe.map(([ora, kwh]) => ({ inizio: alle(ora), kwh }));

test("senza consumo di casa la risposta e' «tutto dalla rete», non «tutto sole»", () => {
  assert.equal(quotaDiRete(0, 0), 1);
  assert.equal(quotaDiRete(null, 5), 1);
});

test("la quota di rete sta fra zero e uno anche quando i conti sbordano", () => {
  assert.equal(quotaDiRete(10, 13), 1, "una casa che esporta non fa una quota del 130%");
  assert.equal(quotaDiRete(10, -2), 0);
  assert.equal(quotaDiRete(10, 4), 0.4);
});

/* Il caso della segnalazione, in piccolo: l'auto carica di notte, la casa
 * consuma soprattutto di giorno col sole. */
test("una ricarica notturna viene dalla rete, anche se la casa di giorno va a sole", () => {
  /* La casa: 10 kWh di giorno quasi tutti dal sole, 10 di notte tutti da rete. */
  const casa = secchielli([
    [12, 10],
    [2, 10],
  ]);
  const rete = secchielli([
    [12, 1],
    [2, 10],
  ]);
  /* L'auto carica solo alle due di notte. */
  const auto = secchielli([[2, 20]]);

  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete });
  assert.equal(quota.grid, 20, "alle due di notte non c'era un grammo di sole");
  assert.equal(quota.solar, 0);
  assert.equal(quota.fonte, "secchielli");

  /* E il conto di prima, per confronto: la casa nel giorno ha preso dalla rete
   * 11 kWh su 20, cioe' il 55%, e avrebbe regalato all'auto 9 kWh di sole che
   * non sono mai esistiti. */
  const comeFacevaPrima = 20 * (1 - 11 / 20);
  assert.equal(comeFacevaPrima, 9);
});

test("una ricarica di mezzogiorno prende il sole che c'era in quell'ora", () => {
  const casa = secchielli([[12, 10]]);
  const rete = secchielli([[12, 2]]);
  const auto = secchielli([[12, 5]]);
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete });
  assert.equal(quota.grid, 1, "il 20% dell'ora veniva dalla rete");
  assert.equal(quota.solar, 4);
});

/* Il numero grande della card e la sua divisione devono sommare alla stessa
 * cosa: chi possiede il numero possiede la riga. I secchielli possono
 * arrivare da una domanda diversa da quella del totale e non tornare al
 * grammo — arrotondamenti, un'ora aperta — e allora si riscalano. */
test("la divisione si riscala sul numero grande della card", () => {
  const casa = secchielli([
    [1, 10],
    [13, 10],
  ]);
  const rete = secchielli([
    [1, 10],
    [13, 0],
  ]);
  const auto = secchielli([
    [1, 5],
    [13, 5],
  ]);
  /* Le ore spiegano dieci kWh e la card ne scrive undici: il grosso c'e', e la
   * proporzione misurata si stira su quel poco che manca. */
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete, totale: 11 });
  assert.equal(quota.grid + quota.solar, 11, "la somma e' il numero scritto in grande");
  assert.equal(quota.grid, 5.5, "e le proporzioni restano quelle misurate");
  assert.equal(quota.solar, 5.5);
  assert.equal(quota.coperto, 10, "i secchielli ne spiegavano dieci, e lo dice");
  assert.equal(quota.quotaRete, 0.5, "la frazione, per chi riscrive la riga più tardi");
});

test("una manciata di ore non decide la spartizione di un anno", () => {
  /* «Riscalare» va bene finché la parte misurata è il grosso. Su un totale di
   * venti spiegato da dieci, una notte di ricarica deciderebbe metà dell'anno:
   * lì la misura si dichiara non fatta, e chi chiama resta sulla stima. */
  const casa = secchielli([
    [1, 10],
    [13, 10],
  ]);
  const rete = secchielli([
    [1, 10],
    [13, 0],
  ]);
  const auto = secchielli([
    [1, 5],
    [13, 5],
  ]);
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete, totale: 100 });
  assert.equal(quota.fonte, "", "non misurata: dieci kWh su cento non sono una misura");
  assert.equal(quota.coperto, 10, "ma quanto copriva si dice comunque");
});

test("un'ora senza il dato della casa o della rete non vota", () => {
  /* Senza il consumo di casa `quotaDiRete` risponde «tutto dalla rete», e
   * senza il prelievo risponde «tutto dal sole»: due risposte prudenti quando
   * il dato c'è ed è zero, due invenzioni quando il dato non c'è affatto. */
  const auto = secchielli([
    [1, 5],
    [13, 5],
  ]);
  const casa = secchielli([[1, 10]]);
  const rete = secchielli([[1, 0]]);
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete });
  assert.equal(quota.secchielli, 1, "vota solo l'ora che ha tutte e tre le misure");
  assert.equal(quota.coperto, 5);
  assert.equal(quota.fonte, "", "e cinque su dieci non bastano a dichiararla misurata");
});

test("quando le tre misure ci sono tutte, l'ora vale anche a zero", () => {
  /* Zero prelievo È un dato: vuol dire che in quell'ora la casa andava a sole.
   * Non va confuso con «il secchiello non c'è». */
  const auto = secchielli([[13, 5]]);
  const casa = secchielli([[13, 10]]);
  const rete = secchielli([[13, 0]]);
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete });
  assert.equal(quota.fonte, "secchielli");
  assert.equal(quota.solar, 5);
  assert.equal(quota.grid, 0);
});

/* La regola che questo modulo esiste per non rompere: quando non si sa, non si
 * inventa. */
test("senza secchielli non esce nessuna percentuale", () => {
  const quota = quotaSolareDelDispositivo({ dispositivo: [], casa: [], rete: [], totale: 68.1 });
  assert.equal(quota.fonte, "", "chi legge questo non deve scrivere una quota misurata");
  assert.equal(quota.secchielli, 0);
  assert.equal(quota.grid, 0);
  assert.equal(quota.solar, 0);
});

test("un'ora in cui l'auto non ha caricato non conta come ora coperta", () => {
  const auto = secchielli([
    [1, 0],
    [2, 4],
  ]);
  const casa = secchielli([
    [1, 5],
    [2, 5],
  ]);
  const rete = secchielli([
    [1, 5],
    [2, 0],
  ]);
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete });
  assert.equal(quota.secchielli, 1);
  assert.equal(quota.solar, 4, "l'unica ora con una ricarica era tutta a sole");
});

/* Le statistiche arrivano con `start` scritto in due modi a seconda di chi ha
 * letto la risposta, e i due devono cadere nello stesso secchiello. */
test("il momento si legge sia come numero sia come data scritta", () => {
  const auto = [{ start: new Date(alle(3)).toISOString(), change: 6 }];
  const casa = [{ inizio: alle(3), kwh: 6 }];
  const rete = [{ start: alle(3), value: 3 }];
  const quota = quotaSolareDelDispositivo({ dispositivo: auto, casa, rete });
  assert.equal(quota.grid, 3);
  assert.equal(quota.solar, 3);
});
