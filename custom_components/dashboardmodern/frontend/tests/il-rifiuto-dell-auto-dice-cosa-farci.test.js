/* «Continua ad esserci il problema nel cambio percentuale ricarica.»
 *
 * La pastiglia diceva: «Home Assistant ha rifiutato il target: Leapmotor
 * remote control result failed: Token is invalid». La riga era vera e resta
 * vera — il comando all'auto non è arrivato — ma da fuori non si sa da che
 * parte prenderla, e si finisce per riprovare la tendina all'infinito.
 *
 * Un gettone scaduto ha un rimedio preciso: si riconnette l'integrazione. Chi
 * legge ha il diritto di saperlo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { ragioneDelRifiuto } from "../src/core/vehicle-model.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/ev-stato-e-target-section.js", import.meta.url),
  "utf8",
);

test("il gettone scaduto si riconosce, comunque sia scritto", () => {
  assert.equal(
    ragioneDelRifiuto("Leapmotor remote control result failed: Token is invalid"),
    "autenticazione",
  );
  assert.equal(ragioneDelRifiuto("401: Unauthorized"), "autenticazione");
  assert.equal(ragioneDelRifiuto("Session has expired, please log in again"), "autenticazione");
  assert.equal(ragioneDelRifiuto("Authentication failed"), "autenticazione");
  assert.equal(ragioneDelRifiuto("Forbidden (403)"), "autenticazione");
});

test("l'auto che dorme si riconosce, ed è un'altra cosa", () => {
  assert.equal(ragioneDelRifiuto("Timeout while calling service"), "non-raggiungibile");
  assert.equal(ragioneDelRifiuto("Vehicle is unavailable"), "non-raggiungibile");
  assert.equal(ragioneDelRifiuto("502 Bad Gateway"), "non-raggiungibile");
  assert.equal(ragioneDelRifiuto("Connection refused"), "non-raggiungibile");
});

test("quello che non si sa non si indovina", () => {
  /* Senza una ragione riconosciuta si riporta quello che ha detto Home
   * Assistant: una diagnosi sbagliata manda chi legge dalla parte opposta. */
  assert.equal(ragioneDelRifiuto("Value 90 is not a valid option"), "");
  assert.equal(ragioneDelRifiuto(""), "");
  assert.equal(ragioneDelRifiuto(null), "");
  assert.equal(ragioneDelRifiuto(undefined), "");
});

test("«token» dentro un'altra parola non conta", () => {
  /* Il confine di parola c'è apposta: un'entità che si chiama `tokenizer` non
   * è un problema di autenticazione. */
  assert.equal(ragioneDelRifiuto("sensor.tokenizer refused the value"), "");
});

test("il consiglio si scrive, e la riga di Home Assistant resta in coda", () => {
  /* È quello che serve a chi apre una segnalazione: toglierlo sarebbe
   * nascondere la prova. */
  assert.match(SORGENTE, /function parolePerIlRifiuto\(dettaglio\)/);
  assert.match(SORGENTE, /ragioneDelRifiuto\(dettaglio\)/);
  assert.match(SORGENTE, /return dettaglio \? `\$\{consiglio\} \(\$\{dettaglio\}\)` : consiglio;/);
  assert.match(
    SORGENTE,
    /Impostazioni → Dispositivi e servizi/,
    "il rimedio si dice dov'è, non «riconnetti l'integrazione» e arrangiati",
  );
});
