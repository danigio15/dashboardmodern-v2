/* La stazione meteo personale nel widget della Home (#205).
 *
 * Chi ha una stazione (Ecowitt e simili) mappa i suoi sensori negli slot
 * `dm.home_meteo_*` della scheda Home: ogni sensore mappato vince
 * sull'attributo dell'entita' weather, la percepita compare come riga sua,
 * e la direzione del vento in gradi diventa una rosa a sedici punte. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const itUrl = new URL("../legacy/dashboard-runtime-it.js", import.meta.url);
const enUrl = new URL("../legacy/dashboard-runtime-en.js", import.meta.url);
const htmlItUrl = new URL("../legacy/dashboard.html", import.meta.url);
const htmlEnUrl = new URL("../legacy/dashboard-en.html", import.meta.url);

const REFS = [
  "dm.home_meteo_temperatura",
  "dm.home_meteo_umidita",
  "dm.home_meteo_percepita",
  "dm.home_meteo_vento",
  "dm.home_meteo_vento_direzione",
];

test("entrambi i runtime offrono gli slot della stazione e li leggono nel widget", async () => {
  for (const [url, rosa] of [
    [itUrl, "'SSO','SO','OSO','O','ONO','NO','NNO'"],
    [enUrl, "'SSW','SW','WSW','W','WNW','NW','NNW'"],
  ]) {
    const source = await readFile(url, "utf8");
    for (const ref of REFS) {
      assert.ok(source.includes(`{ ref: '${ref}',`), `${ref} e' uno slot della scheda Home`);
    }
    assert.match(source, /cdMeteoStazione/);
    assert.ok(source.includes(rosa), "la rosa dei venti parla la lingua del runtime");
    /* Il sensore mappato vince, l'entita' weather resta il ripiego — e la
     * stazione da sola basta a far vivere il widget. */
    assert.match(source, /wsTemp \? wsTemp\.v \+ \(wsTemp\.unit \|\| '°C'\)/);
    assert.match(source, /&& !wStation/);
    assert.match(source, /w-feel-row/);
  }
});

test("la riga della percepita esiste nel markup, nascosta finche' non serve", async () => {
  for (const [url, label] of [
    [htmlItUrl, "Percepita"],
    [htmlEnUrl, "Feels like"],
  ]) {
    const html = await readFile(url, "utf8");
    assert.match(html, new RegExp(`id="w-feel-row" style="display:none">🌡️ ${label}`));
    assert.match(html, /id="w-feel"/);
  }
});
