import assert from "node:assert/strict";
import test from "node:test";

import { clearOwnStorage, isOwnStorageKey } from "../src/sections/config-persistence-section.js";

/* La plancia ospitata vive in una cornice `srcdoc`, che eredita l'origine della
 * pagina che la contiene: la sua memoria del browser e' la stessa di Home
 * Assistant. Svuotarla tutta cancellava anche cio' che Home Assistant ci tiene,
 * a cominciare dal tema. */
function memoria(valori) {
  const dati = new Map(Object.entries(valori));
  return {
    get length() {
      return dati.size;
    },
    key: (index) => [...dati.keys()][index] ?? null,
    getItem: (key) => (dati.has(key) ? dati.get(key) : null),
    setItem: (key, value) => dati.set(key, String(value)),
    removeItem: (key) => dati.delete(key),
    clear: () => dati.clear(),
    tutto: () => Object.fromEntries(dati),
  };
}

test("l'azzeramento toglie la configurazione della plancia", () => {
  const storage = memoria({
    cd_stanze: "[]",
    cd_energy_model: "{}",
    dm_dashboard_state: "{}",
    dm_schema_version: "4",
    dashboardmodern_persist_meta: "{}",
  });
  assert.equal(clearOwnStorage(storage), true);
  assert.deepEqual(storage.tutto(), {});
});

test("e non tocca quello che ci tiene Home Assistant", () => {
  const storage = memoria({
    // Il tema scelto: e' questo che spariva, e le altre plance si sbiancavano.
    selectedTheme: '{"dark":true}',
    sidebar: '{"panelOrder":[]}',
    hassTokens: '{"access_token":"x"}',
    "ha-panel-lovelace": "{}",
    cd_luci: "{}",
  });
  clearOwnStorage(storage);
  assert.deepEqual(storage.tutto(), {
    selectedTheme: '{"dark":true}',
    sidebar: '{"panelOrder":[]}',
    hassTokens: '{"access_token":"x"}',
    "ha-panel-lovelace": "{}",
  });
});

test("anche le chiavi di una plancia con un nome suo sono nostre", () => {
  // Con piu' plance le chiavi portano il nome dell'istanza, ma il prefisso
  // resta il nostro.
  const storage = memoria({ "cd_casa-mare_cd_stanze": "[]", selectedTheme: "{}" });
  clearOwnStorage(storage);
  assert.deepEqual(storage.tutto(), { selectedTheme: "{}" });
});

test("si riconosce cosa e' nostro e cosa no", () => {
  for (const key of ["cd_stanze", "dm_dashboard_state", "dashboardmodern_integration_config"])
    assert.equal(isOwnStorageKey(key), true, key);
  for (const key of ["selectedTheme", "sidebar", "hassTokens", "ha-url", "", null])
    assert.equal(isOwnStorageKey(key), false, String(key));
});

test("senza memoria del browser non si finge di aver svuotato", () => {
  assert.equal(clearOwnStorage(null), false);
});

/* La memoria che vede davvero la plancia quando le plance sono piu' d'una:
 * `storage-namespace.js` antepone `cd_<istanza>_` in scrittura e in lettura, ma
 * il giro sulle chiavi restituisce il nome lungo, quello scritto davvero. */
function memoriaConNome(istanza, valori) {
  const vera = memoria(valori);
  const prefisso = `cd_${istanza}_`;
  const mappa = (key) => (/^(cd_|dm_)/.test(String(key)) ? prefisso + key : String(key));
  return {
    get length() {
      return vera.length;
    },
    key: (index) => vera.key(index),
    getItem: (key) => vera.getItem(mappa(key)),
    setItem: (key, value) => vera.setItem(mappa(key), value),
    removeItem: (key) => vera.removeItem(mappa(key)),
    tutto: () => vera.tutto(),
  };
}

test("con il prefisso di istanza si cancella davvero, non si gira a vuoto", () => {
  globalThis.__DASHBOARDMODERN_STORAGE_NS__ = "e2e-desktop-abc";
  try {
    const storage = memoriaConNome("e2e-desktop-abc", {
      "cd_e2e-desktop-abc_cd_stanze": "[]",
      "cd_e2e-desktop-abc_cd_gruppi_extra": "{}",
      "cd_e2e-desktop-abc_dm_dashboard_state": "{}",
      dashboardmodern_persist_meta: "{}",
      selectedTheme: '{"dark":true}',
    });
    assert.equal(clearOwnStorage(storage), true);
    assert.deepEqual(storage.tutto(), { selectedTheme: '{"dark":true}' });
  } finally {
    delete globalThis.__DASHBOARDMODERN_STORAGE_NS__;
  }
});

test("e la configurazione di un'altra plancia resta dov'e'", () => {
  globalThis.__DASHBOARDMODERN_STORAGE_NS__ = "casa-mare";
  try {
    const storage = memoriaConNome("casa-mare", {
      "cd_casa-mare_cd_stanze": "[]",
      "cd_casa-monti_cd_stanze": "[{}]",
    });
    clearOwnStorage(storage);
    assert.deepEqual(storage.tutto(), { "cd_casa-monti_cd_stanze": "[{}]" });
  } finally {
    delete globalThis.__DASHBOARDMODERN_STORAGE_NS__;
  }
});
