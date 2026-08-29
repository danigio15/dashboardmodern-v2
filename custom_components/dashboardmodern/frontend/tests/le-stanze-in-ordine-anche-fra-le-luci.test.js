/* L'ordine delle stanze vale anche nella pagina Luci (#228).
 *
 * Chi ordina le stanze in configurazione lo fa per una ragione: e' l'ordine in
 * cui gira per casa. La pagina Luci pero' raggruppava le luci nell'ordine in
 * cui erano state configurate LORO: il bagnetto messo in cima in
 * configurazione stava in fondo fra le luci, e l'ordinamento sembrava non
 * essere servito a niente.
 *
 * La domanda «quale stanza viene prima» ha un padrone solo — `roomOrderRank`,
 * lo stesso della pagina Stanze — e questa prova pretende che la pagina Luci
 * lo ascolti: le stanze configurate escono nel loro ordine, quelle che la
 * configurazione non conosce restano in fondo.
 */
import assert from "node:assert/strict";
import test from "node:test";

function depositoFinto(valori) {
  return {
    getItem: (chiave) => (chiave in valori ? JSON.stringify(valori[chiave]) : null),
    setItem() {},
    removeItem() {},
  };
}

test("le stanze delle luci escono nell'ordine della sezione Stanze", async () => {
  globalThis.localStorage = depositoFinto({
    cd_stanze: [
      /* L'ordine configurato: il Bagnetto per primo, apposta. */
      { id: "room-bagnetto", name: "Bagnetto", order: 0 },
      { id: "room-salone", name: "Salone", order: 1 },
      { id: "room-cucina", name: "Cucina", order: 2 },
    ],
    /* Le luci arrivate in ORDINE INVERSO: e' l'ordine che vinceva prima. */
    cd_luci: {
      "light.cucina": "Cucina",
      "light.salone": "Salone",
      "light.bagnetto": "Bagnetto",
      "light.garage": "Garage",
    },
    cd_luci_rooms: {
      "light.cucina": "room-cucina",
      "light.salone": "room-salone",
      "light.bagnetto": "room-bagnetto",
      /* Il garage non e' una stanza configurata: va in fondo, non in mezzo. */
      "light.garage": "Garage",
    },
  });
  const { configuredLightGroups } = await import("../src/sections/lights-alerts-section.js");
  const stanze = configuredLightGroups().map((gruppo) => gruppo.room);
  assert.deepEqual(stanze, ["Bagnetto", "Salone", "Cucina", "Garage"]);
});
