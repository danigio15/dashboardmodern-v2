/* La plancia non deve scaldare il mini PC (dal campo).
 *
 * «Quando e' avviata la dashboard il processore del mini PC schizza di
 * utilizzo e sale la temperatura.» Queste prove tengono ferme le cadenze e le
 * guardie che costano: il ricalcolo dei periodi dell'Energia, la scansione
 * della pagina Temperature, lo sfondo animato, le scritture di stile ripetute.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { HomeAssistantBroker } from "../src/core/period-service.js";
import { RIPOSO_ENERGIA_MS } from "../src/sections/energy-section.js";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("i periodi dell'Energia si ricalcolano al piu' una volta al minuto", () => {
  /* Le statistiche di Home Assistant si compilano ogni cinque minuti: cinque
   * domande al Recorder ogni quindici secondi non trovavano niente di nuovo. */
  assert.equal(RIPOSO_ENERGIA_MS, 60_000);
  const energia = leggi("sections/energy-section.js");
  assert.match(energia, /Math\.max\(250, RIPOSO_ENERGIA_MS - elapsed\)/);
  assert.equal(/Math\.max\(250, 15000 - elapsed\)/.test(energia), false);
  assert.equal(new HomeAssistantBroker().cacheCurrentMs, 60_000);
  assert.equal(new HomeAssistantBroker({ cacheCurrentMs: 5 }).cacheCurrentMs, 5);
});

test("la scansione della pagina Temperature gira solo a pagina a schermo, un giro per fotogramma", () => {
  const sezione = leggi("sections/beta17-final-icon-polish-section.js");
  const ascolto = sezione.slice(
    sezione.indexOf('root.addEventListener?.("dashboardmodern:state-changed"'),
  );
  assert.match(
    ascolto,
    /if \(!doc\?\.getElementById\("page-temp"\)\?\.classList\.contains\("active"\)\) return;/,
  );
  assert.match(ascolto, /if \(state\.temperatureFrame\) return;/);
  assert.match(
    ascolto,
    /state\.temperatureFrame =\s*root\.requestAnimationFrame\?\.\(\(\) => \{\s*state\.temperatureFrame = 0;\s*hideTemperatureProgressCopy\(\);/,
  );
});

test("lo sfondo animato sta sul suo livello e si ferma per chi riduce le animazioni", () => {
  const sezione = leggi("sections/beta27-release-stability-section.js");
  assert.match(
    sezione,
    /\.animated-mesh-bg::before,\.animated-mesh-bg::after\{will-change:transform\}/,
  );
  assert.match(
    sezione,
    /@media \(prefers-reduced-motion:reduce\)\{\s*\.animated-mesh-bg::before,\.animated-mesh-bg::after\{animation-play-state:paused!important\}/,
  );
});

test("i colori dei tubi dell'Energia non si riscrivono a ogni passata", () => {
  /* Lo stile riletto non e' quello scritto: il segno di cosa si e' scritto
   * sta a parte, e il confronto e' con quello. */
  const sezione = leggi("sections/energy-flow-section.js");
  assert.match(
    sezione,
    /if \(node\.dataset\.dmFlowStroke !== stroke\) \{\s*node\.dataset\.dmFlowStroke = stroke;\s*node\.style\.stroke = stroke;/,
  );
  assert.match(
    sezione,
    /if \(node\.dataset\.dmFlowFill !== fill\) \{\s*node\.dataset\.dmFlowFill = fill;\s*node\.style\.fill = fill;/,
  );
  assert.equal(/node\.style\.stroke !== stroke\)/.test(sezione), false);
});
