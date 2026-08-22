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
const MESSAGGIO = /type:\s*"([a-z][a-z0-9_]*\/[a-z0-9_/]+)"/g;

function messaggiSpediti() {
  const trovati = new Map();
  for (const percorso of moduli(SRC)) {
    const testo = readFileSync(percorso, "utf8");
    for (const [, tipo] of testo.matchAll(MESSAGGIO)) {
      if (!trovati.has(tipo)) trovati.set(tipo, []);
      trovati.get(tipo).push(percorso.slice(SRC.length + 1));
    }
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
