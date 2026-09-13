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

test("con una finestra per stanza non si annuncia nessuno: è la #424", () => {
  /* Questo contratto è stato scritto in tre modi, e il terzo è quello che
   * regge tutte e due le segnalazioni.
   *
   * (1) La scritta solo alle stanze con più di una finestra: il separatore
   * prende tutta la riga, ma chi non lo riceve non ne comincia una nuova, e le
   * card delle stanze mute finivano sotto il nome di una stanza che non era la
   * loro — nove finestre in otto stanze, UNA intestazione, e sotto tutte e
   * nove. Segnalato con la fotografia.
   *
   * (2) La scritta a TUTTE le stanze: con una finestra per stanza tornano
   * un'intestazione e una card per riga, a qualunque larghezza. È la #424,
   * «persiste la visualizzazione sempre in colonna da monitor più grandi», e
   * la sua prova e2e l'ha bocciata.
   *
   * (3) O separa tutti o non separa nessuno. È questa. */
  const views = ["Salone", "Cucina", "Camera", "Studio", "Bagno", "Corridoio"].map((stanza, i) =>
    finestra(`t${i}`, stanza),
  );
  assert.equal(stanzeConIntestazione(views).size, 0);
});

test("basta una stanza che resterebbe muta perché tacciano tutte", () => {
  /* La Cucina, con la sua unica finestra, non avrebbe scritta: la sua card
   * finirebbe sulla riga del Salone, sotto il nome del Salone. Perciò non ce
   * l'ha nemmeno il Salone. */
  const views = [finestra("a", "Salone"), finestra("b", "Salone"), finestra("c", "Cucina")];
  assert.equal(stanzeConIntestazione(views).size, 0);
});

test("quando ogni stanza ne ha più d'una, le scritte ci sono tutte", () => {
  const views = [
    finestra("a", "Salone"),
    finestra("b", "Salone"),
    finestra("c", "Cucina"),
    finestra("d", "Cucina"),
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
  const views = [
    finestra("a", "Camera", "Terra"),
    finestra("b", "Camera", "Terra"),
    finestra("c", "Camera", "Primo"),
    finestra("d", "Camera", "Primo"),
  ];
  const con = stanzeConIntestazione(views);
  assert.equal(con.size, 2, "due stanze, due scritte");
  assert.ok(con.has(chiave(finestra("a", "Camera", "Terra"))));
  assert.ok(con.has(chiave(finestra("c", "Camera", "Primo"))));
});

test("un elenco vuoto o storto non fa scrivere niente", () => {
  assert.equal(stanzeConIntestazione([]).size, 0);
  assert.equal(stanzeConIntestazione(null).size, 0);
  assert.equal(stanzeConIntestazione(undefined).size, 0);
});
