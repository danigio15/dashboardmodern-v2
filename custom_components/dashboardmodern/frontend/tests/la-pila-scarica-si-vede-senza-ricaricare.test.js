/* La tessera delle batterie legge la configurazione, non solo la memoria.
 *
 * «La batteria attualmente e' al 1% e non compare il widget batteria scarica.»
 * La lista viva del guscio (`GRUPPI_MONITORAGGIO.batt`) si costruisce una
 * volta, all'avvio, da `cd_gruppi_extra`; la tessera leggeva solo lei. Una
 * pila aggiunta dalla finestra di modifica degli avvisi — che scrive solo la
 * configurazione — o arrivata con la sincronizzazione da un altro
 * apparecchio, o una configurazione arrivata nel pannello dopo l'avvio del
 * guscio, non c'era finche' non si ricaricava la pagina.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("la configurazione basta da sola: la lista viva puo' anche essere vuota", async () => {
  const { entitaSorvegliate } = await import("../src/sections/home-widgets-section.js");
  assert.deepEqual(
    entitaSorvegliate("batt", {
      extras: { batt: ["sensor.porta_studio_battery"] },
      removed: {},
      vive: [],
    }),
    ["sensor.porta_studio_battery"],
  );
  // E anche quando il guscio non ha proprio la lista.
  assert.deepEqual(
    entitaSorvegliate("batt", { extras: { batt: ["sensor.a"] } }),
    ["sensor.a"],
  );
});

test("la lista viva si somma per quello che ha in piu', senza doppioni", async () => {
  const { entitaSorvegliate } = await import("../src/sections/home-widgets-section.js");
  assert.deepEqual(
    entitaSorvegliate("batt", {
      extras: { batt: ["sensor.a", " sensor.b "] },
      removed: {},
      vive: ["sensor.b", "sensor.config_js", "", null],
    }),
    ["sensor.a", "sensor.b", "sensor.config_js"],
  );
});

test("quello che si e' tolto resta fuori, anche se la memoria lo tiene ancora", async () => {
  const { entitaSorvegliate } = await import("../src/sections/home-widgets-section.js");
  assert.deepEqual(
    entitaSorvegliate("batt", {
      extras: { batt: ["sensor.a"] },
      removed: { batt: ["sensor.vecchia"] },
      vive: ["sensor.a", "sensor.vecchia"],
    }),
    ["sensor.a"],
  );
});

test("chi si e' tolto e poi riaggiunto e' dentro: l'ultimo gesto e' l'aggiunta", async () => {
  const { entitaSorvegliate } = await import("../src/sections/home-widgets-section.js");
  assert.deepEqual(
    entitaSorvegliate("batt", {
      extras: { batt: ["sensor.a"] },
      removed: { batt: ["sensor.a"] },
      vive: [],
    }),
    ["sensor.a"],
  );
});

test("una lista che non e' una lista non fa cadere niente", async () => {
  const { entitaSorvegliate } = await import("../src/sections/home-widgets-section.js");
  assert.deepEqual(
    entitaSorvegliate("batt", { extras: { batt: { rotta: true } }, removed: null, vive: "x" }),
    [],
  );
  assert.deepEqual(entitaSorvegliate("batt"), []);
});

test("la tessera legge la configurazione, non solo la lista del guscio", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  const corpo = ponte.slice(ponte.indexOf("function gruppoEntita("));
  const fine = corpo.indexOf("\n}\n");
  const funzione = corpo.slice(0, fine);
  assert.match(funzione, /readJson\("cd_gruppi_extra"/);
  assert.match(funzione, /readJson\("cd_gruppi_removed"/);
  assert.match(funzione, /entitaSorvegliate\(/);
});
