import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../../manifest.json", import.meta.url), "utf8"),
);

/* Il contratto è la forma, non il numero: il workflow di rilascio ricava il tag
 * da qui, quindi una versione che non è leggibile come `X.Y.Z` — con o senza il
 * suffisso di una candidata — pubblica un tag sbagliato. Ancorare il test alla
 * versione del giorno significava invece doverlo modificare a ogni rilascio. */
test("the release manifest is versioned correctly", () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+(?:\.\d+)?)?$/);
});

test("the release manifest carries the fields the integration needs", () => {
  assert.equal(manifest.domain, "dashboardmodern");
  assert.equal(typeof manifest.name, "string");
});
