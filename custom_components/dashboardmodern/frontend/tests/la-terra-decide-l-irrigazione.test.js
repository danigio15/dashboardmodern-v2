/* La terra decide l'irrigazione.
 *
 * «Se il terreno è uguale o sopra una % salta l'irrigazione, se è al di
 * sotto del 5% parte, con degli avvisi.» Il cancello sta sopra
 * `cdIrrProgram` — dove gia' vive lo skip per pioggia — e l'avvio autonomo
 * si valuta sugli eventi di stato, mai con orologi propri. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL("../src/sections/pool-irrigation-scene-section.js", import.meta.url);

test("il cancello sul programma: override con marker, mai wrapFunction, e «forza» passa", async () => {
  const source = await readFile(moduleUrl, "utf8");
  assert.match(source, /function installProgramGate\(\)/);
  assert.match(source, /__dmIrrSoilGate/);
  assert.match(source, /gated\.__dmPrevious = current/);
  assert.match(source, /root\.cdIrrProgram = gated/);
  /* Lo skip scrive l'avviso dove la card gia' lo legge. */
  assert.match(source, /CD_IRR\.skip = `🌱/);
  assert.match(source, /if \(!force\) \{/);
});

test("l'avvio autonomo: soglia bassa, una volta al giorno, e il giorno si brucia solo a partenza avvenuta", async () => {
  const source = await readFile(moduleUrl, "utf8");
  assert.match(source, /const SOIL_RUN_KEY = "cd_irr_soil_lastrun"/);
  assert.match(source, /if \(!config\.enabled \|\| !config\.zones\.length\) return;/);
  assert.match(source, /soil\.reading >= soglia\) return;/);
  assert.match(source, /root\.CD_IRR\?\.cur \?\? -1\) >= 0\) return;/);
  /* La chiave-giorno si scrive DOPO la chiamata, dentro il ramo che verifica
   * che la sequenza sia davvero partita: uno skip per pioggia non la brucia. */
  const chiamata = source.indexOf("root.cdIrrProgram?.(false);");
  const scrittura = source.indexOf("setItem?.(SOIL_RUN_KEY", chiamata);
  assert.ok(chiamata > 0 && scrittura > chiamata, "la chiave-giorno segue la partenza vera");
  /* Niente orologi propri: la valutazione corre sugli eventi di stato. */
  assert.match(source, /"dashboardmodern:state-changed",\s*\]\s*\)\s*\n\s*root\.addEventListener\?\.\(eventName, \(\) => \{\s*\n\s*installProgramGate\(\);\s*\n\s*valutaTerreno\(\);/);
});

test("le soglie vivono accanto al sensore del terreno, e si salvano con lui", async () => {
  const source = await readFile(moduleUrl, "utf8");
  for (const id of ["ed-irr-soil-skip", "ed-irr-soil-start"]) assert.ok(source.includes(id), id);
  assert.match(source, /\["ed-irr-soil-skip", "soilSkipAbove"\]/);
  assert.match(source, /\["ed-irr-soil-start", "soilStartBelow"\]/);
});
