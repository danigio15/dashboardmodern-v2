/* «L'entità della wallbox è iniziata quest'anno e calcola male i valori.»
 *
 * Il consumo di un intervallo è la differenza fra il contatore del Recorder e
 * quello di prima. Per il primo intervallo il «quello di prima» lo porta la
 * baseline: chi chiede le statistiche ne pesca apposta una che sta subito
 * fuori dalla finestra.
 *
 * Ma un'entità nata DENTRO la finestra una baseline non ce l'ha — prima di lei
 * non c'era niente da pescare — e allora il primo intervallo restava senza
 * predecessore e veniva buttato via. Su una wallbox accesa a metà anno, il
 * mese in cui è entrata in funzione spariva da ogni conto: dal totale
 * dell'anno, dal grafico giornaliero, dal riepilogo del dispositivo.
 *
 * Il valore giusto ce l'ha addosso: il contatore parte da zero quando le
 * statistiche di quell'entità cominciano, quindi per il primo intervallo di
 * una serie il contatore È il consumo di quell'intervallo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { recorderBucketConsumptions } from "../src/core/period-service.js";

/* Una wallbox accesa a giugno, guardata sull'anno: quattro mesi di contatore
 * che cresce, e niente prima. */
const WALLBOX = [
  { start: "2026-06-01T00:00:00Z", sum: 40 },
  { start: "2026-07-01T00:00:00Z", sum: 105 },
  { start: "2026-08-01T00:00:00Z", sum: 180 },
  { start: "2026-09-01T00:00:00Z", sum: 248.1 },
];

test("senza baseline il primo mese conta, invece di sparire", () => {
  const mesi = recorderBucketConsumptions(WALLBOX, null);
  assert.equal(mesi.length, 4, "quattro mesi di dati, quattro mesi di conto");
  assert.deepEqual(
    mesi.map((riga) => riga.change),
    [40, 65, 75, 68.1],
  );
  /* Il totale dell'anno è il contatore dell'ultimo mese: l'entità è nata da
   * zero, quindi tutto quello che ha consumato sta lì dentro. */
  const anno = mesi.reduce((somma, riga) => somma + riga.change, 0);
  assert.equal(Math.round(anno * 10) / 10, 248.1);
});

test("con la baseline non cambia niente: si usa lei, come sempre", () => {
  /* È il caso di un'entità che c'era già: la finestra comincia in mezzo alla
   * sua storia, e il contatore di partenza va sottratto. Prendere il contatore
   * per consumo qui vorrebbe dire scambiare il totale di sempre per il consumo
   * di un mese — l'errore opposto, e più grosso. */
  const baseline = { start: "2026-05-01T00:00:00Z", sum: 1000 };
  const righe = [
    { start: "2026-06-01T00:00:00Z", sum: 1040 },
    { start: "2026-07-01T00:00:00Z", sum: 1105 },
  ];
  const mesi = recorderBucketConsumptions(righe, baseline);
  assert.equal(mesi.length, 2);
  assert.deepEqual(
    mesi.map((riga) => riga.change),
    [40, 65],
  );
});

test("un solo intervallo e nessuna baseline: è il primo, e vale quanto dice", () => {
  const solo = recorderBucketConsumptions([{ start: "2026-06-01T00:00:00Z", sum: 40 }], null);
  assert.deepEqual(
    solo.map((riga) => riga.change),
    [40],
  );
});

test("una baseline senza contatore non conta come baseline", () => {
  /* Il Recorder può rispondere con una riga senza `sum`: non è un punto di
   * partenza, è una riga vuota. Trattarla come baseline vorrebbe dire buttare
   * via il primo intervallo di nuovo, che è il difetto di partenza. */
  const mesi = recorderBucketConsumptions(WALLBOX, { start: "2026-05-01T00:00:00Z" });
  assert.equal(mesi.length, 4);
  assert.equal(mesi[0].change, 40);
});

test("un contatore che scende è ripartito da zero, e il suo valore è il consumo", () => {
  /* Qui prima si diceva zero, con questa ragione: «il Recorder l'azzeramento
   * lo gestisce già nel suo `sum`, e contarlo qui vorrebbe dire contarlo due
   * volte». La ragione regge per un contatore di sempre, che infatti non
   * scende mai — e allora questo ramo non si percorre nemmeno.
   *
   * Non regge per un contatore che si azzera per mestiere: quello mensile di
   * una wallbox riparte da zero il primo di ogni mese, e il `sum` riparte con
   * lui. Dicendo zero si buttava via il primo giorno di ogni mese, dodici
   * giorni all'anno, e per una colonnina che carica di notte non è poco. È il
   * pezzo che mancava a «il totale da inizio anno è 1440,76 kWh» contro i 546
   * che la plancia diceva.
   *
   * Quando il contatore scende, quello che segna adesso è quanto ha contato da
   * quando è ripartito: quello è il consumo di questo intervallo. Un contatore
   * che non si azzera non scende, quindi per lui non cambia niente. */
  const scende = recorderBucketConsumptions(
    [
      { start: "2026-06-01T00:00:00Z", sum: 40 },
      { start: "2026-07-01T00:00:00Z", sum: 30 },
    ],
    null,
  );
  assert.deepEqual(
    scende.map((riga) => riga.change),
    [40, 30],
  );
  /* E ogni riga porta ancora il suo `start`: chi disegna il grafico ci mette
   * il giorno sotto la colonna. */
  assert.equal(scende[0].start, "2026-06-01T00:00:00Z");
});

test("nessuna riga, nessun conto", () => {
  assert.deepEqual(recorderBucketConsumptions([], null), []);
  assert.deepEqual(recorderBucketConsumptions(null, null), []);
});
