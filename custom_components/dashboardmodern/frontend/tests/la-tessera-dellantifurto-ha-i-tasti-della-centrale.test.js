/* «Nel widget sicurezza le icone e la relativa funzione di attivazione dei
 * comandi dell'antifurto sono diverse rispetto alla sezione dedicata dove tutto
 * è funzionante e in linea con l'antifurto» (#316).
 *
 * La pagina Sicurezza chiede alla centrale quali inserimenti accetta —
 * `supported_features` — e toglie quelli che si e' scelto di non vedere. La
 * tessera della Home invece disegnava sempre le stesse tre pastiglie scritte a
 * mano: Fuori, Notte, Sblocca. Da qui tre bugie, tutte sulla stessa fila:
 *
 * - un tasto Notte su una centrale che quella modalita' non ce l'ha, che
 *   chiama un servizio e non succede niente;
 * - nessun tasto Casa, Vacanza o Parziale su una centrale che li accetta;
 * - il tasto acceso sbagliato: 🏠 «Fuori» spento mentre la casa e' inserita in
 *   `armed_home`, e 🔓 «Sblocca» acceso mentre la centrale sta inserendo.
 *
 * Chi decide quali tasti esistono deve essere uno solo, e le prove qui sotto
 * chiedono la fila alla pagina, che e' quella che lo sa.
 *
 * Nella stessa condizione stava la finestra rapida del banner in testata: la
 * sua griglia sta nel guscio, con quattro tasti scritti a mano, e il giro che
 * la disegna poteva nasconderne ma non aggiungerne. Chi ha una centrale che
 * accetta Vacanza o Parziale quei due tasti non li aveva mai visti, e i nomi
 * erano quelli del guscio, che in inglese sono rimasti a meta'. Adesso la
 * riempie la stessa fila, e l'ultima prova qui sotto lo sorveglia.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { ALARM_FEATURES, ALARM_MODE_CHOICE_KEY } from "../src/core/alarm-panel.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

async function vetrina() {
  return import(`../src/sections/security-showcase-section.js?fix=${Date.now()}`);
}

/* La centrale come la manda Home Assistant, con la maschera che si vuole. */
const centrale = (state, features) => ({ state, attributes: { supported_features: features } });

const memoria = new Map();

test.before(() => {
  globalThis.localStorage ||= {
    getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
    setItem: (chiave, valore) => memoria.set(chiave, String(valore)),
    removeItem: (chiave) => memoria.delete(chiave),
  };
});

test.afterEach(() => memoria.clear());

test("i tasti della tessera sono quelli che la centrale dichiara", async () => {
  const { alarmModeButtons } = await vetrina();
  /* Una Ring: casa, fuori, notte, vacanza e parziale. */
  const ring = alarmModeButtons(
    centrale(
      "disarmed",
      ALARM_FEATURES.home | ALARM_FEATURES.away | ALARM_FEATURES.night | ALARM_FEATURES.vacation,
    ),
  );
  assert.deepEqual(
    ring.map((voce) => voce.mode),
    ["home", "away", "night", "vacation", "disarm"],
  );
  /* E una centrale che il pernottamento non ce l'ha non porta il suo tasto:
   * era quello che chiamava un servizio nel vuoto. */
  const senzaNotte = alarmModeButtons(
    centrale("disarmed", ALARM_FEATURES.home | ALARM_FEATURES.away),
  );
  assert.deepEqual(
    senzaNotte.map((voce) => voce.mode),
    ["home", "away", "disarm"],
  );
  assert.equal(
    senzaNotte.some((voce) => voce.service === "alarm_arm_night"),
    false,
  );
});

test("ogni tasto porta il servizio, l'icona e il nome della sua modalita'", async () => {
  const { alarmModeButtons } = await vetrina();
  const tasti = alarmModeButtons(centrale("disarmed", ALARM_FEATURES.home | ALARM_FEATURES.away));
  const perModo = Object.fromEntries(tasti.map((voce) => [voce.mode, voce]));
  /* «Casa» non e' «Fuori»: la tessera mostrava 🏠 Fuori anche dove la pagina
   * mostra 🏡 Casa, e premendolo mandava l'inserimento totale. */
  assert.equal(perModo.home.service, "alarm_arm_home");
  assert.equal(perModo.home.icon, "🏡");
  assert.equal(perModo.away.service, "alarm_arm_away");
  assert.equal(perModo.away.icon, "🏠");
  assert.equal(perModo.disarm.service, "alarm_disarm");
  for (const voce of tasti) assert.ok(voce.label, `il tasto ${voce.mode} non ha un nome`);
});

test("il tasto acceso e' quello dello stato, e durante l'inserimento non e' Sblocca", async () => {
  const { alarmActiveButton, alarmModeButtons } = await vetrina();
  const maschera = ALARM_FEATURES.home | ALARM_FEATURES.away | ALARM_FEATURES.night;
  assert.equal(alarmActiveButton(centrale("armed_home", maschera)), "home");
  assert.equal(alarmActiveButton(centrale("armed_night", maschera)), "night");
  assert.equal(alarmActiveButton(centrale("disarmed", maschera)), "disarm");
  /* `arming` non e' ne' inserito ne' disinserito: la tessera accendeva Sblocca
   * perche' chiedeva «non e' armed?», e diceva che la casa era aperta mentre
   * si stava chiudendo. */
  assert.equal(alarmActiveButton(centrale("arming", maschera)), "");
  assert.equal(alarmActiveButton(centrale("pending", maschera)), "");
  /* Una centrale che non dichiara niente tiene i due tasti di sempre, e
   * `armed_home` accende il piu' vicino che c'e'. */
  assert.equal(alarmActiveButton({ state: "armed_home", attributes: {} }), "away");
  assert.deepEqual(
    alarmModeButtons({ state: "armed_home", attributes: {} }).map((voce) => voce.mode),
    ["away", "night", "disarm"],
  );
});

test("un tasto tolto in configurazione sparisce anche dalla tessera, e non ne accende un altro", async () => {
  const { alarmActiveButton, alarmModeButtons } = await vetrina();
  const maschera = ALARM_FEATURES.home | ALARM_FEATURES.away | ALARM_FEATURES.night;
  globalThis.localStorage.setItem(ALARM_MODE_CHOICE_KEY, JSON.stringify(["home"]));
  assert.deepEqual(
    alarmModeButtons(centrale("disarmed", maschera)).map((voce) => voce.mode),
    ["away", "night", "disarm"],
  );
  /* La centrale il tasto Casa ce l'ha, e' chi guarda che ha scelto di non
   * vederlo: accendere «Fuori» direbbe che la casa e' inserita fuori mentre e'
   * inserita in casa. Meglio nessun tasto acceso. */
  assert.equal(alarmActiveButton(centrale("armed_home", maschera)), "");
});

test("anche la finestra rapida del banner prende la fila dalla centrale", () => {
  /* Quella griglia sta nel guscio, con quattro tasti scritti a mano: chi ha
   * una centrale che accetta Vacanza o Parziale non li ha mai avuti, perche'
   * il guscio nascondeva quelli di troppo ma non poteva aggiungerne. */
  const vetrina = leggi("sections/security-showcase-section.js");
  const pezzo = vetrina.slice(
    vetrina.indexOf("function vesteLaFinestraRapida"),
    vetrina.indexOf("function modeRow"),
  );
  assert.match(pezzo, /qa-alarm-grid/);
  assert.match(pezzo, /alarmModeButtons\(stateObj\)/);
  assert.match(pezzo, /alarmActiveButton\(stateObj\)/);
  /* Il tasto chiama il tastierino di sempre, con il servizio della sua
   * modalita': nessun servizio scritto a mano. */
  assert.match(pezzo, /promptPinAndSet\('\$\{voce\.service\}'\)/);
  assert.doesNotMatch(pezzo, /alarm_arm_/);
  /* E si rimette dietro alla plancia storica, che quella finestra la ridisegna
   * a ogni apertura e a ogni cambio di stato della centrale. */
  assert.match(vetrina, /root\.renderQuickAntifurto = vestita/);
  assert.match(vetrina, /__dmTastiVeri/);
});

test("la tessera non riscrive la fila: la chiede a chi la disegna nella pagina", () => {
  const tessera = leggi("sections/home-widgets-section.js");
  assert.match(tessera, /alarmModeButtons\(centrale\)/);
  assert.match(tessera, /alarmActiveButton\(centrale\)/);
  /* Nessun servizio dell'antifurto scritto a mano qui dentro. */
  assert.doesNotMatch(tessera, /"alarm_arm_(away|night|home|vacation|custom_bypass)"/);
  /* E la centrale e' quella di sempre, risolta come la risolve la pagina. */
  assert.match(tessera, /stateOf\(states, RIF_CENTRALE\)/);
});
