import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runSteps, stepReporter } from "../src/core/runtime-steps.js";

/* Il racconto di chi ha aperto la segnalazione: sezioni configurate e attive
 * che a un caricamento ci sono e a quello dopo no. L'avvio era una fila di
 * chiamate scritte di seguito: bastava che una cadesse perche' la visibilita'
 * delle sezioni e il disegno non partissero mai. */

test("un passo che cade non porta giu' quelli dopo", () => {
  const fatti = [];
  const caduti = runSteps([
    ["proiezione", () => fatti.push("proiezione")],
    [
      "schede",
      () => {
        throw new Error("entita' sparita");
      },
    ],
    ["visibilita", () => fatti.push("visibilita")],
    ["disegno", () => fatti.push("disegno")],
  ]);
  assert.deepEqual(fatti, ["proiezione", "visibilita", "disegno"]);
  assert.deepEqual(caduti, ["schede"]);
});

test("i passi restano nell'ordine in cui sono scritti", () => {
  const fatti = [];
  runSteps([
    ["uno", () => fatti.push(1)],
    ["due", () => fatti.push(2)],
    ["tre", () => fatti.push(3)],
  ]);
  assert.deepEqual(fatti, [1, 2, 3]);
});

test("un passo che non c'e' si salta senza contarlo fra i caduti", () => {
  const caduti = runSteps([
    ["assente", undefined],
    ["presente", () => {}],
  ]);
  assert.deepEqual(caduti, []);
});

test("chi cade lo si dice col suo nome, non con un 'qualcosa'", () => {
  const detti = [];
  const console_ = { error: (messaggio, errore) => detti.push([messaggio, errore.message]) };
  runSteps(
    [
      [
        "cdApplyNavVis",
        () => {
          throw new Error("niente stanze");
        },
      ],
    ],
    { onError: stepReporter(console_, "avvio") },
  );
  assert.equal(detti.length, 1);
  assert.match(detti[0][0], /avvio: "cdApplyNavVis" non e' andato a buon fine/);
  assert.equal(detti[0][1], "niente stanze");
});

test("se anche il racconto cade, i passi dopo partono lo stesso", () => {
  const fatti = [];
  runSteps(
    [
      [
        "rotto",
        () => {
          throw new Error("x");
        },
      ],
      ["dopo", () => fatti.push("dopo")],
    ],
    {
      onError: () => {
        throw new Error("pure il racconto");
      },
    },
  );
  assert.deepEqual(fatti, ["dopo"]);
});

test("senza passi non succede nulla", () => {
  assert.deepEqual(runSteps(), []);
  assert.deepEqual(runSteps([]), []);
});

/* E le due file che davano il problema devono restare isolate: e' facile
 * rimetterle in colonna senza accorgersene. */
const corpo = (file, funzione) => {
  const testo = readFileSync(new URL(file, import.meta.url), "utf8");
  const inizio = testo.indexOf(`function ${funzione}(`);
  assert.ok(inizio >= 0, `${funzione} non trovata in ${file}`);
  const fine = testo.indexOf("\n}\n", inizio);
  return testo.slice(inizio, fine > 0 ? fine : undefined);
};

test("l'avvio del runtime passa dai passi isolati", () => {
  const testo = corpo("../legacy/modules-entry.js", "hydrateCanonicalRuntime");
  assert.match(testo, /runSteps\(/);
  assert.match(testo, /\["cdApplyNavVis",/);
  assert.match(testo, /\["render",/);
  // Nessuna chiamata rimasta in colonna, fuori dai passi.
  assert.doesNotMatch(testo, /^\s*globalThis\.render\?\.\(\);/m);
});

test("e cosi' il rinfresco dopo la configurazione condivisa", () => {
  const testo = corpo("../src/sections/config-persistence-section.js", "refreshRuntimeAfterRestore");
  assert.match(testo, /runSteps\(/);
  assert.match(testo, /\["cdApplyNavVis",/);
  assert.match(testo, /\["render",/);
  assert.doesNotMatch(testo, /^\s*root\.render\?\.\(\);/m);
});
