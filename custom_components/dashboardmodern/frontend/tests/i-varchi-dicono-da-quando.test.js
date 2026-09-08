/* «Sarebbe importante avere nei tasti relativi ai varchi più informazioni,
 * tipo l'ultima apertura o cambio stato; volendo il nome del sensore nella
 * maschera varchi potrebbe essere obsoleto.» (#406)
 *
 * Sotto il nome c'era `binary_sensor.porta_cantina`: la cosa che serve a chi
 * CONFIGURA — e nella scheda del Config resta — ma non a chi guarda. Chi
 * guarda vuole sapere da quanto quella finestra è aperta, che è la differenza
 * fra «l'ho lasciata aperta stamattina» e «si è appena aperta».
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { istanteDelCambio, varchiDiCasa } from "../src/core/varchi-di-casa.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const varco = (stato, quando) => ({
  state: stato,
  attributes: { device_class: "window", friendly_name: "Finestra cucina" },
  ...(quando ? { last_changed: quando } : {}),
});

test("la riga porta l'istante dell'ultimo cambio di stato", () => {
  const righe = varchiDiCasa(
    { "binary_sensor.cucina": varco("on", "2026-09-08T06:00:00Z") },
    {},
    new Set(),
  );
  assert.equal(righe.length, 1);
  assert.equal(righe[0].da, Date.parse("2026-09-08T06:00:00Z"));
});

test("si guarda il cambio di STATO, non l'ultimo aggiornamento", () => {
  /* `last_updated` si muove anche quando cambia solo un attributo — la
   * batteria del sensore, per dire — e direbbe «aperta da un minuto» di una
   * porta ferma da ieri. */
  assert.equal(
    istanteDelCambio({
      last_changed: "2026-09-07T06:00:00Z",
      last_updated: "2026-09-08T11:00:00Z",
    }),
    Date.parse("2026-09-07T06:00:00Z"),
  );
  /* Senza il cambio si ripiega sull'aggiornamento, che è meglio di niente. */
  assert.equal(
    istanteDelCambio({ last_updated: "2026-09-08T11:00:00Z" }),
    Date.parse("2026-09-08T11:00:00Z"),
  );
});

test("una porta senza storia non è una porta appena aperta", () => {
  /* Inventare «da poco» sarebbe una bugia: senza istante non si dice niente. */
  assert.equal(istanteDelCambio({}), null);
  assert.equal(istanteDelCambio(null), null);
  assert.equal(istanteDelCambio({ last_changed: "boh" }), null);
  const righe = varchiDiCasa({ "binary_sensor.cucina": varco("on") }, {}, new Set());
  assert.equal(righe[0].da, null);
});

test("la pagina scrive da quando, e torna all'identificativo solo senza istante", async () => {
  const sezione = await leggi("../src/sections/varchi-section.js");
  assert.match(sezione, /function daQuandoMarkup\(riga\)/);
  /* Il numero sta fuori dalla frase da tradurre: dentro, la chiave sarebbe
   * diversa per ogni minuto e non si troverebbe in nessun catalogo. */
  assert.match(sezione, /function quantoTempo\(minuti\)/);
  assert.match(sezione, /\$\{Math\.round\(minuti\)\} \$\{t\("minuti", "minutes"\)\}/);
  /* Senza istante resta l'identificativo: è comunque meglio di una riga
   * vuota. */
  assert.match(sezione, /if \(riga\.da === null \|\| riga\.da === undefined\)/);
  /* E l'identificativo non è più la riga di sempre sotto il nome. */
  assert.doesNotMatch(
    sezione,
    /<strong>\$\{esc\(riga\.name\)\}<\/strong>\s*\n\s*<small class="mono">/,
  );
});
