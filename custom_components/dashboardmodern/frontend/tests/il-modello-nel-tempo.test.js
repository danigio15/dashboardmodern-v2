/* Il modello di una grandezza nel tempo dice la cosa vera.
 *
 * I casi qui sotto sono scelti per far cadere un modello ingenuo. Una media al
 * posto di una mediana cade sul picco dell'inverter; una mediana senza il peso
 * del tempo cade sul sensore fermo che fa tre picchi; una retta senza bonta'
 * annuncia una salita nel rumore; una previsione senza orizzonte promette la
 * batteria piena fra ventisei ore. Sono i quattro modi in cui un motore di
 * analisi diventa un generatore di frasi false, e sono tutti silenziosi: la
 * frase esce, si legge bene, e dice il contrario.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  arco,
  chiPesaDiPiu,
  ilSolito,
  ilSolitoAQuestOra,
  letturaNelTempo,
  quandoTocca,
  quantoInsolito,
  serie,
  SOGLIE_INSOLITO,
  tendenza,
} from "../src/core/modello-nel-tempo.js";

const MINUTO = 60_000;
const ORA = 3600_000;
const ADESSO = Date.parse("2026-08-29T20:00:00Z");

/** Letture regolari: `quanti` punti, uno ogni `passo`, valore da `fai`. */
function regolari(quanti, passo, fai, fine = ADESSO) {
  const fuori = [];
  for (let i = quanti - 1; i >= 0; i -= 1) fuori.push({ quando: fine - i * passo, valore: fai(quanti - 1 - i) });
  return fuori;
}

test("una serie si mette in ordine e butta quello che non e' un numero", () => {
  const letture = serie([
    { quando: 300, valore: 3 },
    { quando: 100, valore: 1 },
    { quando: 200, valore: "due" },
    { quando: 150, valore: 1.5 },
    null,
  ]);
  assert.deepEqual(
    letture.map((l) => l.valore),
    [1, 1.5, 3],
  );
  assert.equal(arco(letture), 200);
});

test("accetta le tre forme di punto che girano nel progetto", () => {
  assert.equal(serie([{ when: 1, value: 2 }]).length, 1);
  assert.equal(serie([{ t: 1, v: 2 }]).length, 1);
  assert.equal(serie([{ quando: 1, valore: 2 }]).length, 1);
});

test("una salita si riconosce, e si misura all'ora", () => {
  // da 20° a 23°, un grado all'ora, letto ogni dieci minuti
  const punti = regolari(19, 10 * MINUTO, (i) => 20 + i / 6);
  const linea = tendenza(punti);
  assert.equal(linea.verso, "sale");
  assert.ok(Math.abs(linea.perOra - 1) < 0.02, `un grado all'ora, ho ${linea.perOra}`);
  assert.ok(linea.bonta > 0.99);
});

test("il rumore non e' una tendenza", () => {
  /* Valori che ballano attorno a 500 senza andare da nessuna parte. Una retta
   * ci si puo' tracciare sempre: la bonta' dice che non spiega niente, e il
   * verso dev'essere «ferma» invece di una salita inventata. */
  const ballo = [0, 40, -35, 25, -20, 45, -50, 15, 30, -10, 20, -25, 35, -40, 10];
  const punti = regolari(ballo.length, 5 * MINUTO, (i) => 500 + ballo[i]);
  const linea = tendenza(punti);
  assert.ok(linea.bonta < 0.35, `bonta' ${linea.bonta}: su questo non si annuncia niente`);
  assert.equal(linea.verso, "ferma");
});

test("con pochi punti, o su un arco troppo corto, non dice niente", () => {
  assert.equal(tendenza(regolari(3, 10 * MINUTO, (i) => i)), null, "tre punti non sono una tendenza");
  assert.equal(tendenza(regolari(10, 1000, (i) => i)), null, "dieci secondi non sono un arco");
  assert.equal(tendenza([]), null);
});

test("il solito pesa il tempo, non le letture", () => {
  /* Il caso che fa cadere una mediana ingenua: un sensore fermo a zero per sei
   * ore, e poi tre picchi in un minuto. Le letture al picco sono tre su
   * quattro; il tempo passato al picco e' un minuto su sei ore. Il solito e'
   * lo zero. */
  const punti = [
    { quando: ADESSO - 6 * ORA, valore: 0 },
    { quando: ADESSO - 3 * MINUTO, valore: 2000 },
    { quando: ADESSO - 2 * MINUTO, valore: 2100 },
    { quando: ADESSO - 1 * MINUTO, valore: 1950 },
    { quando: ADESSO, valore: 0 },
  ];
  const solito = ilSolito(punti);
  assert.equal(solito.centro, 0, `contando le letture verrebbe 1950; il tempo dice 0`);
  assert.equal(solito.massimo, 2100, "il massimo resta quello che e' stato");
});

test("un valore sballato non sposta il solito", () => {
  /* L'inverter che per due secondi legge sessantamila watt. Con una media, il
   * solito di un'ora si sposta di mille watt; con la mediana, di niente. */
  const punti = regolari(30, 2 * MINUTO, () => 500);
  punti.splice(15, 0, { quando: punti[15].quando + 1000, valore: 60_000 });
  const solito = ilSolito(punti);
  assert.equal(solito.centro, 500);
});

test("quanto e' insolito: zero quando e' il solito, tanto quando non lo e'", () => {
  const solito = { centro: 500, scarto: 50 };
  assert.equal(quantoInsolito(500, solito), 0);
  assert.equal(quantoInsolito(600, solito), 2);
  assert.ok(quantoInsolito(700, solito) >= SOGLIE_INSOLITO.forte);
  assert.equal(quantoInsolito("niente", solito), null);
});

test("un valore che non si e' mai mosso non fa dividere per zero", () => {
  const solito = { centro: 20, scarto: 0 };
  assert.equal(quantoInsolito(20, solito), 0);
  const fuori = quantoInsolito(24, solito);
  assert.ok(Number.isFinite(fuori) && fuori > 0, `deve essere un numero, ho ${fuori}`);
});

test("il solito a quest'ora pretende piu' di un giorno", () => {
  const unGiorno = regolari(20, 3 * MINUTO, () => 800);
  assert.equal(
    ilSolitoAQuestOra(unGiorno, { adesso: ADESSO }),
    null,
    "con un giorno solo non e' un'abitudine, e' quello che e' successo ieri",
  );

  /* Tre giorni, stessa ora: adesso e' un'abitudine. */
  const treGiorni = [];
  for (let giorno = 0; giorno < 3; giorno += 1)
    for (let i = 0; i < 6; i += 1)
      treGiorni.push({ quando: ADESSO - giorno * 24 * ORA - i * 5 * MINUTO, valore: 800 + i });
  const abituale = ilSolitoAQuestOra(treGiorni, { adesso: ADESSO });
  assert.ok(abituale, "tre giorni alla stessa ora sono un'abitudine");
  assert.equal(abituale.giorni, 3);
});

test("quando tocca il bersaglio, se ci arriva davvero", () => {
  // batteria dal 50% al 62%, sei punti per l'ora: circa dodici punti all'ora
  const punti = regolari(13, 5 * MINUTO, (i) => 50 + i);
  const arrivo = quandoTocca(punti, 100, { adesso: ADESSO });
  assert.ok(arrivo, "sale verso il cento: ci arriva");
  const oreMancanti = (arrivo - ADESSO) / ORA;
  assert.ok(oreMancanti > 2 && oreMancanti < 4, `circa tre ore, ho ${oreMancanti}`);
});

test("non promette un arrivo che non arriva", () => {
  const sale = regolari(13, 5 * MINUTO, (i) => 50 + i);
  assert.equal(quandoTocca(sale, 10, { adesso: ADESSO }), null, "sale: al dieci non ci torna");

  const lenta = regolari(13, 5 * MINUTO, (i) => 50 + i * 0.02);
  assert.equal(
    quandoTocca(lenta, 100, { adesso: ADESSO }),
    null,
    "a questo passo ci mette giorni: dirlo e' un modo raffinato di non dire niente",
  );

  const ferma = regolari(13, 5 * MINUTO, () => 50);
  assert.equal(quandoTocca(ferma, 100, { adesso: ADESSO }), null, "ferma non arriva da nessuna parte");
});

test("chi pesa di piu', e se domina davvero", () => {
  const uno = chiPesaDiPiu(
    [
      { nome: "Forno", watt: 2200 },
      { nome: "Frigo", watt: 120 },
      { nome: "Router", watt: 15 },
    ],
    (v) => v.watt,
  );
  assert.equal(uno.voce.nome, "Forno");
  assert.equal(uno.domina, true, "il forno da solo vale piu' di tutti gli altri");
  assert.ok(uno.quota > 0.9);

  const pari = chiPesaDiPiu(
    [
      { nome: "A", watt: 100 },
      { nome: "B", watt: 95 },
      { nome: "C", watt: 90 },
    ],
    (v) => v.watt,
  );
  assert.equal(pari.domina, false, "tre uguali: nominarne uno racconterebbe male");
  assert.equal(chiPesaDiPiu([], (v) => v.watt), null);
  assert.equal(chiPesaDiPiu([{ watt: 0 }], (v) => v.watt), null, "chi non pesa non conta");
});

test("la lettura completa, e i suoi null che vogliono dire «non so»", () => {
  const punti = regolari(19, 10 * MINUTO, (i) => 20 + i / 6);
  const lettura = letturaNelTempo(punti, { adesso: ADESSO, bersaglio: 24 });
  assert.equal(lettura.valore, punti[punti.length - 1].valore);
  assert.equal(lettura.tendenza.verso, "sale");
  assert.ok(lettura.solito);
  assert.ok(lettura.arrivo, "sale verso i 24: ci arriva");

  /* Due punti soli: il solito si puo' dire, la tendenza no. Il null della
   * tendenza va letto come «non so se si muove», che non e' «e' ferma». */
  const scarsa = letturaNelTempo(
    [
      { quando: ADESSO - MINUTO, valore: 5 },
      { quando: ADESSO, valore: 6 },
    ],
    { adesso: ADESSO },
  );
  assert.equal(scarsa.tendenza, null);
  assert.equal(scarsa.arrivo, null);
  assert.equal(letturaNelTempo([], { adesso: ADESSO }), null);
});
