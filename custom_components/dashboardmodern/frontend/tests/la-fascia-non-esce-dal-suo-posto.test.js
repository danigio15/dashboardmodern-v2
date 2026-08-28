/* La fascia della plancia spegne se stessa, non le altre intestazioni.
 *
 * Da quando la testata segue la pagina, una riga la nasconde quando la pagina
 * aperta non e' la Home. La riga pero' diceva `header`, e basta: nel documento
 * di intestazioni ce n'e' una per ogni finestra di modifica — quella con il
 * titolo e la croce per chiudere — e le spegneva tutte. La finestra
 * dell'elettrodomestico restava aperta senza modo di chiuderla, e la scheda
 * degli avvisi non aveva piu' la stessa forma di quella degli elettrodomestici.
 *
 * La fascia della plancia e' figlia diretta del corpo del documento: si chiede
 * cosi', e nessuna intestazione dentro una scheda puo' finirci dentro. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sorgente = (nome) => readFile(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");

test("la riga che spegne la fascia parla solo della fascia della plancia", async () => {
  const fascia = await sorgente("page-masthead-section.js");
  /* Figlia diretta del corpo: `body:has(...)>header`. Scritto senza il `>`
   * prendeva ogni intestazione del documento; scritto `body>header` dopo un
   * `body:has(...)` chiederebbe un corpo dentro il corpo, e non prenderebbe
   * piu' niente. */
  assert.match(fascia, /body:has\(\.page\.active\)>\$\{fascia\}/);
  assert.match(fascia, /body:has\(\.page\.active:not\(#page-home\)\)>\$\{fascia\}/);
  assert.doesNotMatch(fascia, /body:has\([^)]*\)[^>]*\s\$\{fascia\}/);
});

test("chi cerca la fascia per metterci il meteo cerca quella della plancia", async () => {
  const meteo = await sorgente("weather-in-masthead-section.js");
  assert.match(meteo, /querySelector\?\.\("body>header:not\(\.dm-page-mast\)"\)/);
});

/* E nessun altro foglio si prende tutte le intestazioni del documento. */
test("chi cerca l'intestazione non si prende quella di una scheda", async () => {
  const meteo = await sorgente("weather-in-masthead-section.js");
  assert.doesNotMatch(meteo, /querySelector\?\.\("header:not/);
});
