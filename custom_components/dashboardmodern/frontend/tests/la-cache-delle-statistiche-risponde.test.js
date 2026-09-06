/* La cache delle statistiche risponde davvero.
 *
 * C'era, ma non ha mai risposto a nessuno: la chiave portava la fine
 * dell'arco al millisecondo, e per il periodo corrente la fine e' «adesso» —
 * ogni giro una chiave nuova, e ogni aggiornamento dritto sul Recorder. Sopra
 * ci stava anche un tempo di dieci secondi messo a mano dall'Energia, cioe'
 * un trentesimo di quanto il dato resta buono. E niente usciva mai: su un
 * tablet acceso giorno e notte la memoria saliva e basta.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  HomeAssistantBroker,
  PASSO_DELLE_STATISTICHE_MS,
  VOCI_TENUTE_IN_CACHE,
  arcoChiuso,
  fineDaChiave,
} from "../src/core/period-service.js";

/* Un broker che conta le domande e risponde subito. */
function brokerContato() {
  const broker = new HomeAssistantBroker();
  const domande = [];
  broker.request = async (payload) => {
    domande.push(payload);
    return Object.fromEntries((payload.statistic_ids || []).map((id) => [id, [{ sum: 1 }]]));
  };
  return { broker, domande };
}

const IDS = ["sensor.casa_totale"];
const INIZIO = new Date("2026-09-06T00:00:00.000Z");

test("la stessa domanda due volte dentro il passo delle statistiche costa una domanda sola", async () => {
  const { broker, domande } = brokerContato();
  /* Dentro lo stesso secchiello di compilazione, per non finire a cavallo di
   * un confine mentre la prova gira. */
  const adesso = Math.floor(Date.now() / PASSO_DELLE_STATISTICHE_MS) * PASSO_DELLE_STATISTICHE_MS + 1000;
  await broker.statistics(IDS, INIZIO, new Date(adesso), "hour");
  /* Trenta secondi dopo: il Recorder non ha compilato niente di nuovo. */
  await broker.statistics(IDS, INIZIO, new Date(adesso + 30_000), "hour");
  assert.equal(domande.length, 1, "la seconda si serve dalla cache");
});

test("passato il passo delle statistiche si torna a chiedere", async () => {
  const { broker, domande } = brokerContato();
  /* La fine arrotondata cambia secchiello: e' li' che una riga nuova puo'
   * essere comparsa. */
  const primo = Math.floor(Date.now() / PASSO_DELLE_STATISTICHE_MS) * PASSO_DELLE_STATISTICHE_MS;
  await broker.statistics(IDS, INIZIO, new Date(primo + 1000), "hour");
  await broker.statistics(IDS, INIZIO, new Date(primo + PASSO_DELLE_STATISTICHE_MS + 1000), "hour");
  assert.equal(domande.length, 2);
});

test("la chiave arrotonda la fine di un arco aperto e tiene esatta quella di un arco chiuso", () => {
  const adesso = Date.parse("2026-09-06T12:07:31.412Z");
  /* Aperto: la fine e' adesso, e nella chiave diventa il secchiello. */
  assert.equal(fineDaChiave(adesso, adesso), "2026-09-06T12:05:00.000Z");
  assert.equal(fineDaChiave(adesso - 90_000, adesso), "2026-09-06T12:05:00.000Z");
  /* Chiuso: non puo' piu' entrarci niente, e la fine resta quella che e'. */
  const chiuso = "2026-09-01T00:00:00.000Z";
  assert.equal(fineDaChiave(chiuso, adesso), chiuso);
  assert.equal(arcoChiuso(chiuso, adesso), true);
  assert.equal(arcoChiuso(adesso, adesso), false);
  /* Il confine e' il passo con cui le statistiche si compilano: prima di
   * allora una riga poteva ancora entrare, dopo no. */
  assert.equal(arcoChiuso(adesso - PASSO_DELLE_STATISTICHE_MS - 1, adesso), true);
  assert.equal(arcoChiuso(adesso - PASSO_DELLE_STATISTICHE_MS + 1, adesso), false);
});

test("un arco chiuso si tiene a lungo, e la sua risposta non si richiede", async () => {
  const { broker, domande } = brokerContato();
  const fine = new Date(Date.now() - 3 * 86_400_000);
  await broker.statistics(IDS, INIZIO, fine, "day");
  await broker.statistics(IDS, INIZIO, fine, "day");
  assert.equal(domande.length, 1);
  assert.equal(broker.cacheHistoricalMs, 600000);
});

test("la cache non cresce per sempre: escono le scadute e le piu' vecchie", () => {
  const broker = new HomeAssistantBroker();
  const adesso = Date.now();
  broker.cache.set("scaduta", { at: adesso - 10_000, fino: adesso - 1, value: [] });
  broker.cache.set("viva", { at: adesso, fino: adesso + 60_000, value: [] });
  assert.equal(broker.potaLaCache(adesso), 1);
  assert.equal(broker.cache.has("scaduta"), false);
  assert.equal(broker.cache.has("viva"), true);

  for (let indice = 0; indice < VOCI_TENUTE_IN_CACHE + 20; indice += 1) {
    broker.cache.set(`voce-${indice}`, { at: adesso, fino: adesso + 60_000, value: [] });
  }
  assert.equal(broker.potaLaCache(adesso), VOCI_TENUTE_IN_CACHE);
  /* Escono le piu' vecchie: la prima messa dentro non c'e' piu', l'ultima si. */
  assert.equal(broker.cache.has("voce-0"), false);
  assert.equal(broker.cache.has(`voce-${VOCI_TENUTE_IN_CACHE + 19}`), true);
});

test("una risposta riusata torna in fondo alla fila", async () => {
  const { broker } = brokerContato();
  const adesso = Date.now();
  broker.cache.set("vecchia", { at: adesso, fino: adesso + 60_000, value: "A" });
  broker.cache.set("nuova", { at: adesso, fino: adesso + 60_000, value: "B" });
  assert.equal(await broker.cachedRequest({}, "vecchia", 60_000), "A");
  assert.deepEqual([...broker.cache.keys()], ["nuova", "vecchia"]);
});

test("l'Energia non accorcia piu' a mano il tempo della cache", async () => {
  await import("../src/sections/energy-section.js");
  const broker = globalThis.DashboardModernEnergyService?.broker;
  assert.ok(broker, "il servizio dell'Energia espone il suo broker");
  /* Erano dieci secondi contro i sessanta del broker, con un commento che
   * spiegava perche' sessanta: due padroni sullo stesso numero, e a vincere
   * era quello senza la ragione scritta. */
  assert.equal(broker.cacheCurrentMs, PASSO_DELLE_STATISTICHE_MS);
});
