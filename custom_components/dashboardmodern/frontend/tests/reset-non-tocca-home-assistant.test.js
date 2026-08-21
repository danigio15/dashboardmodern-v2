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
