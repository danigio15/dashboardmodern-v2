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

test("ogni stanza ha la sua scritta: è un avviso, e lo si vuole per tutte", () => {
  /* Questo contratto è cambiato due volte, e la seconda è quella buona.
   *
   * La scritta compariva solo per le stanze con più di una finestra, perché
   * ripeteva la card — la stanza la card la stampa già sotto il nome — e
   * perché il separatore prende tutta la riga: con una finestra per stanza
   * erano un'intestazione e una card per riga, che è la #424.
   *
   * Ma il separatore non lo riceveva chi non aveva la scritta, e le card delle
   * altre stanze finivano sotto il nome di una stanza che non era la loro:
   * nove finestre in otto stanze, UNA intestazione, e sotto tutte e nove.
   *
   * Adesso la scritta ha smesso di ripetere la card: dice quante cose sono
   * APERTE in quella stanza, ed è l'unica cosa che le sue card, una per una,
   * non dicono insieme. Un avviso lo si vuole per ogni stanza — se no non si
   * sa di quali stanze taccia — e il conto vale per le card che gli stanno
   * sotto, perché sotto ci sono soltanto le sue. */
  const views = ["Salone", "Cucina", "Camera", "Studio", "Bagno", "Corridoio"].map((stanza, i) =>
    finestra(`t${i}`, stanza),
  );
  assert.equal(stanzeConIntestazione(views).size, 6);
});

test("una stanza con più finestre e una con una sola: le scritte ci sono tutte e due", () => {
  const views = [
    finestra("a", "Salone"),
    finestra("b", "Salone"),
    finestra("c", "Cucina"),
  ];
  const con = stanzeConIntestazione(views);
  assert.equal(con.size, 2);
  assert.ok(con.has(chiave(finestra("a", "Salone"))));
  assert.ok(con.has(chiave(finestra("c", "Cucina"))), "la Cucina non finisce sotto il Salone");
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
   * confondessero, le due card diventerebbero un gruppo solo e il conto degli
   * aperti di sopra finirebbe scritto sopra la camera di sotto. */
  const views = [finestra("a", "Camera", "Terra"), finestra("b", "Camera", "Primo")];
  const con = stanzeConIntestazione(views);
  assert.equal(con.size, 2, "due stanze, due scritte");
  assert.ok(con.has(chiave(finestra("a", "Camera", "Terra"))));
  assert.ok(con.has(chiave(finestra("b", "Camera", "Primo"))));
});

test("un elenco vuoto o storto non fa scrivere niente", () => {
  assert.equal(stanzeConIntestazione([]).size, 0);
  assert.equal(stanzeConIntestazione(null).size, 0);
  assert.equal(stanzeConIntestazione(undefined).size, 0);
});
