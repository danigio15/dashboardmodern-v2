/* La plancia si carica dalla versione di adesso, non da quella in cache.
 *
 * «Non c'è nessun errore, l'integrazione portava 1.4.24 ma nella plancia
 * 1.4.23; scaricando manualmente da HACS si è aggiornata.»
 *
 * Gli asset stanno su due prefissi: quello versionato, che porta la firma
 * nell'indirizzo e quindi non si puo' riusare da un aggiornamento all'altro, e
 * quello stabile, che e' la strada di recupero per chi ha in mano una firma
 * che non esiste piu'. Il prefisso stabile e' servito SENZA `Cache-Control`, e
 * senza quell'header un browser non chiede se il file e' cambiato: se lo tiene
 * per giorni.
 *
 * La card della dashboard montava l'intera plancia dal prefisso stabile,
 * ricavandolo dal proprio indirizzo — con scritto accanto che il suo modulo
 * arriva da quello versionato, che era vero prima della #372 e non lo e' piu'.
 * Il pannello nella barra laterale invece si e' sempre caricato da quello
 * versionato. Due strade, due eta': la stessa casa vedeva l'integrazione nuova
 * e la plancia vecchia.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { baseDellaPlancia } from "../src/core/la-base-della-plancia.js";

const leggi = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), "utf8");

const PANNELLI = {
  "dashboardmodern": {
    config: { static_base: "/dashboardmodern-static/nuova", entry_ids: ["abc123"] },
  },
  "dashboardmodern-seconda": {
    config: { static_base: "/dashboardmodern-static/nuova", entry_ids: ["def456"] },
  },
  "lovelace": { config: { mode: "storage" } },
};

test("la base viene dal pannello di questa plancia", () => {
  assert.equal(
    baseDellaPlancia(PANNELLI, "def456", "/ripiego"),
    "/dashboardmodern-static/nuova",
  );
});

test("con due plance si prende quella della propria voce", () => {
  const panels = {
    uno: { config: { static_base: "/base/uno", entry_ids: ["abc123"] } },
    due: { config: { static_base: "/base/due", entry_ids: ["def456"] } },
  };
  assert.equal(baseDellaPlancia(panels, "def456", "/ripiego"), "/base/due");
  assert.equal(baseDellaPlancia(panels, "abc123", "/ripiego"), "/base/uno");
});

test("se il proprio pannello non si vede vale quello di un'altra plancia", () => {
  /* Gli asset sono gli stessi; quello che cambia e' a chi il pannello e' stato
     dato. Meglio la base viva di un'altra che una vecchia propria. */
  const panels = { uno: { config: { static_base: "/base/uno", entry_ids: ["abc123"] } } };
  assert.equal(baseDellaPlancia(panels, "mai-visto", "/ripiego"), "/base/uno");
});

test("senza pannelli nostri resta il ripiego di chi chiama", () => {
  assert.equal(baseDellaPlancia({ lovelace: { config: {} } }, "abc", "/ripiego"), "/ripiego");
  assert.equal(baseDellaPlancia(null, "abc", "/ripiego"), "/ripiego");
  assert.equal(baseDellaPlancia(undefined, "", ""), "");
});

test("un pannello di qualcun altro non detta la base", () => {
  /* Senza l'elenco delle voci non e' nostro: prenderlo per buono vorrebbe dire
     farsi servire i file da un'integrazione qualunque che usasse quel nome. */
  const panels = { altro: { config: { static_base: "/base/altrui" } } };
  assert.equal(baseDellaPlancia(panels, "abc", "/ripiego"), "/ripiego");
});

test("la card non si carica piu' dal proprio indirizzo", () => {
  const card = leggi("dashboard-card.js");
  assert.match(card, /from "\.\/src\/core\/la-base-della-plancia\.js"/);
  assert.match(card, /const staticBase = baseDellaPlancia\(/);
  assert.match(card, /this\._hass\?\.panels/);
  /* `runtimeStaticBase()` resta, ma come RIPIEGO: era lui la prima scelta, ed
     e' da li' che nasceva la plancia vecchia. */
  assert.doesNotMatch(card, /const staticBase = runtimeStaticBase\(\)/);
  /* E il commento che diceva il falso — «il modulo arriva dal prefisso
     versionato» — non c'e' piu': era vero prima della #372. */
  assert.doesNotMatch(card, /loaded from the live versioned static mount/);
});

test("il percorso della card e' stabile, e rimanda alla firma di adesso", () => {
  /* L'indirizzo con cui il frontend chiede la card non porta la firma nel
     percorso — se la portasse, una pagina vecchia in cache chiederebbe una
     firma che non c'e' piu' e l'elemento non verrebbe mai definito (#372).

     Quel percorso, pero', non serve il file: rimanda al prefisso versionato.
     Senza il rimando tutto quello che la card importa — cioe' `src/` intero e
     `legacy/` intero — arriverebbe dal prefisso stabile, che Home Assistant
     serve senza nemmeno un `Cache-Control`: e da li' «l'integrazione portava
     1.4.24 ma la plancia 1.4.23». */
  const integrazione = readFileSync(
    new URL("../../frontend.py", import.meta.url),
    "utf8",
  );
  assert.match(integrazione, /PERCORSO_DELLA_CARD = f"\{STATIC_URL_PATH\}\/\{NOME_DELLA_CARD\}"/);
  assert.match(integrazione, /return f"\{PERCORSO_DELLA_CARD\}\?v=\{asset_version\}"/);
  /* Sul prefisso stabile la card NON si monta come file: ci sarebbero due
     gestori per lo stesso indirizzo, e aiohttp rifiuterebbe il secondo. */
  assert.match(integrazione, /configs\(STATIC_URL_PATH, senza_la_card\(runtime\), False\)/);
  assert.match(integrazione, /"Location": f"\{versionato\}\/\{NOME_DELLA_CARD\}"/);
  assert.match(integrazione, /"Cache-Control": "no-cache"/);
});
