/* I programmi del popup lavatrice, puri.
 *
 * «Dare in config la scelta dei programmi da inserire come tasti»: dalla
 * config se scritta, altrimenti la semina storica per chi ha i quattro
 * script del guscio davvero mappati. Svuotata apposta, resta vuota.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { programmiLavatrice, scriviCasella } from "../src/sections/il-popup-della-lavatrice-section.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/il-popup-della-lavatrice-section.js", import.meta.url),
  "utf8",
);

test("la config scritta comanda, e si normalizza", () => {
  const voci = programmiLavatrice([
    { name: "Eco 40", entity: "script.lavatrice_eco" },
    { name: "", entity: "script.senza_nome" },
    { name: "Senza punto", entity: "nonentita" },
    { name: "Lana", entity: "switch.lana", icon: "🧶" },
  ]);
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Eco 40", "Lana"],
  );
  assert.equal(voci[0].icon, "🧺");
  assert.equal(voci[1].icon, "🧶");
});

test("mai scritta: si seminano solo gli storici mappati davvero", () => {
  const voci = programmiLavatrice(null, {
    "dm.lavatrice_script_programma_30": "script.rapido_30",
  });
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Rapido 30'"],
  );
  assert.deepEqual(programmiLavatrice(null, {}), []);
});

test("svuotata apposta resta vuota", () => {
  assert.deepEqual(programmiLavatrice([]), []);
});

/* «Non si possono configurare le altre cose presenti nel popup»: la carta
 * delle Azioni rapide porta anche le caselle della finestra, e le scrive negli
 * stessi override del guscio — non in un secondo posto tutto suo. */
test("la carta offre tutte le caselle del popup, non i soli programmi", () => {
  for (const ref of [
    "dm.lavatrice_presa_avvio_lavatrice",
    "dm.lavatrice_avvio_ciclo",
    "dm.lavatrice_fase_corrente",
    "dm.lavatrice_tempo_rimanente",
    "dm.lavatrice_programma",
    "dm.lavatrice_temperatura",
    "dm.lavatrice_centrifuga",
    "dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no",
  ])
    assert.ok(SORGENTE.includes(`"${ref}"`), `casella mancante: ${ref}`);
  /* E si scelgono dalla riga, come in tutta la plancia.
   *
   * Qui c'era una lente disegnata dalla carta, che chiamava `wzPickEntity` sul
   * campo. Accanto ne compariva una seconda, messa dalla guardia del selettore:
   * due tasti identici appaiati — «questa funzione e' stata deprecata con la
   * nuova metodologia di ricerca entita' ... si fa direttamente nella riga».
   * La carta non disegna piu' la sua: chiede la stessa decorazione delle
   * Sezioni, che trasforma ogni casella nella riga di scelta. */
  assert.doesNotMatch(SORGENTE, /dm-lav-slot-btn/);
  assert.match(SORGENTE, /decoraCaselleDiUnaCarta\(caselle\)/);
});

test("una casella scritta finisce negli override, una sbagliata no", () => {
  const memoria = new Map([["cd_entity_overrides", JSON.stringify({ "dm.lavatrice_programma": "select.vecchio" })]]);
  const precedente = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
    setItem: (chiave, valore) => memoria.set(chiave, valore),
  };
  try {
    assert.equal(scriviCasella("dm.lavatrice_tempo_rimanente", "sensor.tempo"), true);
    const dati = JSON.parse(memoria.get("cd_entity_overrides"));
    assert.equal(dati["dm.lavatrice_tempo_rimanente"], "sensor.tempo");
    /* Le altre caselle restano dov'erano. */
    assert.equal(dati["dm.lavatrice_programma"], "select.vecchio");
    /* Senza punto non e' un'entita': non si scrive niente. */
    assert.equal(scriviCasella("dm.lavatrice_fase_corrente", "nonentita"), false);
    assert.equal(JSON.parse(memoria.get("cd_entity_overrides"))["dm.lavatrice_fase_corrente"], undefined);
    /* Svuotata, la casella se ne va invece di restare a mezz'aria. */
    assert.equal(scriviCasella("dm.lavatrice_programma", "  "), true);
    assert.equal(JSON.parse(memoria.get("cd_entity_overrides"))["dm.lavatrice_programma"], undefined);
  } finally {
    if (precedente === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = precedente;
  }
});
