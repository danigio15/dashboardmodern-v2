/* I modali di modifica si leggono: colori, parole e nomi giusti.
 *
 * Tre difetti visti nello stesso giro di editor:
 *
 * 1. L'entita' inserita stava su una pillola blu piena col testo che non si
 *    leggeva: la regola dei modali dipingeva di blu OGNI `.dm-entity-picker`,
 *    anche la chip larga che porta il nome — era nata per il bottone-lente
 *    quadrato. (Misurato nel harness: chip rgb(2,132,199) prima, chiara dopo.)
 *
 * 2. «Modifica luce» spiegava il solo-vista con le parole delle PRESE — «il
 *    frigo, il modem, il congelatore» — schiacciate in una colonnina rotta.
 *
 * 3. Una luce aggiunta senza nome usciva con lo slug («faretti_cucina»)
 *    invece del friendly name dell'entita'.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const SEZIONI = join(QUI, "..", "src", "sections");
const leggi = (nome) => readFileSync(join(SEZIONI, nome), "utf8");

test("il blu pieno dei modali e' solo del bottone-lente, non della chip", () => {
  const contratti = leggi("editor-contracts-section.js");
  assert.match(
    contratti,
    /\.dm-section-modal \.dm-section-dialog \.dm-entity-picker:not\(\.dm-slot-chip\)\{[^}]*#0284c7/,
    "la regola blu deve escludere la chip larga che porta il nome dell'entita'",
  );
  assert.doesNotMatch(
    contratti,
    /\.dm-section-modal \.dm-section-dialog \.dm-entity-picker\{[^}]*#0284c7/,
    "nessuna regola blu senza l'esclusione della chip",
  );
});

test("il solo-vista delle luci parla di luci, e la riga e' impaginata", () => {
  const luci = leggi("lights-alerts-section.js");
  const modale = luci.slice(luci.indexOf("Si vede ma non si comanda"));
  assert.doesNotMatch(
    modale.slice(0, 800),
    /frigo|congelatore/,
    "le parole delle prese non stanno nel modale delle luci",
  );
  assert.match(luci, /dm-solo-lettura-riga\{display:flex!important/, "la riga ha il suo layout");
  const prese = leggi("prese-section.js");
  assert.match(
    prese,
    /dm-solo-lettura-riga/,
    "anche la riga delle prese usa la stessa impaginazione",
  );
});

test("una luce senza nome prende il friendly name, non lo slug", () => {
  const luci = leggi("lights-alerts-section.js");
  assert.match(
    luci,
    /clean\(doc\?\.getElementById\("luce-add-name"\)\?\.value\) \|\|\s*clean\(allStates\(\)\?\.\[entity\]\?\.attributes\?\.friendly_name\)/,
    "il ripiego del nome e' il friendly name dell'entita'",
  );
});
