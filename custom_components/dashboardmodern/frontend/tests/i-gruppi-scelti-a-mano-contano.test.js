/* Chi ha scelto le sue finestre ha configurato la plancia. Chi non ha scelto no.
 *
 * Una plancia senza niente di configurato tiene spento il ponte dei widget: e'
 * la correzione per cui in una plancia appena creata comparivano gli avvisi —
 * «2 aperte su 30» — sotto il messaggio che diceva il contrario. Ma
 * «configurato» era troppo stretto: chi aggiunge a mano le sue finestre alle
 * Aperture ha configurato eccome, e si trovava la Home muta.
 *
 * Il posto dove finiscono quelle scelte, `cd_gruppi_extra`, non contiene pero'
 * solo scelte: allagamenti e fumo se li scrive il primo avvio guardando cosa
 * c'e' in casa, e `luci` e' una copia di `cd_luci` che si rinfresca da se'.
 * Contarli avrebbe ridato per «configurata» proprio la plancia appena nata —
 * il difetto di partenza, per un'altra strada.
 *
 * Queste prove tengono ferme le due direzioni insieme: senza la prima la Home
 * resta muta a chi ha scelto, senza la seconda torna a parlare a chi non ha
 * scelto niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

const memoria = new Map();
globalThis.localStorage = {
  getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
  setItem: (chiave, valore) => memoria.set(chiave, String(valore)),
  removeItem: (chiave) => memoria.delete(chiave),
};

const { planciaConfigurata } = await import("../src/sections/home-widgets-section.js");

const gruppi = (valore) => memoria.set("cd_gruppi_extra", JSON.stringify(valore));

test("una plancia senza niente resta senza niente", () => {
  memoria.clear();
  assert.equal(planciaConfigurata(), false);
});

test("i gruppi che si scrivono da soli non fanno configurata una plancia nuova", () => {
  memoria.clear();
  // Allagamenti e fumo li segna il rilevamento del primo avvio; `luci` e' la
  // copia di `cd_luci`, che qui e' vuota. Nessuno di questi e' una scelta.
  gruppi({
    allag: ["binary_sensor.perdita_lavatrice"],
    fumo: ["binary_sensor.fumo_cucina"],
    luci: ["light.salone"],
  });
  assert.equal(planciaConfigurata(), false);
});

test("una finestra aggiunta alle Aperture basta a far parlare la Home", () => {
  memoria.clear();
  gruppi({ allag: ["binary_sensor.perdita_lavatrice"], win: ["binary_sensor.finestra_cucina"] });
  assert.equal(planciaConfigurata(), true);
});

test("un gruppo scelto ma vuoto non conta: la scelta e' l'entita', non il nome", () => {
  memoria.clear();
  gruppi({ win: [] });
  assert.equal(planciaConfigurata(), false);
});
