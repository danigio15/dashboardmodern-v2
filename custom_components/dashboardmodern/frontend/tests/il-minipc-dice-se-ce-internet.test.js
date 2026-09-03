/* «Verifica offline: i dati sono stati inseriti tutti nella sezione e internet
 * è online.»
 *
 * La pastiglia della pagina MiniPC diceva OFFLINE su una macchina che stava
 * mandando CPU 14,1%, RAM 42% e disco 35% — cioè rispondeva benissimo.
 *
 * La ragione: il guscio legge UNA casella sola, «Raggiungibilità Google», e da
 * quella decide. Ma la sezione ne offre quattro che dicono la stessa cosa —
 * Stato Internet, Ping Internet, Raggiungibilità Google, Internet lavanderia —
 * e chi compila la scheda riempie quella che ha. Riempite le altre tre, la
 * quarta resta vuota, e una casella vuota diventava «OFFLINE»: una notizia
 * sulla connessione ricavata dal fatto che nessuno l'aveva data.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("una casella dice online in tutti i modi in cui i sensori lo dicono", async () => {
  const { letturaDellaRete } = await import("../src/sections/minipc-showcase-section.js");
  /* Il binary_sensor di connettività. */
  assert.equal(letturaDellaRete("on"), true);
  assert.equal(letturaDellaRete("off"), false);
  /* I template che qualcuno si scrive. */
  for (const detto of ["connected", "Connesso", "ONLINE", "up", "ok", "true", "home", "1"])
    assert.equal(letturaDellaRete(detto), true, detto);
  for (const detto of ["disconnected", "OFFLINE", "down", "false", "not_home", "0"])
    assert.equal(letturaDellaRete(detto), false, detto);
  /* Il sensore dell'integrazione Ping non dice «on»: dice i millisecondi del
   * giro, e un tempo di andata e ritorno vuol dire che qualcuno ha risposto. */
  assert.equal(letturaDellaRete("12.4"), true);
  assert.equal(letturaDellaRete("0,8"), true, "la virgola è un separatore, non un errore");
});

test("quello che non dice niente non dice «no»", async () => {
  const { letturaDellaRete } = await import("../src/sections/minipc-showcase-section.js");
  /* È la differenza che mancava: `null` vuol dire «questa casella non lo
   * dice», e da lì non si ricava un OFFLINE. */
  for (const muto of ["", "   ", "unavailable", "unknown", "ciao", null, undefined])
    assert.equal(letturaDellaRete(muto), null, String(muto));
});

test("si legge la prima casella compilata, non sempre la stessa", async () => {
  const { reteDelleCaselle, CASELLE_DI_RETE } =
    await import("../src/sections/minipc-showcase-section.js");
  /* L'ordine è quello in cui la sezione le elenca: la storica per prima. */
  assert.deepEqual(CASELLE_DI_RETE, [
    "dm.server_raggiungibilita_google",
    "dm.server_stato_internet",
    "dm.server_ping_internet",
    "dm.server_internet_lavanderia",
  ]);

  /* Il caso della segnalazione: la Google vuota, lo Stato Internet pieno. */
  const compilate = { "dm.server_stato_internet": "on" };
  assert.deepEqual(
    reteDelleCaselle((casella) => compilate[casella] || ""),
    {
      casella: "dm.server_stato_internet",
      online: true,
    },
  );

  /* Solo il ping, in millisecondi. */
  assert.equal(
    reteDelleCaselle((casella) => (casella === "dm.server_ping_internet" ? "12.4" : "")).online,
    true,
  );

  /* La prima che dice qualcosa vince: una casella muta non ferma la ricerca. */
  assert.equal(
    reteDelleCaselle((casella) =>
      casella === "dm.server_raggiungibilita_google"
        ? "unavailable"
        : casella === "dm.server_stato_internet"
          ? "off"
          : "",
    ).online,
    false,
  );

  /* Nessuna compilata: non si dice OFFLINE, si dice che non si sa. */
  assert.deepEqual(
    reteDelleCaselle(() => ""),
    { casella: "", online: null },
  );
});

test("con nessuna casella compilata la pastiglia non accusa la connessione", () => {
  const sorgente = leggi("sections/minipc-showcase-section.js");
  /* «NON CONFIGURATO» e il puntino grigio: il rosso è un allarme, e qui non
   * c'è niente di allarmante — c'è una casella vuota. */
  assert.match(sorgente, /t\("NON CONFIGURATO", "NOT CONFIGURED"\)/);
  assert.match(sorgente, /online === null \? "#94a3b8"/);
  /* E la card della rete segue tutt'e quattro le caselle: guardarne una sola
   * la faceva sparire a chi aveva riempito le altre. */
  assert.match(sorgente, /\{ id: "waw-net-badge", slots: CASELLE_DI_RETE \}/);
  assert.match(sorgente, /slots\.some\(\(slot\) => slotIsMapped\(slot\)\)/);
  /* La riscrittura passa dopo il guscio, che ridipinge a ogni battito, e
   * scrive solo quando il testo cambia davvero. */
  assert.match(sorgente, /raddrizzaLaRete\(page\);/);
  assert.match(sorgente, /if \(nodo && nodo\.textContent !== parola\) nodo\.textContent = parola;/);
});
