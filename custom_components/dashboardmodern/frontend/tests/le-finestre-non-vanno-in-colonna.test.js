/* «Persiste la visualizzazione sempre in colonna da monitor più grandi» (#424).
 *
 * La griglia era stata sistemata con la #349 — `repeat(auto-fit,minmax(288px,
 * 1fr))`, e la sua prova conta ancora le card che stanno sulla stessa riga —
 * eppure da PC continuavano a incolonnarsi. La griglia non c'entrava: fra una
 * card e l'altra c'era ogni volta l'intestazione della stanza, che prende
 * tutta la riga e manda la prossima card a capo. Con UNA tapparella per
 * stanza è un'intestazione e una card per riga, a qualunque larghezza.
 *
 * E quella scritta, sopra una card sola, non aggiungeva niente: la stanza la
 * card la stampa già sotto il proprio nome.
 *
 * Qui si guarda chi la scritta se la merita. La prova che la pagina poi ci
 * stia davvero in più colonne è `le-finestre-riempiono-lo-schermo`, che le
 * card le misura sullo schermo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { stanzeConIntestazione } from "../src/sections/shutter-scene-section.js";

const finestra = (name, room, floor = "") => ({ entity: `cover.${name}`, name, room, floor });
const chiave = (view) => `${view.floor}|${view.room}`;

test("una tapparella per stanza: nessuna intestazione, e le card riempiono la griglia", () => {
  const views = ["Salone", "Cucina", "Camera", "Studio", "Bagno", "Corridoio"].map((stanza, i) =>
    finestra(`t${i}`, stanza),
  );
  assert.equal(stanzeConIntestazione(views).size, 0);
});

test("una stanza con più finestre la scritta se la tiene: lì distingue davvero", () => {
  const views = [
    finestra("a", "Salone"),
    finestra("b", "Salone"),
    finestra("c", "Cucina"),
    finestra("d", "Camera"),
  ];
  const con = stanzeConIntestazione(views);
  assert.equal(con.size, 1);
  assert.ok(con.has(chiave(finestra("a", "Salone"))), "il Salone ne ha due, e si annuncia");
  assert.equal(con.has(chiave(finestra("c", "Cucina"))), false);
});

test("«Senza stanza» tiene la sua scritta anche da sola: la card non ha niente da stampare", () => {
  const views = [finestra("a", "Salone"), finestra("b", "Salone"), finestra("orfana", "")];
  const con = stanzeConIntestazione(views);
  assert.ok(con.has("|"), "il gruppo senza stanza si annuncia");
  assert.equal(con.size, 2);
});

test("una pagina dove nessuno ha una stanza non raggruppa affatto, come prima", () => {
  const views = [finestra("a", ""), finestra("b", ""), finestra("c", "")];
  assert.equal(stanzeConIntestazione(views).size, 0);
});

test("lo stesso nome a due piani resta due stanze", () => {
  /* «Camera» al piano terra e «Camera» al primo sono due posti diversi: se si
   * confondessero, due card sparse diventerebbero un gruppo da due e si
   * riprenderebbero l'intestazione — e la riga. */
  const views = [finestra("a", "Camera", "Terra"), finestra("b", "Camera", "Primo")];
  assert.equal(stanzeConIntestazione(views).size, 0);
});

test("un elenco vuoto o storto non fa scrivere niente", () => {
  assert.equal(stanzeConIntestazione([]).size, 0);
  assert.equal(stanzeConIntestazione(null).size, 0);
  assert.equal(stanzeConIntestazione(undefined).size, 0);
});
