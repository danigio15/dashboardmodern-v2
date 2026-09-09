/* «Il flow dovrebbe essere dal FV verso casa ed è corretto, ma poi dovrebbe
 *  anche caricare la batteria mentre in questo momento sembra scaricarsi
 *  perché il flow tratteggiato va dalla batteria verso casa ma non è esatto.
 *  Dovrebbe essere il contrario in base a carica/scarica della batteria»
 * (#434).
 *
 * La mappa dei flussi ha una convenzione sola: positivo = scarica. I sensori
 * no. Un solo numero col segno lo pubblicano tutti, e metà lo scrivono positivo
 * quando la batteria si CARICA: da un valore solo non si indovina, e chi guarda
 * vede le frecce all'incontrario. Lo dice la casa, una volta.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHIAVE_VERSO_BATTERIA,
  allocateSourceFlows,
  batteriaGirata,
  batteryReadout,
  potenzaDellaBatteria,
} from "../src/core/energy-flow-truth.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("il verso si legge dalla casa, e di serie è quello di sempre", () => {
  assert.equal(CHIAVE_VERSO_BATTERIA, "cd_batteria_verso");
  /* Chi non tocca niente resta com'era: è la regola che rende questa
   * correzione sicura per tutti quelli a cui il disegno andava bene. */
  assert.equal(batteriaGirata(undefined), false);
  assert.equal(batteriaGirata({}), false);
  assert.equal(batteriaGirata({ girata: false }), false);
  assert.equal(batteriaGirata({ girata: true }), true);
  /* Una casella vecchia può portare il valore nudo invece dell'oggetto. */
  assert.equal(batteriaGirata(true), true);
  assert.equal(batteriaGirata("true"), true);
  assert.equal(batteriaGirata([]), false);
});

test("girato, il numero cambia segno e basta", () => {
  assert.equal(potenzaDellaBatteria(800, false), 800);
  assert.equal(potenzaDellaBatteria(800, true), -800);
  assert.equal(potenzaDellaBatteria(-800, true), 800);
  /* Zero è zero: «meno zero» non esiste per chi guarda, e si porterebbe
   * dietro un segno che a valle diventa una freccia. */
  assert.equal(Object.is(potenzaDellaBatteria(0, true), 0), true);
  /* E «non c'è un numero» non è «zero watt»: spento e non configurato sono
   * due risposte diverse. */
  assert.equal(potenzaDellaBatteria(null, true), null);
  assert.equal(potenzaDellaBatteria("boh", false), null);
});

test("con il verso giusto la mappa disegna la carica, non la scarica", () => {
  /* La casa di chi ha segnalato: il fotovoltaico produce, la casa consuma meno
   * di quello che arriva, e la batteria si sta caricando — il suo sensore lo
   * scrive positivo. */
  const grezzo = 1500;
  const solare = 4000;
  const rete = -200;

  const comEra = allocateSourceFlows({
    solar: solare,
    grid: rete,
    battery: potenzaDellaBatteria(grezzo, false),
  });
  /* Prima: la plancia leggeva «positivo = scarica» e disegnava la batteria che
   * alimenta casa. È la freccia sbagliata della segnalazione. */
  assert.ok(comEra.batteryToHome > 0);
  assert.equal(comEra.solarToBattery, 0);

  const girata = allocateSourceFlows({
    solar: solare,
    grid: rete,
    battery: potenzaDellaBatteria(grezzo, true),
  });
  /* Dopo: il solare carica la batteria, e dalla batteria non esce niente. */
  assert.equal(girata.batteryToHome, 0);
  assert.equal(girata.solarToBattery, 1500);
  assert.ok(girata.solarToHome > 0);
});

test("anche la bolla dice la stessa cosa della mappa", () => {
  /* La freccia della bolla e quella della mappa vengono dallo stesso numero:
   * due letture dello stesso segno non possono discordare. */
  assert.equal(batteryReadout(potenzaDellaBatteria(1500, true)), "▼ 1500 W");
  assert.equal(batteryReadout(potenzaDellaBatteria(1500, false)), "▲ 1500 W");
});

test("i due posti che disegnano la batteria passano dalla stessa regola", async () => {
  const energia = await leggi("../src/sections/energy-flow-section.js");
  const home = await leggi("../src/sections/home-widgets-section.js");
  /* La mappa della sezione Energia... */
  assert.match(energia, /function potenzaBatteriaViva\(\)/);
  assert.match(energia, /potenzaDellaBatteria\(\s*potenzaViva\("dm\.energy_potenza_batteria"\)/);
  /* ...e il flusso in Home, che è un altro disegno della stessa casa. Se uno
   * dei due si dimenticasse del verso, le due mappe direbbero il contrario
   * l'una dell'altra sulla stessa batteria. */
  assert.match(home, /batteria: potenzaDellaBatteria\(/);
  assert.match(home, /batteriaGirata\(readJson\(CHIAVE_VERSO_BATTERIA, \{\}\)\)/);
});

test("l'interruttore sta sotto la casella della batteria, dove ci si accorge", async () => {
  const scheda = await leggi("../src/sections/verso-batteria-editor-section.js");
  assert.match(scheda, /const RIF = "dm\.energy_potenza_batteria";/);
  assert.match(scheda, /casella\.after\(blocco\)/);
  assert.match(scheda, /data-dm-verso-batteria/);
  /* Il blocco resta appeso alla scheda che si rifà: è la meccanica condivisa,
   * quella che al blocco dei tasti su misura mancava (#431). */
  assert.match(scheda, /tieniIlBloccoNellaScheda\("dmVersoBatteria", ensureVersoBatteriaBlock\)/);
  /* E toccarlo ridisegna subito: chi lo accende sta guardando le frecce. */
  assert.match(scheda, /root\.renderFlusso\?\.\(\)/);
});
