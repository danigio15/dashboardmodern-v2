/*
 * La finestra delle segnalazioni: il contratto verso il backend e verso il
 * ponte, e il trattamento del testo che l'utente scrive.
 *
 * Quello che si prova qui non e' il disegno — quello lo prova un browser vero
 * — ma le tre cose che in un browser vero si scoprirebbero tardi e male: un
 * tipo di messaggio non ammesso dal ponte, una chiave di diagnostica che
 * nessuno ha dichiarato, e un titolo che si porta dentro del markup.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";
import {
  DIAGNOSTIC_KEYS,
  WS_TYPES,
  voceMarkup,
} from "../src/sections/segnalazioni-section.js";

test("ogni messaggio che la finestra manda passa dal ponte", () => {
  /* Un tipo non elencato nel ponte non arriva a Home Assistant: la finestra
   * risponderebbe «Message type not permitted through the bridge», e la
   * segnalazione morirebbe fra il browser e il backend. */
  for (const tipo of WS_TYPES) {
    assert.ok(
      ALLOWED_MESSAGE_TYPES.includes(tipo),
      `${tipo} non e' nell'allowlist del ponte`,
    );
  }
});

test("i nove comandi sono quelli che il backend registra", () => {
  assert.deepEqual([...WS_TYPES].sort(), [
    "dashboardmodern/tickets/answer",
    "dashboardmodern/tickets/auth/forget",
    "dashboardmodern/tickets/auth/poll",
    "dashboardmodern/tickets/auth/start",
    "dashboardmodern/tickets/create",
    "dashboardmodern/tickets/delete",
    "dashboardmodern/tickets/list",
    "dashboardmodern/tickets/queue",
    "dashboardmodern/tickets/sync",
  ]);
});

test("il gettone GitHub non compare fra le cose che la finestra manda", () => {
  /* La finestra chiede «apri una segnalazione», non «apri una segnalazione
   * con questo gettone»: il gettone sta nel deposito del backend e da li' non
   * esce. Se un giorno comparisse un comando che lo porta, si vede qui. */
  for (const tipo of WS_TYPES) {
    assert.ok(
      !/token|gettone|secret/i.test(tipo),
      `${tipo} suona come un comando che porta un segreto`,
    );
  }
});

test("la diagnostica che la finestra puo' mandare e' una lista chiusa", () => {
  /* Le chiavi devono stare dentro quelle che il backend dichiara in
   * ticket_store.DIAGNOSTIC_KEYS. Qui ce ne sono cinque su sei: il metodo di
   * installazione il browser non lo sa, e non si inventa. */
  assert.deepEqual(
    [...DIAGNOSTIC_KEYS].sort(),
    ["ha_version", "integration_version", "locale", "panel_section", "user_agent"],
  );
});

test("nessuna chiave della diagnostica somiglia a un dato di casa", () => {
  /* Non una prova di stile: e' la lista che decide cosa esce di casa, e va
   * riletta ogni volta che qualcuno la allarga. */
  const vietate = ["url", "token", "password", "entity", "entities", "latitude"];
  for (const chiave of DIAGNOSTIC_KEYS) {
    for (const vietata of vietate) {
      assert.ok(
        !chiave.includes(vietata),
        `${chiave} somiglia troppo a ${vietata}: e' roba che non deve uscire`,
      );
    }
  }
});

function ticket(overrides = {}) {
  return {
    id: "abc",
    type: "bug",
    title: "Le tapparelle non si fermano",
    body: "Premo stop e continuano a scendere.",
    state: "inviato",
    created_at: Date.parse("2026-09-01T10:00:00Z"),
    reply: "",
    issue_url: "",
    delivery_error: "",
    ...overrides,
  };
}

test("il titolo dell'utente non diventa markup", () => {
  const markup = voceMarkup(
    ticket({ title: '<img src=x onerror="alert(1)">', body: "<b>grassetto</b>" }),
  );
  assert.ok(!markup.includes("<img"), "il tag e' arrivato intero nel markup");
  assert.ok(!markup.includes("<b>"), "il tag nel corpo e' arrivato intero");
  assert.ok(markup.includes("&lt;img"), "il tag doveva essere neutralizzato");
});

test("la risposta del manutentore non diventa markup", () => {
  const markup = voceMarkup(ticket({ reply: "<script>rubo()</script>" }));
  assert.ok(!markup.includes("<script>"));
  assert.ok(markup.includes("&lt;script"));
});

test("una segnalazione senza risposta non disegna il riquadro della risposta", () => {
  assert.ok(!voceMarkup(ticket()).includes("dm-tkt-risposta"));
  assert.ok(voceMarkup(ticket({ reply: "Riprodotta." })).includes("dm-tkt-risposta"));
});

test("il link alla discussione compare solo quando c'e'", () => {
  assert.ok(!voceMarkup(ticket()).includes("dm-tkt-link"));
  const promossa = voceMarkup(
    ticket({ issue_url: "https://github.com/danigio15/dashboardmodern-v2/issues/9" }),
  );
  assert.ok(promossa.includes("dm-tkt-link"));
  /* Un link che si apre altrove non deve poter toccare la finestra che lo ha
   * aperto. */
  assert.ok(promossa.includes('rel="noreferrer noopener"'));
});

test("la consegna fallita si legge sulla segnalazione", () => {
  const markup = voceMarkup(
    ticket({ state: "bozza", delivery_error: "Servizio non raggiungibile." }),
  );
  assert.ok(markup.includes("Servizio non raggiungibile."));
  assert.ok(markup.includes('data-stato="bozza"'));
});

test("ogni stato ha una sua etichetta", () => {
  for (const stato of ["bozza", "inviato", "in-carico", "risolto", "chiuso"]) {
    const markup = voceMarkup(ticket({ state: stato }));
    assert.ok(markup.includes(`data-stato="${stato}"`), `manca l'etichetta di ${stato}`);
  }
});
