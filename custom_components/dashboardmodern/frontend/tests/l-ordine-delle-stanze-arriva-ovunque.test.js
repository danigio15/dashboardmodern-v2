/* Le frecce spostano la riga, e l'ordine nuovo arriva a tutte le pagine.
 *
 * Il difetto aveva una forma che si vedeva senza capirla: nella scheda Stanze
 * l'ordine cambiava — la scheda l'elenco lo legge davvero — e nelle pagine che
 * raggruppano per stanza restava quello di prima. Chi aveva messo l'Ingresso
 * per primo continuava a vedere il Soggiorno in cima alle tapparelle.
 *
 * Il motivo: il modello canonico porta su ogni stanza un campo `order`, e
 * `migrateRooms` se lo tiene quando lo trova gia' scritto. Quel numero nasce
 * alla prima migrazione e vale la posizione di ALLORA; le frecce riscrivevano
 * l'elenco e non lo toccavano. Due padroni dello stesso ordine, e vinceva
 * quello vecchio.
 *
 * Qui si prova la catena intera: le frecce scrivono, il modello canonico
 * conserva, e chi ordina le pagine legge la stessa cosa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { migrateRooms } from "../src/core/migrations.js";
import { roomOrderRank } from "../src/core/room-overview.js";

/* La casa di chi l'ha segnalato: Casa creata per prima, poi Soggiorno, poi
 * Cucina, poi Ingresso — e l'ordine voluto e' Casa, Ingresso, Soggiorno,
 * Cucina. La stanza Casa non ha finestre, quindi fra le tapparelle la prima
 * deve essere l'Ingresso. */
const APPENA_CREATE = [
  { name: "Casa", order: 0 },
  { name: "Soggiorno", order: 1 },
  { name: "Cucina", order: 2 },
  { name: "Ingresso", order: 3 },
];

/** Quello che le frecce lasciano scritto: elenco spostato e numeri rifatti. */
function numerate(elenco) {
  return elenco.map((stanza, posizione) =>
    Number(stanza?.order) === posizione ? stanza : { ...stanza, order: posizione },
  );
}

function ordinePagina(stanze, nomi) {
  const rango = roomOrderRank(stanze);
  return nomi.slice().sort((sinistra, destra) => rango(sinistra) - rango(destra));
}

test("spostare una stanza in cima la porta in cima anche nelle pagine", () => {
  const spostato = numerate([
    APPENA_CREATE[0],
    APPENA_CREATE[3],
    APPENA_CREATE[1],
    APPENA_CREATE[2],
  ]);
  const canoniche = migrateRooms(spostato);
  assert.deepEqual(
    canoniche.map((stanza) => stanza.name),
    ["Casa", "Ingresso", "Soggiorno", "Cucina"],
  );
  /* Il campo `order` sopravvive alla migrazione: e' lui che le pagine leggono. */
  assert.deepEqual(
    canoniche.map((stanza) => stanza.order),
    [0, 1, 2, 3],
  );
  /* La stanza Casa non ha tapparelle: fra quelle che ne hanno, prima l'Ingresso. */
  assert.deepEqual(ordinePagina(canoniche, ["Soggiorno", "Cucina", "Ingresso"]), [
    "Ingresso",
    "Soggiorno",
    "Cucina",
  ]);
});

test("senza rinumerare, l'ordine nuovo non arriva da nessuna parte", () => {
  /* E' il difetto, scritto: si sposta l'elenco e si lascia il numero com'era. */
  const soloElenco = [APPENA_CREATE[0], APPENA_CREATE[3], APPENA_CREATE[1], APPENA_CREATE[2]];
  const canoniche = migrateRooms(soloElenco);
  assert.deepEqual(ordinePagina(canoniche, ["Soggiorno", "Cucina", "Ingresso"]), [
    "Soggiorno",
    "Cucina",
    "Ingresso",
  ]);
});

test("una stanza aggiunta dopo, senza numero, va in fondo e non scavalca nessuno", () => {
  const conNuova = numerate([APPENA_CREATE[0], APPENA_CREATE[3]]).concat([{ name: "Bagnetto" }]);
  const canoniche = migrateRooms(conNuova);
  assert.deepEqual(
    canoniche.map((stanza) => stanza.order),
    [0, 1, 2],
  );
  assert.deepEqual(ordinePagina(canoniche, ["Bagnetto", "Ingresso", "Casa"]), [
    "Casa",
    "Ingresso",
    "Bagnetto",
  ]);
});
