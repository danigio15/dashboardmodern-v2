/* «Gli 894 sono di quest'anno, per questo non riesci a vederle. Le devi
 * conteggiare. Su sta cosa stiamo dalla versione 1.4.4.»
 *
 * La colonnina è stata installata a marzo 2026 e le sue statistiche cominciano
 * a giugno. Il contatore di vita dice 1440,76 kWh, e siccome è nato quest'anno
 * quel numero È il consumo del 2026. La plancia ne diceva 546.
 *
 * La `sum` del Recorder non è la lettura del contatore: è un totale suo, che
 * parte da zero quando cominciano le STATISTICHE di quell'entità. Fra marzo e
 * giugno la colonnina ha caricato e nessuno l'ha registrato: sono gli 894 kWh
 * che mancano, la TESTA del contatore, e nessuna somma di secchielli può
 * ritrovarla perché i secchielli non ci sono.
 *
 * Per tre versioni la plancia l'ha scritta in un avviso invece di contarla,
 * perché «non si sa QUANDO è stata consumata»: su una colonnina installata
 * quest'anno è tutta di quest'anno, su un contatore vecchio a cui hanno
 * ripulito il database è di anni fa. Ma quella domanda una risposta ce l'ha, e
 * non serve chiederla a nessuno: il PASSO dell'apparecchio. Nel tempo misurato
 * ha consumato tanto al giorno; davanti alle statistiche c'è un vuoto lungo
 * così; se la testa ci sta, a quel passo, è roba di questo periodo.
 *
 * Sui numeri di quella segnalazione: 546 kWh in 92 giorni sono 5,93 al giorno,
 * il vuoto è 151 giorni, quindi ci stanno 896 kWh — e la testa ne misura 894,9.
 * Combacia. Un contatore di casa con cinque anni di vita dietro, invece, con la
 * stessa misura avrebbe diritto a 896 kWh e ne porta venticinquemila: non è una
 * distinzione sottile, ed è per questo che si può fare.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  HomeAssistantBroker,
  QUANTO_PUO_SFORARE,
  QUANTO_SI_ALLUNGA,
  crescitaNellArco,
  energiaPrimaDelleStatistiche,
  testaDellArco,
} from "../src/core/period-service.js";

const arco = (dal, al, kind = "year") => ({
  kind,
  period: "day",
  start: new Date(dal),
  end: new Date(al),
});

const ANNO = arco("2026-01-01T00:00:00Z", "2026-09-01T00:00:00Z");

/* La wallbox di quella segnalazione: installata a marzo, statistiche da
 * giugno. Il contatore di vita dice 1440,76; la `sum`, ripartita da zero a
 * giugno, arriva a 546. */
const WALLBOX = [
  { start: "2026-06-01T00:00:00Z", sum: 120, state: 1014.9 },
  { start: "2026-07-01T00:00:00Z", sum: 290.4, state: 1185.3 },
  { start: "2026-08-01T00:00:00Z", sum: 430.2, state: 1325.1 },
  { start: "2026-08-31T00:00:00Z", sum: 546, state: 1440.762 },
];

const arrotonda = (numero, cifre = 1) => Math.round(numero * 10 ** cifre) / 10 ** cifre;

test("la testa della colonnina nata quest'anno è di quest'anno, e si conta", () => {
  const testa = testaDellArco(WALLBOX, ANNO, crescitaNellArco(WALLBOX, ANNO));
  assert.equal(arrotonda(testa.quanta), 894.9);
  assert.equal(testa.contata, true);
});

test("la testa di un contatore con anni di vita dietro non ci sta, e resta fuori", () => {
  /* Un contatore di casa da venticinquemila kWh a cui hanno ripulito il
   * database il primo giugno. Il vuoto davanti è lo stesso della colonnina —
   * 151 giorni — ma al passo misurato ci starebbero millequattrocento kWh, non
   * venticinquemila. È esattamente il caso da cui il conto vecchio si
   * guardava, e adesso lo riconosce invece di arrendersi a ogni caso. */
  const casa = [
    { start: "2026-06-01T00:00:00Z", sum: 0, state: 25000 },
    { start: "2026-07-01T00:00:00Z", sum: 400, state: 25400 },
    { start: "2026-08-01T00:00:00Z", sum: 800, state: 25800 },
  ];
  const testa = testaDellArco(casa, ANNO, crescitaNellArco(casa, ANNO));
  assert.equal(testa.quanta, 25000);
  assert.equal(testa.contata, false, "venticinquemila kWh non stanno in cinque mesi di quel passo");
});

test("con una misura troppo corta non si giudica: si resta corti e lo si dice", () => {
  /* Statistiche cominciate due giorni fa e un vuoto di otto mesi: il passo di
   * due giorni non vuol dire niente, e moltiplicarlo per duecentoquaranta
   * darebbe un lasciapassare a qualunque testa. */
  const appena = [
    { start: "2026-08-28T00:00:00Z", sum: 0, state: 4000 },
    { start: "2026-08-29T00:00:00Z", sum: 30, state: 4030 },
    { start: "2026-08-30T00:00:00Z", sum: 60, state: 4060 },
  ];
  const testa = testaDellArco(appena, ANNO, crescitaNellArco(appena, ANNO));
  assert.equal(testa.quanta, 4000);
  assert.equal(testa.contata, false);
  /* La regola è scritta, non indovinata: il vuoto non può superare il tempo
   * misurato più di così. */
  assert.ok((243 - 4) / 4 > QUANTO_SI_ALLUNGA);
});

test("senza testa non c'è niente da decidere", () => {
  const nate = [
    { start: "2026-06-01T00:00:00Z", sum: 0, state: 0 },
    { start: "2026-07-01T00:00:00Z", sum: 105, state: 105 },
    { start: "2026-08-01T00:00:00Z", sum: 248.1, state: 248.1 },
  ];
  assert.deepEqual(testaDellArco(nate, ANNO, crescitaNellArco(nate, ANNO)), {
    quanta: 0,
    contata: false,
  });
  /* E con una riga PRIMA dell'arco la testa riguarda un altro periodo. */
  const vecchie = [
    { start: "2025-12-01T00:00:00Z", sum: 800, state: 1200 },
    { start: "2026-06-01T00:00:00Z", sum: 900, state: 1300 },
  ];
  assert.equal(energiaPrimaDelleStatistiche(vecchie, ANNO), 0);
  assert.equal(testaDellArco(vecchie, ANNO, 100).contata, false);
});

test("sul confine non si tocca niente: non si sa se il contatore è nato lì", () => {
  /* La stessa cautela di `contatoreNatoDentro`: se la prima riga sta proprio
   * sul primo dell'anno, può essere che le righe di prima non siano state
   * chieste, e prenderle per «nato qui» vorrebbe dire scrivere nell'anno la
   * vita intera di un contatore vecchio. */
  const sulConfine = [
    { start: "2026-01-01T00:00:00Z", sum: 0, state: 9000 },
    { start: "2026-06-01T00:00:00Z", sum: 500, state: 9500 },
  ];
  const testa = testaDellArco(sulConfine, ANNO, crescitaNellArco(sulConfine, ANNO));
  assert.equal(testa.quanta, 9000);
  assert.equal(testa.contata, false);
});

test("il margine c'è, ma è quello scritto", () => {
  /* Un apparecchio non consuma sempre uguale, e un margine ci vuole; ma è un
   * numero dichiarato, non una manica larga senza fondo. */
  const passo = 546 / 92;
  const vuoto = 151;
  assert.ok(894.9 <= passo * vuoto * QUANTO_PUO_SFORARE);
  assert.ok(894.9 * QUANTO_PUO_SFORARE * 2 > passo * vuoto * QUANTO_PUO_SFORARE);
});

/* ── e adesso sul percorso che disegna ─────────────────────────────────────
 *
 * «Quattro rilasci inutili» erano quattro correzioni su una porta diversa da
 * quella che scrive il numero. Questa prova passa da `valoriPerArchi`, che è
 * la porta del Report. */

class RecorderFinto extends HomeAssistantBroker {
  constructor(righe) {
    super({ timeout: 200 });
    this.righePerEntita = righe;
    this.domande = 0;
  }
  async statistics(ids) {
    this.domande += 1;
    return Object.fromEntries(ids.map((id) => [id, this.righePerEntita[id] || []]));
  }
}

test("il Report scrive 1440, non 546", async () => {
  const broker = new RecorderFinto({ "sensor.wallbox": WALLBOX });
  const { valori, ammanchi } = await broker.valoriPerArchi([
    {
      plans: [{ key: "disp:year:wallbox", entity: "sensor.wallbox", kind: "year" }],
      range: ANNO,
    },
  ]);
  /* 546 dai secchielli più 894,9 di testa: il numero che l'utente legge sul
   * suo sensore. (Nella fotografia della segnalazione sono 1440,76: qui la
   * testa si misura al PRIMO secchiello — è lì che vuol dire «quanto c'era
   * quando si è cominciato a registrare» — e il campione porta un decimo di
   * scarto fra il primo e l'ultimo.) */
  assert.equal(arrotonda(valori.get("disp:year:wallbox")), 1440.9);
  /* E la card riceve la testa con il suo verdetto, per poterlo scrivere. */
  const testa = ammanchi.get("disp:year:wallbox");
  assert.equal(arrotonda(testa.quanta), 894.9);
  assert.equal(testa.contata, true);
});

test("l'arco che continua non riconta la testa: la card non la vede due volte", async () => {
  /* L'anno si chiede in due pezzi — i mesi chiusi e il mese aperto — e le
   * crescite si sommano. Se la testa entrasse anche nel secondo, il totale la
   * conterebbe due volte. */
  const SETTEMBRE = arco("2026-09-01T00:00:00Z", "2026-09-11T00:00:00Z", "month");
  const righe = [
    ...WALLBOX,
    { start: "2026-09-01T00:00:00Z", sum: 546, state: 1440.762 },
    { start: "2026-09-10T00:00:00Z", sum: 614.1, state: 1508.862 },
  ];
  const broker = new RecorderFinto({ "sensor.wallbox": righe });
  const plans = [{ key: "disp:year:wallbox", entity: "sensor.wallbox", kind: "year" }];
  const { valori, ammanchi } = await broker.valoriPerArchi([
    { plans, range: { ...ANNO, next: ANNO.end } },
    { plans, range: SETTEMBRE },
  ]);
  /* 546 + 894,9 dal primo arco, 68,1 dal secondo. */
  assert.equal(arrotonda(valori.get("disp:year:wallbox")), 1509);
  assert.equal(ammanchi.size, 1, "la testa si conta una volta sola");
});

test("il contatore di casa di sempre non cambia di una virgola", async () => {
  /* La regola vale per tutti, ma tocca solo chi ha una testa: un contatore con
   * le righe già prima del primo gennaio non ne ha, e il suo anno resta quello
   * che era. */
  const casa = [
    { start: "2025-12-31T00:00:00Z", sum: 40000, state: 40000 },
    { start: "2026-04-01T00:00:00Z", sum: 42000, state: 42000 },
    { start: "2026-08-01T00:00:00Z", sum: 43500, state: 43500 },
  ];
  const broker = new RecorderFinto({ "sensor.casa": casa });
  const { valori, ammanchi } = await broker.valoriPerArchi([
    { plans: [{ key: "fonte:year:house", entity: "sensor.casa", kind: "year" }], range: ANNO },
  ]);
  assert.equal(valori.get("fonte:year:house"), 3500);
  assert.equal(ammanchi.size, 0);
});
