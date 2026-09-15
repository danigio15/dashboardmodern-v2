/* «Posizione auto da nome non tradotto not_home».
 *
 * Nella finestra della tessera Auto, sotto «RAV4 luogo di parcheggio», c'era
 * scritto `not_home`. Non e' una parola: e' il nome che Home Assistant da' a
 * uno stato, con l'underscore in mezzo, e in una plancia non ci va mai.
 *
 * La tabella che traduce quei nomi esisteva gia' — due volte, quasi uguali, in
 * due sezioni che non sapevano l'una dell'altra — e proprio dove e' saltata
 * fuori la segnalazione non c'era: la riga costruita da una entita' qualunque
 * scriveva lo stato cosi' come arrivava. Tre strade per la stessa domanda, due
 * gia' allontanate. Adesso e' una sola, e queste prove tengono insieme le due
 * cose: che la parola si dica, e che il posto dove si dice resti uno.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.DashboardModernModules = {
  store: { getSection: (nome) => ({ rooms: [{ id: "r1", name: "Camera" }] })[nome] },
};

const { modelliDelleTessere } = await import("../src/sections/home-widgets-section.js");
const { parolaDellaPorta, parolaDiStato, tabellaDegliStati } = await import(
  "../src/sections/le-parole-di-home-assistant.js"
);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const stato = (state, attributes = {}) => ({ state, attributes });

/** La tessera Auto come la disegna il ponte, con questa vettura in casa. */
function tessera(stati, vettura) {
  magazzino.clear();
  magazzino.set("cd_ev_cars", JSON.stringify([vettura]));
  return (modelliDelleTessere(stati) || []).find((widget) => widget?.key === "ev") || null;
}

/* La RAV4 della segnalazione: il livello del serbatoio perche' la vettura
 * esista, e il device_tracker del parcheggio, che e' la riga incriminata. */
const RAV4 = {
  name: "RAV4",
  tipo: "termica",
  ov: {
    "dm.ev_carburante": "sensor.rav4_carburante",
    "dm.ev_posizione": "device_tracker.rav4_luogo_di_parcheggio",
  },
};
const stati = (posizione) => ({
  "sensor.rav4_carburante": stato("64", { unit_of_measurement: "%" }),
  "device_tracker.rav4_luogo_di_parcheggio": stato(posizione, {
    friendly_name: "RAV4 luogo di parcheggio",
  }),
});

const parcheggio = (stati) =>
  (tessera(stati, RAV4)?.rows || []).find(
    (riga) => riga.name === "RAV4 luogo di parcheggio",
  ) || null;

test("l'auto fuori casa non dice «not_home»", () => {
  const riga = parcheggio(stati("not_home"));
  assert.ok(riga, "la riga del parcheggio non c'e'");
  assert.equal(riga.value, "Fuori");
});

test("e quando e' a casa lo dice in italiano", () => {
  assert.equal(parcheggio(stati("home")).value, "In casa");
});

test("il nome di una zona passa intatto: quella parola l'ha scritta qualcuno", () => {
  /* «Lavoro», «Palestra», «Casa dei nonni»: non sono stati di Home Assistant,
   * sono i nomi che uno ha dato alle sue zone. Restano come sono proprio
   * perche' in tabella non ci sono. */
  assert.equal(parcheggio(stati("Lavoro")).value, "Lavoro");
  assert.equal(parcheggio(stati("Casa dei nonni")).value, "Casa dei nonni");
});

test("una parola che nessuno conosce si mostra com'e', non diventa un trattino", () => {
  assert.equal(parolaDiStato("jammed"), "jammed");
  assert.equal(parolaDiStato("  "), "");
  assert.equal(parolaDiStato(null), "");
  assert.equal(parolaDiStato(undefined), "");
});

test("le maiuscole non contano: «Not_Home» e' lo stesso stato", () => {
  assert.equal(parolaDiStato("Not_Home"), "Fuori");
  assert.equal(parolaDiStato("DOCKED"), "Alla base");
});

test("la tabella si ricostruisce a ogni chiamata, non si congela alla prima", () => {
  /* Le parole dipendono dalla lingua attiva: una tabella calcolata una volta
   * sola resterebbe nella lingua del primo caricamento anche dopo averla
   * cambiata. Due chiamate devono dare due oggetti. */
  assert.notEqual(tabellaDegliStati(), tabellaDegliStati());
  assert.deepEqual(tabellaDegliStati(), tabellaDegliStati());
});

test("una serratura non dice «Aperto», che e' la parola di un'altra cosa", () => {
  /* Nella tabella di prima `unlocked` era «Aperto» — la stessa parola di
   * `open`. Due stati diversi con lo stesso nome: chi legge non sa se la porta
   * e' spalancata o solo senza chiave, e nelle altre lingue quella parola
   * italiana non sapeva piu' quale delle due chiavi inglesi fosse la sua. */
  assert.equal(parolaDiStato("unlocked"), "Sbloccato");
  assert.equal(parolaDiStato("open"), "Aperto");
  assert.notEqual(parolaDiStato("unlocked"), parolaDiStato("open"));
});

/* ── le porte, che sono femmine ─────────────────────────────────────────── */

test("sotto il nome di una porta le parole sono al femminile", () => {
  assert.equal(parolaDellaPorta("locked"), "Chiusa a chiave");
  assert.equal(parolaDellaPorta("unlocked"), "Sbloccata");
  assert.equal(parolaDellaPorta("open"), "Aperta");
  assert.equal(parolaDellaPorta("opening"), "In apertura");
  assert.equal(parolaDellaPorta("closing"), "In chiusura");
  assert.equal(parolaDellaPorta("closed"), "Chiusa");
});

test("una porta che dice qualcosa di sconosciuto non scrive niente", () => {
  /* Vuoto e non lo stato grezzo: chi chiama ha gia' la sua frase di ripiego —
   * la sezione invita a toccare, la tessera lascia la riga senza sottotitolo —
   * e un `jammed` crudo sotto il nome di una porta sarebbe peggio del bianco. */
  assert.equal(parolaDellaPorta("jammed"), "");
  assert.equal(parolaDellaPorta(""), "");
  assert.equal(parolaDellaPorta(null), "");
});

test("la sezione Porte e la sua tessera dicono le stesse parole", () => {
  /* Erano due elenchi identici scritti a mano in due file, e gia' non lo erano
   * piu' del tutto: la sezione conosceva «In apertura», «In chiusura» e
   * «Chiusa», la tessera si fermava a tre stati e per gli altri lasciava il
   * sottotitolo vuoto. Stessa porta, due racconti. */
  const sezione = leggi("sections/security-doors-section.js");
  const tessera = leggi("sections/home-widgets-section.js");
  for (const [dove, testo] of [
    ["la sezione Porte", sezione],
    ["la tessera Porte", tessera],
  ]) {
    assert.match(
      testo,
      /import \{[^}]*parolaDellaPorta[^}]*\} from "\.\/le-parole-di-home-assistant\.js";/,
      `${dove} non prende le parole dal modulo`,
    );
    assert.doesNotMatch(testo, /t\("Chiusa a chiave", "Locked"\)/, `${dove} si riscrive la tabella`);
  }
  assert.match(sezione, /return parolaDellaPorta\(raw\) \|\| t\("Tocca per aprire", "Tap to open"\);/);
  assert.match(tessera, /const label = parolaDellaPorta\(raw\);/);
});

test("la tabella delle parole sta in un posto solo", () => {
  /* Erano due elenchi per la stessa domanda, e si erano gia' allontanati: uno
   * conosceva la base del robot, la carica, il caldo e il freddo, l'altro no.
   * Un terzo posto che se la riscrive e' il modo di farli allontanare di
   * nuovo. */
  const parole = leggi("sections/le-parole-di-home-assistant.js");
  assert.match(parole, /not_home: t\("Fuori", "Away"\)/);
  for (const dove of [
    "sections/entita-mie-section.js",
    "sections/sezioni-mie-section.js",
    "sections/home-widgets-section.js",
  ]) {
    const testo = leggi(dove);
    assert.match(
      testo,
      /import \{[^}]*parolaDiStato[^}]*\} from "\.\/le-parole-di-home-assistant\.js";/,
      `${dove} non prende le parole dal modulo`,
    );
    assert.doesNotMatch(testo, /not_home: t\(/, `${dove} si riscrive la tabella`);
  }
  /* E la riga costruita da una entita' qualunque — quella della segnalazione —
   * ci passa davvero: senza questa chiamata le prove qui sopra girerebbero a
   * vuoto il giorno che qualcuno la togliesse. */
  assert.match(
    leggi("sections/home-widgets-section.js"),
    /return \{ glyph: glifo, name: nome, value: parolaDiStato\(grezzo\) \};/,
  );
});

/* Sta in `sections` e non nel nucleo per una ragione meccanica: il
 * raccoglitore delle traduzioni legge le `t()` solo da `src/sections`, e una
 * scritta dentro `src/core` non finirebbe nei tredici cataloghi. */
test("le parole stanno dove il raccoglitore delle traduzioni le vede", () => {
  const raccoglitore = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "scripts", "extract-i18n-keys.mjs"),
    "utf8",
  );
  assert.match(raccoglitore, /sections/);
});
