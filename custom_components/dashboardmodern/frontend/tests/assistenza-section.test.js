/* La chat di assistenza: il contratto verso il backend e verso il ponte, e le
 * cose che dal browser non si vedono finche' non e' tardi.
 *
 * Quello che si prova qui non e' il disegno — quello lo prova un browser vero
 * — ma le cose che in casa d'altri si scoprirebbero male: un tipo di messaggio
 * non ammesso dal ponte, un modulo che nessuno importa e che quindi non si
 * carica mai, il patto sulla riservatezza che sparisce da sotto la casella
 * dove si sta per raccontare un guaio di casa propria, una bolla dalla parte
 * sbagliata quando a leggere e' chi risponde, e una finestra che resta ferma
 * mentre dall'altro capo qualcuno ha gia' risposto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";
import {
  MAX_TESTO,
  WS_TYPES,
  avvertenzaMarkup,
  codaMarkup,
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

test("gli otto comandi sono quelli che il backend registra", async () => {
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
  assert.equal(WS_TYPES.length, 8);
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

test("ogni conversazione della coda si può buttare via", () => {
  /* Una coda dove non si butta via niente si riempie di prove, di domande già
   * risolte e di righe aperte per sbaglio, finché quella vera non si trova
   * più. Il cestino deve stare su ogni riga, non solo sulla prima. */
  const coda = codaMarkup([
    { id: `casa_${"a".repeat(32)}`, nome: "Giovanni", ultimo: "test" },
    { id: `casa_${"b".repeat(32)}`, ultimo: "un'altra" },
  ]);
  const cestini = coda.match(/data-dm-chat-butta="casa_/g) || [];
  assert.equal(cestini.length, 2);
});

test("il tasto che apre e il cestino non sono uno dentro l'altro", () => {
  /* Un <button> dentro un <button> non è markup valido: il browser lo srotola,
   * e il cestino finisce fuori dalla riga — dove non lo trova nessuno. */
  const coda = codaMarkup([{ id: `casa_${"c".repeat(32)}`, ultimo: "ciao" }]);
  const apre = coda.indexOf("dm-chat-voce-apri");
  const chiude = coda.indexOf("</button>", apre);
  const cestino = coda.indexOf("data-dm-chat-butta");
  assert.ok(apre > -1 && cestino > -1);
  assert.ok(chiude < cestino, "il cestino sta dentro il tasto che apre la riga");
});

test("il cestino chiede conferma prima di cancellare", () => {
  /* Una conversazione cancellata non si rimette a posto: sparisce dal
   * centralino e dalla plancia di quella casa. In un elenco dove si scorre col
   * dito, un cestino che cancella al primo tocco butta via prima o poi la
   * conversazione sbagliata. */
  const sorgente = readFileSync(
    new URL("../src/sections/assistenza-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /state\.daButtare !== nome/);
  assert.match(sorgente, /Confermi\?/);
  /* E un cestino armato non sopravvive alla finestra: riaprirla e trovare
   * «Confermi?» gia' acceso vorrebbe dire che il primo tocco cancella. */
  assert.match(sorgente, /state\.daButtare = "";\s*modale\.classList\.add\("show"\)/);
  assert.match(
    sorgente,
    /export function chiudi\(\) \{\s*spegniIlGiro\(\);\s*state\.daButtare = "";/,
  );
});

test("il nome di una casa non si porta dentro del markup nemmeno in coda", () => {
  /* Il nome lo scrive un'altra casa: quello che una casa scrive non deve poter
   * disegnare niente nella plancia di chi risponde. */
  const coda = codaMarkup([
    {
      id: `casa_${"d".repeat(32)}`,
      nome: '<img src=x onerror="alert(1)">',
      ultimo: "<script>",
    },
  ]);
  assert.ok(!coda.includes("<img"), "il nome è passato intero");
  assert.ok(!coda.includes("<script>"), "l'ultima frase è passata intera");
});

test("nella coda di chi risponde le bolle stanno dalla parte giusta", () => {
  /* «Mio» dipende da chi guarda, e questa finestra la guardano in due. Nella
   * coda le domande della casa comparivano a destra e in verde — come se se le
   * fosse scritte da solo chi stava leggendo — e le proprie risposte a
   * sinistra: una conversazione letta al contrario. */
  const domanda = { da: "casa", testo: "non mi si vede la temperatura" };
  const risposta = { da: "console", testo: "guarda nella scheda Stanze" };
  assert.match(messaggioMarkup(domanda), /dm-chat-riga mia/);
  assert.match(messaggioMarkup(risposta), /dm-chat-riga sua/);
  assert.match(messaggioMarkup(domanda, true), /dm-chat-riga sua/);
  assert.match(messaggioMarkup(risposta, true), /dm-chat-riga mia/);
});

test("il filo di chi risponde passa il verso a ogni bolla", () => {
  const filo = filoMarkup(
    [
      { da: "casa", testo: "una domanda" },
      { da: "console", testo: "una risposta" },
    ],
    true,
  );
  assert.equal((filo.match(/dm-chat-riga sua/g) || []).length, 1);
  assert.equal((filo.match(/dm-chat-riga mia/g) || []).length, 1);
  assert.ok(filo.indexOf("dm-chat-riga sua") < filo.indexOf("dm-chat-riga mia"));
});

test("la finestra aperta si aggiorna da sola, e chiusa non chiede niente", () => {
  /* «La risposta non si refresh, devo uscire e rientrare»: la finestra leggeva
   * una volta all'apertura e poi restava ferma. Il giro dei cinque minuti del
   * backend serve al campanello, non a ridisegnare — e cinque minuti davanti a
   * una chat aperta sono un'eternità. */
  const sorgente = readFileSync(
    new URL("../src/sections/assistenza-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /const RINFRESCO = \d+;/);
  const quanto = Number(/const RINFRESCO = (\d+);/.exec(sorgente)?.[1]);
  assert.ok(quanto >= 5000 && quanto <= 60000, `${quanto} non è un ritmo da chat`);
  /* Aprire accende il giro, chiudere lo spegne: una plancia accesa tutto il
   * giorno in cucina non deve bussare al centralino per una conversazione che
   * nessuno sta guardando. */
  assert.match(sorgente, /modale\.classList\.add\("show"\);[\s\S]{0,120}accendiIlGiro\(\)/);
  assert.match(sorgente, /export function chiudi\(\) \{\s*spegniIlGiro\(\);/);
});

test("un giro che non trova niente di nuovo non ridisegna", () => {
  /* Ridisegnare rifà la casella: farlo quattro volte al minuto mentre qualcuno
   * scrive è il modo di rendere la finestra inusabile. */
  const sorgente = readFileSync(
    new URL("../src/sections/assistenza-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /segno\(righe\) === segno\(state\.filo\)/);
  assert.match(sorgente, /segno\(righe\) === segno\(state\.messages\)/);
  /* E se ridisegna, il cursore torna dov'era. */
  assert.match(sorgente, /setSelectionRange\(dovEro\.da, dovEro\.a\)/);
});

test("la pagina nascosta ferma il giro", () => {
  /* Leggere la propria conversazione vuol dire averla letta, e il segnalibro si
   * sposta. Una finestra dimenticata aperta in una scheda in fondo si mangiava
   * le risposte — le metteva in copia, le segnava lette — e il giro dei cinque
   * minuti che deve suonare la campanella trovava che non era arrivato niente
   * di nuovo. La risposta c'era, e nessuno lo sapeva. */
  const sorgente = readFileSync(
    new URL("../src/sections/assistenza-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /if \(doc\?\.hidden\) return;/);
});

test("una risposta che arriva tardi non finisce sotto il nome sbagliato", () => {
  /* Fra la domanda e la risposta ci sta un dito che apre un'altra
   * conversazione: senza un appunto di dov'era partita, il filo di una casa
   * finisce sotto il nome di un'altra. E due giri sovrapposti li vince quello
   * che torna per ultimo, che non è detto sia il più recente. */
  const sorgente = readFileSync(
    new URL("../src/sections/assistenza-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /const stessoPosto = \(\) =>/);
  assert.match(sorgente, /if \(!stessoPosto\(\)/);
  assert.match(sorgente, /if \(state\.busy \|\| inVolo \|\| !state\.enabled\) return;/);
});
