/* «La prima entità in evidenza premendo su "salva sezione" funziona, mentre
 * dalla seconda non memorizza» (#288).
 *
 * Il difetto non stava nel salvataggio di una riga, che era giusto: stava nel
 * gesto. Il tasto «Salva sezione» in fondo alla scheda preme i salvataggi di
 * tutte le righe uno dopo l'altro, il primo ridisegna la scheda, e il
 * ridisegno stacca dal documento i bottoni che non hanno ancora avuto il loro
 * turno — insieme a quello che ci si era scritto dentro. Da fuori: la prima
 * entità la memorizza, dalla seconda no.
 *
 * La regola che lo risolve sta in un posto solo: chi disegna le righe le legge
 * tutte prima di scrivere, così il primo tocco salva tutta la scheda e quelli
 * dopo non hanno più niente da aggiungere. Queste prove difendono la regola e
 * il fatto che le schede a righe la usino davvero, invece di rifarsela in casa
 * ognuna a modo suo — che è come il difetto si era sparso su quattro schede.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

/* Un documento finto quanto basta: le righe con la loro posizione addosso e
 * delle caselle da leggere. Non serve un browser per provare l'aritmetica di
 * chi raccoglie. */
function documento(righe) {
  const nodo = (riga, posizione) => ({
    getAttribute: (nome) => (nome === "data-riga" ? String(posizione) : null),
    campi: riga,
  });
  const tutte = righe.map(nodo);
  return { querySelectorAll: (selettore) => (selettore === "[data-riga]" ? tutte : []) };
}

const leggiCampi = (riga, voce) => ({ ...voce, ...riga.campi });

test("chi salva una riga scrive quello che dicono tutte", async () => {
  const { righeDelDocumento } = await import("../src/sections/shared.js");
  const salvate = [
    { name: "Quadro", entity: "sensor.quadro" },
    { name: "", entity: "" },
  ];
  /* Il documento ha la prima riga com'era e la seconda appena compilata: è il
   * momento in cui il segnalatore preme «Salva sezione». */
  const body = documento([
    { name: "Quadro", entity: "sensor.quadro" },
    { name: "Cantina", entity: "sensor.cantina" },
  ]);
  const raccolte = righeDelDocumento(body, "data-riga", salvate, leggiCampi);
  assert.equal(raccolte[1].name, "Cantina", "la seconda riga è andata persa");
  assert.equal(raccolte[1].entity, "sensor.cantina");
  assert.equal(raccolte[0].name, "Quadro", "la prima riga non doveva cambiare");
  /* E la lista di partenza resta com'era: chi chiama decide quando scrivere. */
  assert.equal(salvate[1].name, "");
});

test("una riga che il documento non ha non inventa una voce", () => {
  /* Righe con una posizione storta, o oltre la fine della lista: se ne resta
   * fuori, invece di allungare la lista con dei buchi. */
  return import("../src/sections/shared.js").then(({ righeDelDocumento }) => {
    const body = {
      querySelectorAll: () => [
        { getAttribute: () => "ciao", campi: { name: "X" } },
        { getAttribute: () => "7", campi: { name: "Y" } },
      ],
    };
    const raccolte = righeDelDocumento(body, "data-riga", [{ name: "A" }], leggiCampi);
    assert.deepEqual(raccolte, [{ name: "A" }]);
    /* E senza documento non si perde quello che c'è già salvato. */
    assert.deepEqual(righeDelDocumento(null, "data-riga", [{ name: "A" }], leggiCampi), [
      { name: "A" },
    ]);
  });
});

test("una bozza può essere rifiutata, e allora resta quella salvata", async () => {
  const { righeDelDocumento } = await import("../src/sections/shared.js");
  const body = documento([{ entity: "" }, { entity: "sensor.buona" }]);
  const raccolte = righeDelDocumento(
    body,
    "data-riga",
    [{ entity: "sensor.gia_scelta" }, { entity: "" }],
    leggiCampi,
    (bozza) => Boolean(bozza.entity),
  );
  assert.equal(raccolte[0].entity, "sensor.gia_scelta", "una casella svuotata non cancella");
  assert.equal(raccolte[1].entity, "sensor.buona");
});

/* ── e le schede a righe la usano ─────────────────────────────────────── */

/* Le schede fatte così: una lista di righe, ognuna con il suo `.ed-save-btn`.
 * Sono quelle su cui il tasto in fondo preme più di un salvataggio, ed è lì
 * che il difetto si vede. */
const SCHEDE = [
  ["../src/sections/todo-editor-section.js", "data-evid-save", "le entità in evidenza"],
  ["../src/sections/people-editor-section.js", "data-person-save", "le persone"],
  ["../src/sections/sezioni-mie-editor-section.js", "data-mia-save", "le sezioni proprie"],
  /* La Gestione termica ne ha tre in una scheda sola: caldaie, scaldabagni e
   * impianti solari. Le prime due sono state trovate rotte allo stesso modo —
   * «ho due caldaie, una per zona» e la seconda non si memorizzava — e sono la
   * prova che questo difetto si sposta finché la regola sta in più copie. */
  ["../src/sections/impianti-termici-editor-section.js", "data-caldaia-save", "le caldaie"],
  ["../src/sections/impianti-termici-editor-section.js", "data-scald-save", "gli scaldabagni"],
  ["../src/sections/impianti-termici-editor-section.js", "data-solare-save", "gli impianti solari"],
  ["../src/sections/centrali-allarme-editor-section.js", "data-area-save", "le aree d'allarme"],
];

for (const [percorso, tasto, nome] of SCHEDE) {
  test(`${nome}: il salvataggio legge il documento, non solo la sua riga`, () => {
    const sorgente = leggi(percorso);
    assert.match(sorgente, new RegExp(tasto), "la scheda non ha più il salvataggio per riga");
    /* La regola arriva da fuori: una copia in casa è come si era sparso il
     * difetto la prima volta. */
    assert.match(sorgente, /righeDelDocumento/, "questa scheda salva ancora una riga alla volta");
  });
}

test("la regola sta in un posto solo", () => {
  const shared = leggi("../src/sections/shared.js");
  assert.match(shared, /export function righeDelDocumento\(/);
  /* Nessuna scheda si rifà il giro sulle righe per conto suo: cercare le
   * righe e sovrascriverne una sola è esattamente il difetto. */
  for (const [percorso, , nome] of SCHEDE) {
    const sorgente = leggi(percorso);
    assert.doesNotMatch(
      sorgente,
      /for \(const riga of body\?\.querySelectorAll/,
      `${nome} si è rifatta il raccoglitore in casa`,
    );
  }
});
