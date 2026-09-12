/* «Creare un avviso che segnali gli aggiornamenti presenti da effettuare,
 * compresi quelli della fantastica dashmodern» (#498).
 *
 * Home Assistant lo sa già: ogni integrazione, ogni add-on e il sistema stesso
 * pubblicano un'entità `update.` che sta a ON quando c'è una versione nuova, e
 * porta addosso quella installata e quella disponibile. Non c'è niente da
 * andare a chiedere fuori e niente da configurare — ed è la ragione per cui
 * questa tessera non ha caselle: un elenco scritto a mano invecchierebbe al
 * primo add-on installato.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { aggiornamentiDaFare, aspettaDiEssereFatto } from "../src/core/aggiornamenti-da-fare.js";
import { haOggettoWidget, oggettoWidget } from "../src/core/oggetti-widget.js";

const sorgente = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const CASA = {
  "update.dashboardmodern_v2": stato("update.dashboardmodern_v2", "on", {
    title: "Dashboard Modern v2",
    installed_version: "1.4.20",
    latest_version: "1.4.21",
  }),
  "update.home_assistant_core_update": stato("update.home_assistant_core_update", "on", {
    title: "Home Assistant Core",
    installed_version: "2026.9.0",
    latest_version: "2026.9.1",
  }),
  "update.mosquitto_broker_update": stato("update.mosquitto_broker_update", "on", {
    title: "Mosquitto broker",
  }),
  /* Già aggiornata: non è niente da fare. */
  "update.zigbee2mqtt_update": stato("update.zigbee2mqtt_update", "off", {
    title: "Zigbee2MQTT",
  }),
  /* Un'integrazione che non risponde non è un aggiornamento da fare: è
   * un'integrazione che non risponde. */
  "update.qualcosa": stato("update.qualcosa", "unavailable", { title: "Qualcosa" }),
  /* Non è un aggiornamento: è una luce. */
  "light.salone": stato("light.salone", "on", { friendly_name: "Salone" }),
};

test("aspetta solo chi ha davvero una versione nuova", () => {
  assert.equal(aspettaDiEssereFatto(CASA["update.dashboardmodern_v2"]), true);
  assert.equal(aspettaDiEssereFatto(CASA["update.zigbee2mqtt_update"]), false);
  assert.equal(aspettaDiEssereFatto(CASA["update.qualcosa"]), false);
  assert.equal(aspettaDiEssereFatto(CASA["light.salone"]), false);
  assert.equal(aspettaDiEssereFatto(null), false);
});

test("la plancia va davanti, gli altri in ordine", () => {
  /* Chi ha chiesto questa tessera l'ha chiesta anche — e soprattutto — per la
   * plancia: se c'è la sua, si nomina quella. Gli altri in ordine alfabetico,
   * che è l'unico ordine stabile fra una lettura e l'altra: per data non si
   * può, perché un'entità `update.` non dice da quando aspetta. */
  const fila = aggiornamentiDaFare(CASA);
  assert.deepEqual(
    fila.map((voce) => voce.nome),
    ["Dashboard Modern v2", "Home Assistant Core", "Mosquitto broker"],
  );
  assert.equal(fila[0].nostra, true);
  assert.equal(fila[1].nostra, false);
  assert.equal(fila[0].da, "1.4.20");
  assert.equal(fila[0].a, "1.4.21");
  /* Un add-on che non dichiara le versioni non sparisce: si nomina e basta. */
  assert.equal(fila[2].da, "");
});

test("una casa in pari non ha niente da dire", () => {
  assert.deepEqual(aggiornamentiDaFare({}), []);
  assert.deepEqual(aggiornamentiDaFare(null), []);
  assert.deepEqual(
    aggiornamentiDaFare({ "update.zigbee2mqtt_update": CASA["update.zigbee2mqtt_update"] }),
    [],
  );
});

test("la tessera compare solo quando c'è qualcosa da fare, e non è rossa", () => {
  const modello = sorgente.slice(
    sorgente.indexOf("function aggiornamentiModel("),
    sorgente.indexOf("function porteModel("),
  );
  /* Una tessera «Aggiornamenti: 0» occupa un posto per dire che non è successo
   * niente, e in una Home dove ogni posto è una cosa che si guarda quello è un
   * posto sprecato. */
  assert.match(modello, /if \(!fila\.length\) return null;/);
  /* Ambra, non rossa: un aggiornamento non è un guasto, e il rosso in questa
   * Home vuol dire «vai a vedere adesso». */
  assert.match(modello, /accent: "#d97706"/);
  assert.doesNotMatch(modello, /alert:/);
  /* Si spegne e si sposta come le altre: la sua riga sta nel catalogo. */
  assert.match(modello, /widgetExcludedEntities\("aggiornamenti"\)/);
});

test("aprendo la tessera si vedono tutti, uno per uno, con le loro versioni", () => {
  /* La tessera nomina il primo e conta gli altri: i nomi di sei add-on in una
   * didascalia non si leggono. Chi la apre li vuole vedere tutti — ed è per
   * questo che si apre.
   *
   * Il caso mancava nella funzione che sceglie cosa disegnare dentro la
   * finestra, e la finestra rispondeva vuota con la tessera accesa su sei
   * aggiornamenti: il modo peggiore di sbagliare, perché non sembra un difetto
   * ma una casa in pari. */
  assert.match(
    sorgente,
    /if \(widget\.key === "aggiornamenti"\) return aggiornamentiDetail\(widget\);/,
  );

  /* E legge il campo che il modello scrive davvero: due nomi diversi per la
   * stessa lista sarebbero un caso che c'è e una finestra vuota lo stesso. */
  const modello = sorgente.slice(
    sorgente.indexOf("function aggiornamentiModel("),
    sorgente.indexOf("function porteModel("),
  );
  assert.match(modello, /\n    aggiornamenti: fila,/);
  const finestra = sorgente.slice(
    sorgente.indexOf("function aggiornamentiDetail("),
    sorgente.indexOf("function customDetail("),
  );
  assert.match(finestra, /widget\.aggiornamenti \|\| \[\]/);

  /* Da che versione a che versione: è quello che serve per decidere se andarlo
   * a fare adesso o dopo cena. Chi le versioni non le dichiara si nomina e
   * basta, come già fa la tessera. */
  assert.match(finestra, /const da = clean\(voce\?\.da\);/);
  assert.match(finestra, /const a = clean\(voce\?\.a\);/);
  assert.match(finestra, /da \&\& a \?/);

  /* E nessun tasto per installare: si installa da Home Assistant, dove accanto
   * al tasto ci sono le note di rilascio. */
  assert.doesNotMatch(finestra, /chiamaHa|call_service|cdApplEntTog/);
});

test("la tessera porta un disegno nostro, non un'emoji del telefono", () => {
  /* Ogni sistema disegna le emoji a modo suo, e una freccia piatta accanto a
   * una lampadina di vetro si vede da un chilometro. La tessera degli
   * aggiornamenti era l'unica dell'elenco senza il suo oggetto: nella scheda
   * che li elenca tutti si riconosceva perché stonava. */
  assert.equal(haOggettoWidget("aggiornamenti"), true);
  const disegno = oggettoWidget("aggiornamenti");
  assert.match(disegno, /<svg class="dm-oggetto"/);
  /* L'ambra della tessera, non il rosso: un aggiornamento non è un guasto. */
  assert.match(disegno, /#f59e0b/);
});
