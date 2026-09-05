/* Un Recorder lento non si chiama due volte.
 *
 * «La sezione energia continua a non funzionare, ma che significa "occupato"?»
 *
 * Il messaggio diceva «il Recorder e' lento o la connessione e' occupata», e
 * «occupata» non voleva dire niente. Ma dietro c'era di peggio: la domanda
 * delle statistiche aveva una ricaduta di compatibilita' — le versioni vecchie
 * di Home Assistant non conoscono il campo `units`, e a quelle si richiede
 * senza — che scattava per QUALUNQUE errore, timeout compreso.
 *
 * Su un Recorder lento, che e' esattamente il caso in cui il timeout scatta,
 * voleva dire chiedergli la stessa cosa pesante una seconda volta mentre stava
 * ancora arrancando sulla prima: doppio carico proprio sulla cosa gia' troppo
 * lenta, e ventiquattro secondi prima di dire qualcosa a chi guarda.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  eUnErroreDiCompatibilita,
  TEMPO_MASSIMO_STATISTICHE,
  tempoPerLeStatistiche,
} from "../src/core/period-service.js";

test("un timeout non e' un errore di compatibilita': non si richiede", () => {
  /* Questi vengono da una macchina che non ce la fa, non da una versione
   * vecchia: rifare la domanda non li aggiusta, li raddoppia. */
  for (const messaggio of [
    "Home Assistant response timeout",
    "State subscription timeout",
    "WebSocket connection closed",
    "socket hang up",
    "network error",
    "The operation was aborted",
  ])
    assert.equal(
      eUnErroreDiCompatibilita(new Error(messaggio)),
      false,
      `«${messaggio}» non deve far ripartire la domanda`,
    );
});

test("un campo che Home Assistant non conosce e' il caso per cui la ricaduta esiste", () => {
  for (const messaggio of [
    "extra keys not allowed @ data['units']",
    "unknown field units",
    "invalid units",
    "unsupported parameter",
    "required key not provided",
  ])
    assert.equal(
      eUnErroreDiCompatibilita(new Error(messaggio)),
      true,
      `«${messaggio}» deve far richiedere senza units`,
    );
});

test("un errore muto non fa richiedere niente", () => {
  /* Nel dubbio non si raddoppia il carico. */
  assert.equal(eUnErroreDiCompatibilita(null), false);
  assert.equal(eUnErroreDiCompatibilita(new Error("")), false);
  assert.equal(eUnErroreDiCompatibilita(new Error("boom")), false);
});

test("una domanda pesante ha piu' tempo di una leggera", () => {
  const base = 12000;
  const giorni = (quanti) => {
    const fine = new Date("2026-09-05T00:00:00Z");
    const inizio = new Date(fine.getTime() - quanti * 86400000);
    return tempoPerLeStatistiche(inizio.toISOString(), fine.toISOString(), base);
  };
  /* Un giorno e due giorni: il tempo di sempre, non c'e' niente da aspettare
   * in piu' per ventiquattro secchielli. */
  assert.equal(giorni(1), base);
  assert.equal(giorni(2), base);
  /* Un mese e un anno pesano, e il tempo cresce con loro. */
  assert.ok(giorni(31) > base, "un mese deve avere piu' tempo di un giorno");
  assert.ok(giorni(365) > giorni(31), "un anno deve avere piu' tempo di un mese");
  /* Ma si ferma: oltre il minuto non e' attesa, e' una pagina che sembra
   * rotta. */
  assert.equal(giorni(365), TEMPO_MASSIMO_STATISTICHE);
  assert.ok(TEMPO_MASSIMO_STATISTICHE <= 60000);
});

test("un arco che non si capisce non toglie tempo", () => {
  const base = 12000;
  /* Date storte, o fine prima dell'inizio: si torna al tempo di sempre invece
   * di dare zero e far fallire tutto subito. */
  assert.equal(tempoPerLeStatistiche("boh", "peggio", base), base);
  assert.equal(tempoPerLeStatistiche(undefined, undefined, base), base);
  assert.equal(
    tempoPerLeStatistiche("2026-09-05T00:00:00Z", "2026-09-01T00:00:00Z", base),
    base,
  );
});
