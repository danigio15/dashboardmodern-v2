/* «È sparito il settaggio per la lingua della dashboard» (#350).
 *
 * «Su PC avevo settato italiano (HA in inglese) e continua a funzionare, da
 *  mobile invece è rimasto inglese.»
 *
 * La tendina non era sparita: la scelta non viaggiava. Stava sotto
 * `dashboardmodern_locale`, una chiave che non comincia per `cd_` — quindi
 * fuori dalla configurazione condivisa, che è quella che porta la plancia da
 * un dispositivo all'altro, e fuori anche dal prefisso che tiene separate due
 * plance sulla stessa casa. Una preferenza del browser, mentre la nota accanto
 * alla tendina dice «la fissa per questa dashboard».
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCALE_LEGACY_KEY,
  LOCALE_STORAGE_KEY,
  detectLocale,
  readStoredLocale,
  resetLocale,
  setLocale,
} from "../src/core/i18n.js";

/* Una memoria finta: in Node non c'e' localStorage, e questa prova parla
 * proprio di dove la scelta viene scritta. */
function memoria(iniziale = {}) {
  const dati = new Map(Object.entries(iniziale));
  return {
    dati,
    getItem: (chiave) => (dati.has(chiave) ? dati.get(chiave) : null),
    setItem: (chiave, valore) => dati.set(chiave, String(valore)),
    removeItem: (chiave) => dati.delete(chiave),
  };
}

test("la lingua sta in una chiave della plancia, non del browser", () => {
  /* Il prefisso `cd_` e' quello che la fa viaggiare con la configurazione e
   * che la separa fra due plance della stessa casa. */
  assert.equal(LOCALE_STORAGE_KEY, "cd_lingua");
  assert.equal(LOCALE_LEGACY_KEY, "dashboardmodern_locale");
});

test("la scelta viaggia con la configurazione condivisa", async () => {
  const { CONFIG_KEYS } = await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes("cd_lingua"), "senza questa riga la scelta resta a terra");
});

test("chi l'aveva scelta prima se la ritrova, travasata una volta sola", () => {
  const store = memoria({ [LOCALE_LEGACY_KEY]: "it" });
  globalThis.localStorage = store;
  try {
    assert.equal(readStoredLocale(), "it");
    /* Travasata: da adesso in poi viaggia. */
    assert.equal(store.getItem(LOCALE_STORAGE_KEY), "it");
    /* E la vecchia se ne va, cosi' non restano due posti a dire la lingua. */
    assert.equal(store.getItem(LOCALE_LEGACY_KEY), null);
    /* La seconda lettura non tocca piu' niente. */
    assert.equal(readStoredLocale(), "it");
  } finally {
    delete globalThis.localStorage;
  }
});

test("la chiave nuova vince su quella vecchia rimasta indietro", () => {
  globalThis.localStorage = memoria({ [LOCALE_STORAGE_KEY]: "fr", [LOCALE_LEGACY_KEY]: "it" });
  try {
    assert.equal(readStoredLocale(), "fr");
  } finally {
    delete globalThis.localStorage;
  }
});

test("senza niente scritto non si inventa una scelta", () => {
  globalThis.localStorage = memoria();
  try {
    assert.equal(readStoredLocale(), "");
  } finally {
    delete globalThis.localStorage;
  }
});

test("scegliere una lingua la scrive dove viaggia", async () => {
  const store = memoria({ [LOCALE_LEGACY_KEY]: "it" });
  globalThis.localStorage = store;
  try {
    await setLocale("en");
    assert.equal(store.getItem(LOCALE_STORAGE_KEY), "en");
    assert.equal(store.getItem(LOCALE_LEGACY_KEY), null);
  } finally {
    resetLocale();
    delete globalThis.localStorage;
  }
});

/* «Su PC italiano, da mobile inglese»: il telefono che riceve la
 * configurazione della casa legge la scelta e la applica, invece di seguire
 * Home Assistant come se nessuno avesse scelto niente. */
test("il dispositivo che riceve la configurazione parla la lingua scelta", () => {
  globalThis.localStorage = memoria({ [LOCALE_STORAGE_KEY]: "it" });
  try {
    resetLocale();
    assert.equal(detectLocale(), "it");
  } finally {
    resetLocale();
    delete globalThis.localStorage;
  }
});
