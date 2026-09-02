/* «Nel popup vengono mostrate anche aspiratore canna fumaria e pompa
 * termocamino, ma nella sezione clima non e' presente alcun campo per
 * impostarlo: il campo deve essere libero, e se non viene inserito nulla
 * deve scomparire.»
 *
 * Il pannello sotto le stanze del Caldo era tre righe cablate nel guscio —
 * una addirittura su `switch.caldaia`, l'entita' dell'impianto di qualcuno.
 * Le voci ora vivono in `cd_termico_caldo`: qui si prova la logica pura —
 * la config comanda, il vuoto scelto resta vuoto, e la semina storica tocca
 * solo a chi quelle entita' le ha davvero.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { vociTermiche } from "../src/sections/termico-del-caldo-section.js";

test("senza config e senza entita' storiche, nessuna voce: il pannello sparisce", () => {
  assert.deepEqual(vociTermiche(null, {}, {}), []);
});

test("la semina storica tocca solo a chi ha davvero quelle entita'", () => {
  const voci = vociTermiche(
    null,
    { "switch.caldaia": { state: "on" } },
    { "dm.core_053": "switch.pompa_termocamino" },
  );
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Caldaia", "Pompa termocamino"],
  );
  /* L'aspiratore non e' mappato: non si semina. */
});

test("una config svuotata apposta resta vuota, anche con le storiche in casa", () => {
  assert.deepEqual(vociTermiche([], { "switch.caldaia": { state: "on" } }, {}), []);
});

test("la config comanda, e le voci storpie non passano", () => {
  const voci = vociTermiche([
    { name: "Pompa pellet", entity: "switch.pellet", icon: "♨️" },
    { name: "", entity: "switch.senza_nome" },
    { name: "Senza punto", entity: "nondominio" },
  ]);
  assert.deepEqual(voci, [{ name: "Pompa pellet", entity: "switch.pellet", icon: "♨️" }]);
});

test("una voce senza icona prende la fiamma, non il vuoto", () => {
  assert.equal(vociTermiche([{ name: "Caldaia", entity: "switch.c" }])[0].icon, "🔥");
});

/* «La doppia caldaia va inserita la possibilita' di aggiungere piu' caldaie
 * anche nella sezione clima»: la testata del Clima raccontava una caldaia
 * sola, e con due configurate ne mostrava la prima e basta. Le fonti sono
 * due — l'elenco libero dello Stato termico e la Gestione termica di #281 —
 * e nessuna delle due, da sola, e' quello che l'utente ha configurato. */
test("le caldaie si contano tutte, e le due fonti si uniscono", async () => {
  const magazzino = new Map([
    [
      "cd_termico_caldo",
      JSON.stringify([
        { name: "Caldaia zona giorno", entity: "switch.c1" },
        { name: "Pompa termocamino", entity: "switch.pompa" },
      ]),
    ],
  ]);
  const prima = {
    localStorage: globalThis.localStorage,
    cdCfg: globalThis.cdCfg,
    __HASS__: globalThis.__HASS__,
  };
  globalThis.localStorage = { getItem: (chiave) => magazzino.get(chiave) ?? null };
  globalThis.cdCfg = (chiave) =>
    chiave === "cd_caldaia"
      ? [
          { id: "notte", name: "Zona notte", stato: "binary_sensor.c2" },
          /* Una macchina senza casella di stato non ha niente da dire qui. */
          { id: "muta", name: "Senza stato", mandata: "sensor.m" },
        ]
      : null;
  globalThis.__HASS__ = {
    states: {
      "switch.c1": { state: "on", last_changed: new Date().toISOString() },
      "binary_sensor.c2": { state: "off" },
    },
  };
  try {
    const { statiDelleCaldaie, statoCaldaia } = await import(
      "../src/sections/termico-del-caldo-section.js"
    );
    const caldaie = statiDelleCaldaie();
    assert.deepEqual(
      caldaie.map((caldaia) => caldaia.nome),
      ["Caldaia zona giorno", "Zona notte"],
    );
    /* La pompa termocamino non e' una caldaia: il pannello la mostra, la
     * testata del Clima no. */
    assert.equal(caldaie.length, 2);
    assert.equal(caldaie[0].acceso, true);
    assert.equal(caldaie[1].acceso, false);
    /* Chi ne racconta una sola prende la prima, come faceva prima. */
    assert.equal(statoCaldaia().nome, "Caldaia zona giorno");
  } finally {
    for (const [chiave, valore] of Object.entries(prima)) {
      if (valore === undefined) delete globalThis[chiave];
      else globalThis[chiave] = valore;
    }
  }
});

test("la stessa caldaia dichiarata in tutti e due i posti compare una volta", async () => {
  const prima = {
    localStorage: globalThis.localStorage,
    cdCfg: globalThis.cdCfg,
    __HASS__: globalThis.__HASS__,
  };
  globalThis.localStorage = {
    getItem: () => JSON.stringify([{ name: "Caldaia", entity: "switch.unica" }]),
  };
  globalThis.cdCfg = (chiave) =>
    chiave === "cd_caldaia" ? [{ id: "u", name: "Caldaia a gas", stato: "switch.unica" }] : null;
  globalThis.__HASS__ = { states: { "switch.unica": { state: "on" } } };
  try {
    const { statiDelleCaldaie } = await import("../src/sections/termico-del-caldo-section.js");
    const caldaie = statiDelleCaldaie();
    assert.equal(caldaie.length, 1);
    /* Vince il nome di chi e' arrivato prima: l'elenco libero. Comparire due
     * volte nella testata sarebbe peggio che comparire col nome dell'altro. */
    assert.equal(caldaie[0].nome, "Caldaia");
  } finally {
    for (const [chiave, valore] of Object.entries(prima)) {
      if (valore === undefined) delete globalThis[chiave];
      else globalThis[chiave] = valore;
    }
  }
});

test("la testata del Clima fa una casella per macchina", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/climate-thermal-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /statiDelleCaldaie\(\)/);
  /* La casella del guscio non si toglie mai: e' lo stampo delle altre. */
  assert.match(sorgente, /caselle\.splice\(Math\.max\(1, caldaie\.length\)\)/);
});
