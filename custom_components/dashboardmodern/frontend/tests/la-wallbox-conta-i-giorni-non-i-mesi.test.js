/* Il totale dell'anno somma i giorni, non sottrae i contatori dei mesi.
 *
 * «I dati della wallbox sono ancora sbagliati: il totale consumato da inizio
 *  anno e' 1440,76 kWh.» La plancia ne diceva 546.
 *
 * Il consumo di un mese si ricava in due modi. Sottraendo il contatore di fine
 * mese da quello del mese prima — giusto finche' il contatore e' quello di
 * sempre e non torna mai indietro. Oppure sommando la crescita dei suoi
 * giorni — sempre giusto.
 *
 * Su un contatore che si azzera ogni mese, e quello mensile di una wallbox e'
 * esattamente questo, i due modi danno risposte diverse: il contatore di fine
 * settembre non e' piu' grande di quello di fine agosto, e la sottrazione da
 * il divario fra due mesi al posto del consumo di uno.
 *
 * Queste prove tengono ferme tutt'e due le cose: che sul contatore di sempre
 * il numero non cambi di una virgola, e che su quello che si azzera venga
 * fuori il totale vero invece di una frazione.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  cumulativeValue,
  mesiDaiGiorni,
  recorderBucketConsumptions,
} from "../src/core/period-service.js";

/* I giorni di un mese, con il contatore che cresce come lo scrive il Recorder. */
function giorniDelMese(anno, mese, consumiAlGiorno, partenza = 0) {
  let contatore = partenza;
  return consumiAlGiorno.map((quanto, indice) => {
    contatore += quanto;
    return { start: new Date(anno, mese, indice + 1).toISOString(), sum: contatore };
  });
}

/* Come contava prima, scritto qui per intero: la differenza fra il contatore
 * di un mese e quello di prima, con lo zero come pavimento. Sta nella prova e
 * non nel codice perche' e' il difetto, e un difetto si tiene fermo scrivendo
 * cosa faceva. */
function allaVecchiaManiera(mesi) {
  let precedente = null;
  let totale = 0;
  for (const riga of mesi) {
    const adesso = cumulativeValue(riga);
    totale += precedente === null ? Math.max(0, adesso) : Math.max(0, adesso - precedente);
    precedente = adesso;
  }
  return totale;
}

const sommaDeiMesi = (mesi) => mesi.reduce((somma, riga) => somma + riga.change, 0);

test("su un contatore di sempre i due modi danno lo stesso numero", () => {
  const gennaio = giorniDelMese(2026, 0, [10, 20, 30]);
  const febbraio = giorniDelMese(2026, 1, [5, 15], 60);
  const marzo = giorniDelMese(2026, 2, [40], 80);
  const giorni = recorderBucketConsumptions([...gennaio, ...febbraio, ...marzo]);
  const mesi = mesiDaiGiorni(giorni);

  assert.equal(mesi.length, 3);
  /* 60 + 20 + 40 = 120, che e' anche il contatore finale. */
  assert.equal(sommaDeiMesi(mesi), 120);
  assert.equal(cumulativeValue(mesi.at(-1)), 120);
  /* E la vecchia maniera, su questo contatore, dava lo stesso: nessuna
   * regressione dove funzionava. */
  const mesiInteri = [
    { start: new Date(2026, 0, 1).toISOString(), sum: 60 },
    { start: new Date(2026, 1, 1).toISOString(), sum: 80 },
    { start: new Date(2026, 2, 1).toISOString(), sum: 120 },
  ];
  assert.equal(allaVecchiaManiera(mesiInteri), 120);
});

test("su un contatore che si azzera ogni mese, sommare i giorni da il totale vero", () => {
  /* Tre mesi da 300, 200 e 250: il contatore riparte da zero ogni primo. */
  const gennaio = giorniDelMese(2026, 0, [100, 100, 100]);
  const febbraio = giorniDelMese(2026, 1, [100, 100]);
  const marzo = giorniDelMese(2026, 2, [150, 100]);
  const giorni = recorderBucketConsumptions([...gennaio, ...febbraio, ...marzo]);
  const mesi = mesiDaiGiorni(giorni);

  assert.deepEqual(
    mesi.map((riga) => Math.round(riga.change)),
    [300, 200, 250],
  );
  assert.equal(sommaDeiMesi(mesi), 750);
});

/* Gli stessi tre mesi, come li chiedeva prima: un intervallo per mese, col
 * contatore che a fine mese vale il totale DI QUEL MESE. */
const MESI_INTERI = [
  { start: new Date(2026, 0, 1).toISOString(), sum: 300 },
  { start: new Date(2026, 1, 1).toISOString(), sum: 200 },
  { start: new Date(2026, 2, 1).toISOString(), sum: 250 },
];

test("la vecchia maniera, sullo stesso contatore, ne perdeva piu' della meta'", () => {
  /* 300 (il primo, senza predecessore) + max(0, 200-300)=0 + max(0, 250-200)=50 */
  assert.equal(allaVecchiaManiera(MESI_INTERI), 350);
  assert.ok(allaVecchiaManiera(MESI_INTERI) < 750 / 2, "il difetto: meno della meta'");
});

test("e chiedere i mesi non basta nemmeno riconoscendo l'azzeramento", () => {
  /* Riconoscere il calo aiuta — 300 + 200 invece di 300 + 0 — ma il terzo mese
   * resta letto come crescita rispetto al secondo: 250-200 = 50 invece di 250.
   * Il conto giusto non si ottiene guardando i mesi, e questa e' la ragione per
   * cui si sommano i giorni. */
  const soloMesi = recorderBucketConsumptions(MESI_INTERI).reduce(
    (somma, riga) => somma + riga.change,
    0,
  );
  assert.equal(soloMesi, 550);
  assert.ok(soloMesi < 750, "sui mesi manca ancora il pezzo");
});

test("il mese in cui la colonnina e' entrata in funzione non sparisce", () => {
  /* Nessuna baseline: prima non c'era niente da pescare. Il primo giorno vale
   * quello che il contatore dice, che e' il consumo di quel giorno. */
  const giorni = recorderBucketConsumptions(giorniDelMese(2026, 5, [12, 8, 10]));
  const mesi = mesiDaiGiorni(giorni);
  assert.equal(mesi.length, 1);
  assert.equal(mesi[0].change, 30);
});

test("un giorno senza crescita non toglie niente al mese", () => {
  const giorni = [
    { start: new Date(2026, 0, 1).toISOString(), sum: 10, change: 10 },
    { start: new Date(2026, 0, 2).toISOString(), sum: 10, change: 0 },
    { start: new Date(2026, 0, 3).toISOString(), sum: 25, change: 15 },
  ];
  assert.equal(mesiDaiGiorni(giorni)[0].change, 25);
});

test("i mesi escono in ordine, e ognuno porta la data del suo primo giorno", () => {
  const giorni = [
    { start: new Date(2026, 2, 4).toISOString(), sum: 40, change: 40 },
    { start: new Date(2026, 0, 9).toISOString(), sum: 10, change: 10 },
    { start: new Date(2026, 1, 2).toISOString(), sum: 20, change: 20 },
  ];
  const mesi = mesiDaiGiorni(giorni);
  assert.deepEqual(
    mesi.map((riga) => new Date(riga.start).getMonth()),
    [0, 1, 2],
  );
  assert.deepEqual(
    mesi.map((riga) => new Date(riga.start).getDate()),
    [1, 1, 1],
  );
});

test("righe senza data non entrano nel conto", () => {
  assert.deepEqual(mesiDaiGiorni([{ change: 99 }, null, undefined]), []);
  assert.deepEqual(mesiDaiGiorni(), []);
  assert.deepEqual(mesiDaiGiorni("non una lista"), []);
});

/* Un riavvio che lascia in piedi quasi tutto è comunque un riavvio.
 *
 * La soglia con cui si distingue una limatura del Recorder da un contatore
 * ripartito stava a un decimo: sceso di più di un decimo, riavviato. Il
 * ragionamento era «un riavvio lascia una frazione di quello che c'era», e
 * quella frase non è vera.
 *
 * Un contatore mensile che chiude il mese a 50 kWh e il primo del mese dopo ne
 * consuma 46 legge 46: è sceso di quattro cinquantesimi, cioè meno di un
 * decimo, e passava per correzione. La serie 50, 46, 55 dava 5 invece di 55 —
 * e cioè proprio i contatori a riavvio mensile, quelli che questo conto esiste
 * per rimettere a posto, restavano quelli contati peggio.
 *
 * Non è la quota rimasta a dire cos'è successo: è quanto è stata grande la
 * scesa. Le briciole del Recorder sono briciole sempre.
 */
const riga = (giorno, sum) => ({ start: new Date(2026, 0, giorno).toISOString(), sum });

test("un contatore mensile che riparte alto conta tutto quello che segna", () => {
  const giorni = recorderBucketConsumptions([riga(1, 50), riga(2, 46), riga(3, 55)]);
  assert.deepEqual(
    giorni.map((g) => g.change),
    [50, 46, 9],
  );
  assert.equal(
    giorni.reduce((somma, g) => somma + g.change, 0),
    105,
    "il mese chiuso a 50 più i 55 del mese nuovo",
  );
});

test("una limatura del Recorder resta una limatura, e non conta niente", () => {
  /* 1300,0 che diventa 1299,2: è l'arrotondamento che si ricompila, non un
   * dato nuovo. Leggerlo come un riavvio vorrebbe dire contare milletrecento
   * come consumo di un secchiello — che è l'errore da cui questa soglia nasce. */
  const giorni = recorderBucketConsumptions([riga(1, 1300), riga(2, 1299.2), riga(3, 1310)]);
  assert.deepEqual(
    giorni.map((g) => g.change),
    [1300, 0, 10],
  );
});

test("fra la briciola e il riavvio la soglia non lascia zone grigie", () => {
  /* Un cinquantesimo esatto è ancora una limatura; appena oltre è un riavvio.
   * La direzione è scelta: prendere un riavvio per una correzione costa un
   * secchiello, il contrario costa gli anni di storia del contatore. */
  const briciola = recorderBucketConsumptions([riga(1, 100), riga(2, 98)]);
  assert.equal(briciola[1].change, 0, "il 2% netto è ancora il Recorder che lima");
  const riavvio = recorderBucketConsumptions([riga(1, 100), riga(2, 97.9)]);
  assert.equal(riavvio[1].change, 97.9, "oltre il 2% il contatore è ripartito");
});
