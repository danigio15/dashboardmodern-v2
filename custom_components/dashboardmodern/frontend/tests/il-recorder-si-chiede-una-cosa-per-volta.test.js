/* Al Recorder si chiedono al massimo due cose per volta, e dopo un timeout
 * si respira.
 *
 * «Energia giornaliera e mensile fa capricci: resta il velo, o 0 kWh e
 * timeout.» Un aggiornamento lancia sette letture delle statistiche insieme,
 * e su un server piccolo si contendono il disco: tutte rallentano, qualcuna
 * scade. In fila nessuna aspetta le altre mentre il suo cronometro corre; e
 * dopo un timeout la prossima ripresa aspetta cinque minuti, non uno.
 *
 * Una per volta (1.4.11) era troppo poco — «devi velocizzare il caricamento
 * dei dati energia» — e, peggio, ogni richiesta nuova scavalcava quella in
 * corso e la buttava via: coi giri piu' lunghi il pacchetto non arrivava mai.
 * Due corsie, e una richiesta in corso per lo stesso periodo che si tiene.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AFFANNO_DEL_RECORDER_MS,
  CORSIE_DEL_RECORDER,
  HomeAssistantBroker,
  PESANTI_PER_IL_RECORDER,
} from "../src/core/period-service.js";
import {
  RIPOSO_ENERGIA_DI_SPALLE_MS,
  RIPOSO_ENERGIA_MS,
  riposoDeiPeriodi,
} from "../src/sections/energy-section.js";

/* Un socket che si ricorda cosa gli e' stato mandato e risponde a comando. */
function socketFinto(broker) {
  const inviati = [];
  const socket = {
    send(raw) {
      inviati.push(JSON.parse(raw));
    },
  };
  broker.connect = async () => socket;
  const rispondi = (indice, result = {}) =>
    broker.handleMessage(
      JSON.stringify({ type: "result", id: inviati[indice].id, success: true, result }),
      () => {},
      () => {},
    );
  return { inviati, rispondi };
}

const domanda = (giorno) => ({
  type: "recorder/statistics_during_period",
  start_time: `2026-09-0${giorno}T00:00:00.000Z`,
  end_time: `2026-09-0${giorno}T23:00:00.000Z`,
  statistic_ids: ["sensor.casa"],
  period: "hour",
});

const unGiro = () => new Promise((r) => setTimeout(r, 0));

test("tre domande al Recorder: due partono insieme, la terza aspetta un posto", async () => {
  assert.equal(CORSIE_DEL_RECORDER, 2);
  const broker = new HomeAssistantBroker({ timeout: 5000 });
  const { inviati, rispondi } = socketFinto(broker);
  const prima = broker.request(domanda(1));
  const seconda = broker.request(domanda(2));
  const terza = broker.request(domanda(3));
  await unGiro();
  assert.equal(inviati.length, 2, "due corsie: la terza aspetta che una si liberi");
  rispondi(0, { "sensor.casa": [] });
  await prima;
  await unGiro();
  assert.equal(inviati.length, 3, "liberata una corsia, la terza parte");
  rispondi(1, { "sensor.casa": [] });
  rispondi(2, { "sensor.casa": [{ sum: 2 }] });
  assert.deepEqual(await seconda, { "sensor.casa": [] });
  assert.deepEqual(await terza, { "sensor.casa": [{ sum: 2 }] });
  assert.equal(broker.recorderInAffanno(), false);
});

test("quello che non pesa sul Recorder non si mette in fila", async () => {
  const broker = new HomeAssistantBroker({ timeout: 5000 });
  const { inviati, rispondi } = socketFinto(broker);
  const pesante = broker.request(domanda(1));
  const leggera = broker.request({ type: "get_states" });
  await unGiro();
  assert.equal(inviati.length, 2);
  rispondi(0, {});
  rispondi(1, []);
  await Promise.all([pesante, leggera]);
  assert.equal(PESANTI_PER_IL_RECORDER.has("recorder/statistics_during_period"), true);
  assert.equal(PESANTI_PER_IL_RECORDER.has("history/history_during_period"), true);
  assert.equal(PESANTI_PER_IL_RECORDER.has("get_states"), false);
});

test("un timeout non blocca la fila, e segna il Recorder in affanno", async () => {
  const broker = new HomeAssistantBroker({ timeout: 20 });
  const { inviati, rispondi } = socketFinto(broker);
  const prima = broker.request(domanda(1));
  const seconda = broker.request(domanda(2));
  const terza = broker.request(domanda(3));
  await unGiro();
  assert.equal(inviati.length, 2);
  /* La seconda risponde subito; la prima resta appesa fino alla scadenza. */
  rispondi(1, { "sensor.casa": [] });
  await seconda;
  await unGiro();
  assert.equal(inviati.length, 3, "liberata una corsia, la terza parte");
  rispondi(2, { "sensor.casa": [{ sum: 1 }] });
  assert.deepEqual(await terza, { "sensor.casa": [{ sum: 1 }] });
  /* Il cronometro della terza e' partito quando e' partita lei: la scadenza
   * della prima non la tocca. */
  await assert.rejects(prima, /timeout/);
  assert.equal(broker.recorderInAffanno(), true);
  /* E passati i cinque minuti si torna a chiedere col passo di prima. */
  assert.equal(broker.recorderInAffanno(Date.now() + AFFANNO_DEL_RECORDER_MS + 1), false);
  assert.equal(AFFANNO_DEL_RECORDER_MS, 5 * 60_000);
});

test("il riposo vale anche a freddo, quando non c'e' ancora un pacchetto", () => {
  const energia = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "energy-section.js"),
    "utf8",
  );
  const ripresa = energia.indexOf("const inAffanno = Boolean(broker?.recorderInAffanno?.())");
  assert.ok(ripresa > 0);
  assert.match(
    energia.slice(ripresa, ripresa + 400),
    /inAffanno\s*\?\s*RIPOSO_ENERGIA_DI_SPALLE_MS/,
  );
});

test("una richiesta in corso con la stessa chiave si tiene, non si butta via", () => {
  /* Dal campo, dopo la 1.4.11: «tolto il velo ma i dati non si aggiornano».
   * Ogni richiesta nuova faceva scartare quella in corso a risposta
   * arrivata; adesso si scarta solo se nel frattempo e' cambiato cio' che
   * legge — periodo, impianto, configurazione — e chi chiede mentre una
   * lettura con la stessa chiave e' in corso riceve quella. */
  const energia = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "energy-section.js"),
    "utf8",
  );
  assert.match(
    energia,
    /if \(state\.caricoInCorso\?\.chiave === chiave\) return state\.caricoInCorso\.promessa;/,
  );
  assert.match(energia, /if \(chiave !== chiaveDelCarico\(selectedPeriod\(\)\)\) return null;/);
  assert.doesNotMatch(energia, /if \(generation !== state\.generation\) return null;/);
  /* La chiave porta il periodo, l'impianto e il numero della configurazione,
   * e quel numero cresce a ogni modifica salvata nel magazzino (osservazione
   * della review: la maschera cambiata a meta' lettura riceveva il pacchetto
   * di prima). */
  assert.match(
    energia,
    /return `\$\{mese\}\|\$\{impiantoScelto\(\)\}\|\$\{state\.configurazione\}`;/,
  );
  const magazzino = energia.indexOf("state.storeUnsubscribe = dashboardStore().subscribe(");
  assert.ok(magazzino > 0);
  assert.match(energia.slice(magazzino, magazzino + 500), /state\.configurazione \+= 1;/);
  /* E quando il velo se ne va prima del pacchetto, si dice a che punto si e':
   * il conto e' del singolo carico, non di tutti quelli in corso. */
  assert.match(energia, /Sto ancora leggendo le statistiche del Recorder/);
  assert.match(energia, /const \{ fatte, totali \} = state\.caricoInCorso\.avanzamento;/);
  assert.doesNotMatch(energia, /state\.avanzamento/);
  /* Un carico scavalcato non spegne l'attesa di chi l'ha scavalcato. */
  assert.match(
    energia,
    /if \(state\.caricoInCorso !== carico\) return;\s*state\.caricoInCorso = null;\s*setEnergyLoading\(false\);/,
  );
});

test("col Recorder in affanno l'Energia riposa cinque minuti anche a pagina aperta", () => {
  const finta = {
    visibilityState: "visible",
    getElementById: (id) => (id === "page-energy" ? { classList: { contains: () => true } } : null),
  };
  assert.equal(riposoDeiPeriodi(finta, false), RIPOSO_ENERGIA_MS);
  assert.equal(riposoDeiPeriodi(finta, true), RIPOSO_ENERGIA_DI_SPALLE_MS);
});
