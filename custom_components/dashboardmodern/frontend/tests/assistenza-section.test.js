/* La chat di assistenza: il contratto verso il backend e verso il ponte, e le
 * due cose che dal browser non si vedono finche' non e' tardi.
 *
 * Quello che si prova qui non e' il disegno — quello lo prova un browser vero
 * — ma tre cose che in casa d'altri si scoprirebbero male: un tipo di
 * messaggio non ammesso dal ponte, un modulo che nessuno importa e che quindi
 * non si carica mai, e il patto sulla riservatezza che sparisce da sotto la
 * casella dove si sta per raccontare un guaio di casa propria.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";
import {
  MAX_TESTO,
  WS_TYPES,
  avvertenzaMarkup,
  filoMarkup,
  messaggioMarkup,
  quando,
} from "../src/sections/assistenza-section.js";

test("ogni messaggio che la chat manda passa dal ponte", () => {
  /* Un tipo non elencato nel ponte non arriva a Home Assistant: la finestra
   * risponderebbe «Message type not permitted through the bridge», e il
   * messaggio morirebbe fra il browser e il backend. */
  for (const tipo of WS_TYPES) {
    assert.ok(
      ALLOWED_MESSAGE_TYPES.includes(tipo),
      `${tipo} non è nell'allowlist del ponte`,
    );
  }
});

test("i sette comandi sono quelli che il backend registra", async () => {
  const backend = await readFile(
    new URL("../../websocket_api.py", import.meta.url),
    "utf8",
  );
  for (const tipo of WS_TYPES) {
    const coda = tipo.replace("dashboardmodern/", "");
    assert.ok(
      backend.includes(`f"{DOMAIN}/${coda}"`),
      `${tipo} non è registrato dal backend`,
    );
  }
  assert.equal(WS_TYPES.length, 7);
});

test("nessun comando della chat porta un segreto", () => {
  /* Il segreto della casa e la chiave della console stanno nel backend: di qui
   * passa «manda questo messaggio», non «manda questo messaggio con questa
   * chiave». Se un giorno comparisse un comando che la porta, si vede qui. */
  for (const tipo of WS_TYPES) {
    assert.ok(
      !/token|gettone|secret|segreto|key|chiave/i.test(tipo),
      `${tipo} suona come un comando che porta un segreto`,
    );
  }
});

test("il modulo della chat è dentro il grafo di produzione", async () => {
  /* La lezione del cruscotto della beta.10: una funzione scritta, esportata e
   * mai chiamata da nessuno, che nelle fotografie della galleria c'era e in una
   * casa vera non è mai comparsa. Un modulo che nessuno importa è la stessa
   * cosa un piano più in alto — si carica solo nelle prove, e nella plancia
   * vera non esiste. Qui si pretende l'arco che lo tiene attaccato. */
  const entry = await readFile(
    new URL("../legacy/modules-entry.js", import.meta.url),
    "utf8",
  );
  assert.ok(
    entry.includes("assistenza-section.js"),
    "modules-entry non importa la chat: nella plancia vera non si caricherebbe",
  );
  const guscio = await readFile(
    new URL("../legacy/dashboard.html", import.meta.url),
    "utf8",
  );
  assert.ok(
    guscio.includes("src/sections/assistenza-section.js"),
    "il guscio non chiede la chat in anticipo",
  );
});

test("il patto si legge prima della prima riga, non dopo", () => {
  /* Chi sta per raccontare un guaio di casa propria ha diritto di sapere dove
   * finisce quello che scrive PRIMA di scriverlo. Le tre promesse che il patto
   * fa sono le tre che il centralino mantiene davvero. */
  const patto = avvertenzaMarkup();
  assert.match(patto, /GitHub/);
  assert.match(patto, /pubblic/i);
  assert.match(patto, /cancellare/i);
});

test("una conversazione vuota invita a scrivere, non resta bianca", () => {
  /* Una chat vuota e una chat rotta si somigliano troppo. */
  const vuoto = filoMarkup([]);
  assert.match(vuoto, /dm-chat-vuoto/);
  assert.ok(vuoto.trim().length > 40);
});

test("il messaggio di chi risponde sta dall'altra parte di quello mio", () => {
  const mio = messaggioMarkup({ da: "casa", testo: "aiuto" });
  const suo = messaggioMarkup({ da: "console", testo: "eccomi" });
  assert.match(mio, /dm-chat-riga mia/);
  assert.match(suo, /dm-chat-riga sua/);
});

test("il testo di un messaggio non si porta dentro del markup", () => {
  /* Le parole arrivano dal centralino, cioè da un'altra casa: quello che una
   * casa scrive non deve poter disegnare niente nella plancia di un'altra. */
  const cattivo = messaggioMarkup({
    da: "console",
    testo: '<img src=x onerror="alert(1)">',
  });
  assert.ok(!cattivo.includes("<img"), "il markup è passato intero");
  assert.match(cattivo, /&lt;img/);
});

test("l'ora di oggi è breve, quella di ieri porta la data", () => {
  const adesso = Date.now();
  assert.ok(!quando(adesso).includes("/"), "l'ora di oggi porta anche la data");
  const laltroieri = adesso - 3 * 24 * 60 * 60 * 1000;
  assert.match(quando(laltroieri), /\d/);
  assert.notEqual(quando(laltroieri), quando(adesso));
  assert.equal(quando(0), "");
});

test("il tetto del messaggio è lo stesso del backend e del centralino", async () => {
  /* Tre numeri uguali in tre posti diversi: se uno scivola, chi scrive vede
   * accettare un muro di testo e riceverne indietro metà. */
  const backend = await readFile(new URL("../../const.py", import.meta.url), "utf8");
  assert.match(backend, new RegExp(`CHAT_MAX_TESTO = ${MAX_TESTO}\\b`));
  const centralino = await readFile(
    new URL("../../../../centralino/src/index.js", import.meta.url),
    "utf8",
  );
  assert.match(centralino, new RegExp(`testo: ${MAX_TESTO},`));
});
