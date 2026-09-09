/* Il ponte non deve scoprirsi in casa d'altri.
 *
 * La finestra «Scegli la foto» chiedeva a Home Assistant tre messaggi che
 * nessuno aveva messo nell'elenco dei permessi. Sulla pagina legacy, che il
 * ponte non ce l'ha, funzionava; dentro il pannello di Home Assistant
 * rispondeva «Message type not permitted through the bridge:
 * dashboardmodern/www/list» e non apriva nessuna cartella. L'elenco si
 * scriveva a mano, e la prova che lo controllava era un altro elenco scritto a
 * mano: due copie sbagliate insieme.
 *
 * Questa prova non tiene un elenco. Legge i moduli che girano dentro la
 * cornice e pretende che ogni messaggio che spediscono passi il ponte.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALLOWED_MESSAGE_TYPES } from "../src/legacy/bridge-socket.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/* `src/legacy/` e' il lato ospite: gira nel documento di Home Assistant, con
 * la connessione autenticata in mano, e non attraversa niente. */
const FUORI_DALLA_CORNICE = join(SRC, "legacy");

function moduli(cartella) {
  const elenco = [];
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) {
      if (percorso !== FUORI_DALLA_CORNICE) elenco.push(...moduli(percorso));
    } else if (voce.endsWith(".js")) {
      elenco.push(percorso);
    }
  }
  return elenco;
}

/* Un messaggio per Home Assistant si riconosce dalla barra: `get_states` e
 * `call_service` sono gli unici piatti, e li scrive il runtime vendorizzato. */
const FORMA = "[a-z][a-z0-9_]*\\/[a-z0-9_/]+";
const MESSAGGIO_SCRITTO = new RegExp(`type:\\s*"(${FORMA})"`, "g");

/* Il nome al posto della stringa.
 *
 * Assist scrive `{ type: TIPO_CONVERSAZIONE }`, e TIPO_CONVERSAZIONE vale
 * "conversation/process" venti righe piu' su, in un altro file. La ricerca
 * guardava solo le stringhe scritte li' per li', quindi quel messaggio non lo
 * ha mai visto: il ponte lo negava, e questa prova diceva che andava tutto
 * bene. Dal campo, con la schermata allegata: «impostato conversation gemini e
 * openai ma non funziona, sbaglio io qualcosa?» — e dentro il riquadro rosso
 * c'era la nostra risposta, «Message type not permitted through the bridge:
 * conversation/process».
 *
 * Una prova che non vede meta' di quello che deve guardare e' peggio di
 * nessuna prova: dice di no ai difetti che non sa trovare. Adesso si leggono
 * anche le costanti — `const NOME = "dominio/cosa"` — e chi le usa come `type`
 * conta come chi ci scrive la stringa. */
const COSTANTE = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*"(${FORMA})"`, "g");
const MESSAGGIO_PER_NOME = /type:\s*([A-Z][A-Z0-9_]*)\b/g;

function messaggiSpediti() {
  const testi = new Map();
  for (const percorso of moduli(SRC))
    testi.set(percorso.slice(SRC.length + 1), readFileSync(percorso, "utf8"));

  /* Le costanti di tutti i moduli insieme: chi le usa quasi sempre le importa
   * da un altro file, ed e' proprio quel salto che nascondeva il difetto. */
  const costanti = new Map();
  for (const testo of testi.values())
    for (const [, nome, tipo] of testo.matchAll(COSTANTE)) costanti.set(nome, tipo);

  const trovati = new Map();
  const segna = (tipo, dove) => {
    if (!trovati.has(tipo)) trovati.set(tipo, []);
    if (!trovati.get(tipo).includes(dove)) trovati.get(tipo).push(dove);
  };
  for (const [dove, testo] of testi) {
    for (const [, tipo] of testo.matchAll(MESSAGGIO_SCRITTO)) segna(tipo, dove);
    for (const [, nome] of testo.matchAll(MESSAGGIO_PER_NOME))
      if (costanti.has(nome)) segna(costanti.get(nome), dove);
  }
  return trovati;
}

test("ogni messaggio che la plancia spedisce passa il ponte", () => {
  const spediti = messaggiSpediti();
  assert.ok(spediti.size > 0, "nessun messaggio trovato: la ricerca e' rotta");
  const consentiti = new Set(ALLOWED_MESSAGE_TYPES);
  const negati = [...spediti]
    .filter(([tipo]) => !consentiti.has(tipo))
    .map(([tipo, dove]) => `${tipo} (${dove.join(", ")})`);
  assert.deepEqual(negati, [], `il ponte negherebbe: ${negati.join("; ")}`);
});

test("le cartelle per la foto dell'auto attraversano il ponte", () => {
  for (const tipo of [
    "media_source/browse_media",
    "media_source/resolve_media",
    "dashboardmodern/www/list",
  ]) {
    assert.ok(ALLOWED_MESSAGE_TYPES.includes(tipo), `manca ${tipo}`);
  }
});

test("Assist attraversa il ponte, e la ricerca lo vede anche dietro al suo nome", () => {
  /* Le due meta' dello stesso difetto: il messaggio deve passare, e la prova
   * deve saperlo trovare anche quando nel codice non c'e' la stringa ma la
   * costante che la tiene. */
  assert.ok(ALLOWED_MESSAGE_TYPES.includes("conversation/process"));
  assert.ok(
    messaggiSpediti().has("conversation/process"),
    "la ricerca non vede i messaggi scritti con una costante: e' il buco che ha lasciato passare #360",
  );
});

test("il ponte non si allarga a quello che non serve", () => {
  for (const tipo of [
    "auth/long_lived_access_token",
    "config/auth/create",
    "media_source/upload_media",
    "dashboardmodern/www/write",
  ]) {
    assert.equal(ALLOWED_MESSAGE_TYPES.includes(tipo), false, `di troppo: ${tipo}`);
  }
});
