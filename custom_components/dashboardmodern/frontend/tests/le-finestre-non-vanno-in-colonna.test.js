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

test("una scritta sola sopra le card di tutti è peggio di nessuna scritta", () => {
  /* Questo contratto è cambiato, e il motivo arriva dal campo: una casa con
   * nove finestre in otto stanze vedeva UNA sola intestazione — «SOGGIORNO ·
   * 2 finestre» — e sotto tutte e nove le card, perché il separatore prende
   * tutta la riga e chi non ce l'ha non ne comincia una. Il numero era giusto
   * per il suo gruppo e falso per tutto quello che gli stava sotto.
   *
   * Darla anche alle stanze con una finestra sola rimetterebbe la #424 —
   * «persiste la visualizzazione sempre in colonna da monitor più grandi» —
   * perché tornerebbero un'intestazione e una card per riga.
   *
   * Quindi o separa tutte o non separa nessuna: qui Cucina e Camera ne hanno
   * una a testa, e tacciono tutte. Non si perde niente, la stanza ogni card se
   * la stampa già sotto il proprio nome. */
  const views = [
    finestra("a", "Salone"),
    finestra("b", "Salone"),
    finestra("c", "Cucina"),
    finestra("d", "Camera"),
  ];
  assert.equal(stanzeConIntestazione(views).size, 0);
});

test("quando OGNI stanza ne ha più d'una, le scritte ci sono tutte", () => {
  /* Lì distinguono davvero, e nessuna card finisce sotto il nome di un'altra
   * stanza: ogni gruppo comincia la sua riga. */
  const views = [
    finestra("a", "Salone"),
    finestra("b", "Salone"),
    finestra("c", "Cucina"),
    finestra("d", "Cucina"),
  ];
  const con = stanzeConIntestazione(views);
  assert.equal(con.size, 2);
  assert.ok(con.has(chiave(finestra("a", "Salone"))));
  assert.ok(con.has(chiave(finestra("c", "Cucina"))));
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
