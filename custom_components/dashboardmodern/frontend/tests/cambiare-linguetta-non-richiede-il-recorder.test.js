/* Cambiare linguetta non e' un motivo per rileggere il Recorder.
 *
 * Ogni clic dentro la Panoramica, il Mese, una sotto-linguetta o una scheda
 * dell'Energia faceva partire un aggiornamento intero — sette letture del
 * Recorder, oggi tre — anche a mezzo secondo dal precedente. Chi guarda i tre
 * riquadri uno dopo l'altro ne pagava uno per tocco, sul mini PC, che e'
 * proprio il momento in cui il Recorder arranca. I numeri pero' sono gia' nel
 * pacchetto: cambiare linguetta cambia quali si guardano, non quali sono.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

const energia = await import("../src/sections/energy-section.js");
const stato = globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__;

function pulisci() {
  globalThis.clearTimeout?.(stato.refreshTimer);
  globalThis.clearTimeout?.(stato.projectionFrame);
  stato.refreshTimer = 0;
  stato.projectionFrame = 0;
}

test("un pacchetto fresco non vale una domanda: si ridisegna e basta", () => {
  pulisci();
  stato.bundle = { day: {}, month: {}, year: {} };
  stato.lastRefreshAt = Date.now();
  assert.equal(energia.pacchettoDaRileggere(), false);
  assert.equal(energia.refreshEnergyIfStale(), false, "non si e' chiesto niente al Recorder");
  assert.equal(stato.refreshTimer, 0, "nessuna lettura programmata");
  assert.notEqual(stato.projectionFrame, 0, "il pacchetto che c'e' si ridisegna");
  pulisci();
});

test("un pacchetto piu' vecchio della cadenza vale la domanda", () => {
  pulisci();
  stato.bundle = { day: {}, month: {}, year: {} };
  stato.lastRefreshAt = Date.now() - energia.RIPOSO_ENERGIA_MS - 1;
  assert.equal(energia.pacchettoDaRileggere(), true);
  assert.equal(energia.refreshEnergyIfStale(), true);
  assert.notEqual(stato.refreshTimer, 0, "la lettura e' stata programmata");
  pulisci();
});

test("senza pacchetto si chiede sempre: e' il primo caricamento", () => {
  pulisci();
  stato.bundle = null;
  stato.lastRefreshAt = 0;
  assert.equal(energia.pacchettoDaRileggere(), true);
  assert.equal(energia.refreshEnergyIfStale(), true);
  pulisci();
  stato.bundle = null;
});

test("la porta di tutti i giorni e' gentile, e quella che forza e' un'altra", () => {
  /* Il guscio si tiene in mano `cdTotalsRun` da prima che i moduli esistano
   * — `setTimeout(cdTotalsRun, 2500)` prende la funzione di allora — e quella
   * chiama `refresh()` sul servizio: riscrivere il nome non basta, e' la
   * porta a dover essere gentile. Chi ha ragione di insistere (i prezzi
   * appena salvati) ne ha una sua. */
  const servizio = globalThis.DashboardModernEnergyService;
  assert.equal(typeof servizio.refresh, "function");
  assert.equal(typeof servizio.refreshNow, "function");
  const energia = leggi("sections/energy-section.js");
  assert.match(energia, /refresh: \(\) => refreshEnergyIfStale\(\),/);
  assert.match(energia, /refreshNow: \(\) => scheduleEnergyRefresh\(true\),/);
  /* E chi chiede da fuori non tiene una copia della regola. */
  const richiami = leggi("sections/energy-refresh-section.js");
  assert.match(richiami, /root\.DashboardModernEnergyService\?\.refresh\?\.\(\);/);
  assert.equal(/60_000|60000/.test(richiami), false, "la cadenza e' stata copiata qui dentro");
  const guardia = leggi("sections/energy-legacy-guard-section.js");
  assert.match(guardia, /return root\.DashboardModernEnergyService\?\.refresh\?\.\(\);/);
});
