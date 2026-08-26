/* La scheda Luci del Config: la fascia di visibilita' come le altre sezioni,
 * la stanza gia' nell'inserimento, e un cestino che cancella davvero — con una
 * conferma nella pagina, non con il confirm() che l'app blocca. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addLightFromForm,
  mapsWithoutLight,
  renderCanonicalLightsEditor,
} from "../src/sections/lights-alerts-section.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("la fascia visibile/nascondi conosce la scheda Luci", async () => {
  /* `ensureVisibilityBanner` stampa la fascia solo per le schede nella mappa:
   * senza questa riga il toggle non compare, e nascondere non nasconde. */
  const uniformity = await read("../src/sections/config-uniformity-section.js");
  assert.match(uniformity, /luci: "luci"/);
  /* La chiave scritta in cd_sections e' la stessa che la barra legge. */
  const page = await read("../src/sections/lights-page-section.js");
  assert.match(page, /LIGHTS_TAB\]: LIGHTS_TAB/);
});

test("l'inserimento chiede anche la stanza, e non passa piu' da alert()", () => {
  const markup = renderCanonicalLightsEditor();
  assert.match(markup, /id="luce-add-room"/);
  assert.match(markup, /dmLuceAdd\(\)/);
  assert.doesNotMatch(markup, /cdLuceAdd\(\)/);
  // L'errore si scrive nel form, dove chi ha sbagliato lo puo' leggere.
  assert.match(markup, /data-light-add-error/);
});

test("senza un'entità valida l'inserimento si ferma senza salvare", () => {
  // Niente documento: il form non c'e', quindi niente entita' — e niente crash.
  assert.equal(addLightFromForm(), false);
});

test("il cestino passa dalla conferma in pagina", async () => {
  const markup = renderCanonicalLightsEditor();
  // Il form vuoto non ha righe: le classi del cestino stanno nel sorgente.
  const source = await read("../src/sections/lights-alerts-section.js");
  assert.match(source, /dmLuceDel\('\$\{esc\(id\)\}'\)/);
  assert.doesNotMatch(source, /onclick="cdLuceDel/);
  // E il legacy cdLuceDel viene reindirizzato alla versione che funziona.
  assert.match(source, /root\.cdLuceDel = openLightDeleteConfirm/);
  assert.ok(markup.includes("luce-add-ent"));
});

test("cancellare una luce la toglie da ogni mappa, e solo lei", () => {
  const values = {
    cd_luci: { "light.a": "A", "light.b": "B" },
    cd_luci_rooms: { "light.a": "room-salone", "light.b": "room-studio" },
    cd_luci_order: { Salone: ["light.a", "light.b"], Studio: ["light.b"] },
    cd_gruppi_extra: { luci: ["light.a", "light.b"], altro: ["sensor.x"] },
  };
  const next = mapsWithoutLight(values, "light.a");
  assert.deepEqual(next.cd_luci, { "light.b": "B" });
  assert.deepEqual(next.cd_luci_rooms, { "light.b": "room-studio" });
  assert.deepEqual(next.cd_luci_order, { Salone: ["light.b"], Studio: ["light.b"] });
  assert.deepEqual(next.cd_gruppi_extra, { luci: ["light.b"], altro: ["sensor.x"] });
  // Le mappe di partenza restano come erano: la scrittura decide chi salva.
  assert.deepEqual(values.cd_luci, { "light.a": "A", "light.b": "B" });
});
