import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

/* Sul telefono la scheda si stringe, e a stringerla e' chi la disegna.
 *
 * Questa prova misurava la scheda alta del foglio accanto: 370 pixel di
 * larghezza, la colonna da 92, l'illustrazione da 84. Numeri veri, per una
 * scheda che nessuno disegnava piu'. La scheda che si vede sul telefono e'
 * quella della sezione, e si stringe con le proprie misure. */
test("appliance mobile layout targets the real legacy body without changing artwork ownership", async () => {
  const layout = await read("src/sections/appliance-layout-section.js");
  const showcase = await read("src/sections/appliance-showcase-section.js");
  const appliances = await read("src/sections/appliances-section.js");
  assert.match(showcase, /@media\(max-width:1120px\)/);
  assert.match(
    showcase,
    /\.dm-appl-shell\[data-view="list"\] \.appl-wide-card\.dm-ap-card\{grid-template-columns:64px minmax\(0,1fr\)/,
  );
  assert.match(showcase, /@media\(max-width:640px\)/);
  // Il disegno dell'elettrodomestico lo possiede la sezione, una volta sola.
  assert.doesNotMatch(layout, /resolveApplianceArtwork|applianceArtworkCandidates|canonicalArtworkType|applianceArtwork\(/);
  assert.match(appliances, /from "\.\.\/core\/appliance-artwork\.js"/);
  assert.match(appliances, /canonicalArtworkType/);
  assert.match(appliances, /applianceArtwork/);
});

test("energy editor keeps its existing owner for visibility and entity search", async () => {
  const source = await read("src/sections/editor-contracts-section.js");
  assert.match(source, /normalizeEnergyVisibility/);
  assert.match(source, /dataset\.dmEnergyVisibility/);
  assert.match(source, /edSecTog/);
  assert.match(source, /hasEntityPicker/);
  assert.match(source, /dm-contract-entity-picker/);
  assert.match(source, /Cerca entità|Search entity/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test("EV selector remains content-sized", async () => {
  const source = await read("src/sections/ev-section.js");
  assert.match(source, /width:max-content/);
  assert.match(source, /flex:0 0 auto/);
  assert.match(source, /max-width:76vw/);
  assert.doesNotMatch(source, /flex:0 0 min\(82vw,300px\)/);
});

test("della card «Tapparelle aperte» non e' rimasto nemmeno il vestito", async () => {
  // Il popup era un modale centrato anche sul telefono. Adesso la card che lo
  // apriva non c'e' piu' — il Quadro Avvisi che la ospitava e' uscito dalla
  // Home — e con lei se n'e' andato tutto il suo foglio di stile.
  const source = await read("src/sections/shutter-section.js");
  assert.doesNotMatch(source, /dm-shutter-popup/);
  assert.doesNotMatch(source, /dm-shutter-alert/);
});

test("navigation has one canonical owner with dark-mode contrast", async () => {
  const runtime = await read("src/sections/section-runtime.js");
  const navigation = await read("src/sections/navigation-section.js");
  assert.equal((runtime.match(/navigation-section\.js/g) || []).length, 1);
  assert.equal((runtime.match(/installNavigationSection\(\)/g) || []).length, 1);
  assert.equal((runtime.match(/"navigation"/g) || []).length, 1);
  assert.match(navigation, /bottom-nav-bar/);
  assert.match(navigation, /#cbd5e1/);
  assert.doesNotMatch(navigation, /setInterval|MutationObserver/);
});

test("temperature mobile card is owned by the canonical temperature renderer", async () => {
  const runtime = await read("src/sections/section-runtime.js");
  const source = await read("src/sections/temperature-section.js");
  const legacyLayout = await read("src/sections/temperature-layout-section.js");

  assert.equal((runtime.match(/temperature-section\.js/g) || []).length, 1);
  assert.equal((runtime.match(/installTemperatureSection\(\)/g) || []).length, 1);
  assert.match(source, /renderTemperatureCards/);
  assert.match(source, /data-dm-temperature-canonical/);
  // Mobile card metrics of the current design; update deliberately with it.
  assert.match(source, /grid-template-columns:minmax\(0,360px\)/);
  assert.match(source, /max-width:360px!important/);
  assert.match(source, /min-height:124px!important/);
  assert.match(source, /font-size:36px!important/);
  assert.match(source, /font-size:22px!important/);
  assert.doesNotMatch(source, /setInterval|MutationObserver/);

  // Temporary import compatibility only: it must not render, style or observe.
  assert.match(legacyLayout, /return false/);
  assert.doesNotMatch(legacyLayout, /installStyle|setInterval|MutationObserver|querySelector|innerHTML/);
});
