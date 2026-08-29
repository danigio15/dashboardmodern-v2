/* Una stanza cancellata non rinasce con un nome piu' lungo.
 *
 * Segnalato con una schermata: `room-room-room-room-terrazzo`. Il giro era
 * questo. L'assegnazione di una luce porta l'IDENTIFICATIVO della stanza —
 * `room-terrazzo` — non il suo nome. Cancellata la stanza, quell'identificativo
 * non si risolve piu', e chi riadottava la stanza lo prendeva per un nome: ne
 * faceva un identificativo nuovo mettendogli davanti un altro `room-`, e il
 * nome della stanza diventava `room-terrazzo`. Cancella di nuovo, e il prefisso
 * si somma. Ogni giro una parola in piu', per sempre.
 *
 * La prova rifa' il giro tre volte di seguito, che e' esattamente quello che
 * fa chi cancella una stanza tre volte: se il nome cresce, cresce qui.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { stanzaAdottata } from "../src/sections/data-contracts-section.js";

test("un nome vero diventa una stanza con l'identificativo giusto", () => {
  assert.deepEqual(stanzaAdottata("Terrazzo", 1), { id: "room-terrazzo", name: "Terrazzo" });
  assert.deepEqual(stanzaAdottata("Bagno Grande", 1), {
    id: "room-bagno-grande",
    name: "Bagno Grande",
  });
});

test("un identificativo resta quell'identificativo, e non se ne prende un altro", () => {
  assert.deepEqual(stanzaAdottata("room-terrazzo", 1), {
    id: "room-terrazzo",
    name: "Terrazzo",
  });
});

test("cancellare tre volte non allunga niente", () => {
  /* Il giro vero: si adotta, si cancella, l'assegnazione resta con
   * l'identificativo, si riadotta. Tre volte. */
  let addosso = "room-terrazzo";
  for (let giro = 0; giro < 3; giro += 1) {
    const stanza = stanzaAdottata(addosso, 1);
    assert.equal(stanza.id, "room-terrazzo", `giro ${giro + 1}: l'identificativo e' cambiato`);
    assert.equal(stanza.name, "Terrazzo", `giro ${giro + 1}: il nome e' cambiato`);
    addosso = stanza.id;
  }
});

test("l'identificativo diventa un nome che si legge", () => {
  assert.equal(stanzaAdottata("room-bagno-grande", 1).name, "Bagno grande");
  assert.equal(stanzaAdottata("room-sala_da_pranzo", 1).name, "Sala da pranzo");
});

test("i casi vuoti non creano stanze fantasma", () => {
  assert.deepEqual(stanzaAdottata("", 1), { id: "", name: "" });
  assert.deepEqual(stanzaAdottata(null, 1), { id: "", name: "" });
});
