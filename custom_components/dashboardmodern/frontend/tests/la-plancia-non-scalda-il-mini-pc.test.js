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
import {
  RIPOSO_ENERGIA_DI_SPALLE_MS,
  RIPOSO_ENERGIA_MS,
  riposoDeiPeriodi,
} from "../src/sections/energy-section.js";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");
const energiaSorgente = leggi("sections/energy-section.js");

test("i periodi dell'Energia si ricalcolano al piu' una volta al minuto", () => {
  /* Le statistiche di Home Assistant si compilano ogni cinque minuti: cinque
   * domande al Recorder ogni quindici secondi non trovavano niente di nuovo. */
  assert.equal(RIPOSO_ENERGIA_MS, 60_000);
  const energia = leggi("sections/energy-section.js");
  assert.match(energia, /Math\.max\(250, riposoDeiPeriodi\(\) - elapsed\)/);
  assert.equal(/Math\.max\(250, 15000 - elapsed\)/.test(energia), false);
  assert.equal(new HomeAssistantBroker().cacheCurrentMs, 60_000);
  assert.equal(new HomeAssistantBroker({ cacheCurrentMs: 5 }).cacheCurrentMs, 5);
});

test("e con la pagina chiusa si riposano quanto dura il dato: cinque minuti", () => {
  /* Il minuto e' il passo di chi guarda l'Energia. Chi sta sulla Home di quei
   * totali vede solo la tessera, e la tessera non puo' essere piu' fresca del
   * dato: le statistiche si compilano ogni cinque minuti, quindi chiedere ogni
   * minuto e' quattro letture del Recorder su cinque buttate — sul server, che
   * e' il mini PC che si scalda. */
  assert.equal(RIPOSO_ENERGIA_DI_SPALLE_MS, 5 * 60_000);
  const finta = (attiva, nascosta = false) => ({
    visibilityState: nascosta ? "hidden" : "visible",
    getElementById: (id) =>
      id === "page-energy" ? { classList: { contains: () => attiva } } : null,
  });
  assert.equal(riposoDeiPeriodi(finta(true)), RIPOSO_ENERGIA_MS);
  assert.equal(riposoDeiPeriodi(finta(false)), RIPOSO_ENERGIA_DI_SPALLE_MS);
  /* Una scheda in secondo piano non la guarda nessuno, nemmeno se la pagina
   * sotto e' quella dell'Energia. */
  assert.equal(riposoDeiPeriodi(finta(true, true)), RIPOSO_ENERGIA_DI_SPALLE_MS);
  /* E chi apre l'Energia non aspetta i cinque minuti: il tocco chiede subito. */
  assert.match(
    energiaSorgente,
    /if \(event\.target\?\.closest\?\.\("\[data-tab='energy'\]"\)\) scheduleEnergyRefresh\(true\);/,
  );
});

test("la scena dell'Energia si disegna solo a pagina aperta", () => {
  /* La passata chiede lo stile calcolato di ogni bolla e di ogni linea subito
   * dopo averne riscritte le proprie: e' un conto d'impaginazione ogni volta, e
   * col profilatore era la voce piu' grossa del processore — pagata anche da
   * chi la plancia la teneva sulla Home, dove quella scena non si vede. */
  const flusso = leggi("sections/energy-flow-section.js");
  assert.match(flusso, /if \(!laScenaSiVede\(\)\) return;/);
  assert.match(flusso, /return !pagina \|\| pagina\.classList\.contains\("active"\);/);
  /* E il tocco sulla linguetta la rimette in moto, se no resta indietro. */
  assert.match(flusso, /\.sub-tab-btn,\.tab\[data-tab\]/);
});

test("le tessere della Home si rifanno solo a Home aperta", () => {
  const widget = leggi("sections/home-widgets-section.js");
  assert.match(widget, /if \(!laHomeSiVede\(\)\) return;/);
  /* Il popup del dettaglio vive fuori dalla Home: finche' e' aperto, si tira
   * avanti a disegnare. */
  assert.match(widget, /return Boolean\(state\.expanded\);/);
});

test("nessuno legge la posizione di un nodo a ogni giro di stati", () => {
  /* `offsetParent` e `clientWidth` non sono letture gratis: obbligano il
   * browser a rifare i conti dell'impaginazione di tutta la pagina. Erano
   * dentro due cancelli che girano a ogni evento di stato — il conto lo si
   * pagava proprio per scoprire che non serviva fare niente. */
  const runtime = leggi("sections/section-runtime.js");
  assert.match(
    runtime,
    /const pagina = grid\.closest\?\.\("\.page"\);\s*const inScena = pagina \? pagina\.classList\.contains\("active"\) : Boolean\(grid\.offsetParent\);/,
  );
  const widget = leggi("sections/home-widgets-section.js");
  assert.equal(/const larghezza = Math\.round\(sub\.clientWidth\)/.test(widget), false);
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

test("lo stesso elettrodomestico disegnato due volte esce identico", async () => {
  /* La voce piu' grossa del processore, e non si vedeva da nessuna parte.
   *
   * Gli id dei gradienti dentro l'SVG portavano un contatore che saliva a ogni
   * chiamata: due disegni dello stesso apparecchio, a parita' di tutto,
   * uscivano DIVERSI. Chi disegna la vetrina prende l'impronta del markup per
   * non rifare le schede che non sono cambiate, e quell'impronta non poteva
   * mai coincidere: dodici schede rifatte da zero a ogni giro di disegno, con
   * la pagina chiusa, per sempre. Misurato: il giro del guscio da 14,7 a 4,9
   * millisecondi.
   *
   * L'identita' la da' chi chiama, e due disegni della stessa cosa possono
   * anche condividere le sfumature: sono le stesse. */
  const { applianceHeroArtwork } = await import("../src/core/appliance-hero-artwork.js");
  const uno = applianceHeroArtwork("lavatrice", 170, { chiave: "app-1" });
  const due = applianceHeroArtwork("lavatrice", 170, { chiave: "app-1" });
  assert.equal(uno, due, "lo stesso disegno chiesto due volte deve uscire identico");
  /* E due apparecchi diversi non si rubano le sfumature. */
  const altro = applianceHeroArtwork("lavatrice", 170, { chiave: "app-2" });
  assert.notEqual(uno, altro);
  /* Il contatore che saliva non c'e' piu'. */
  const sorgente = leggi("core/appliance-hero-artwork.js");
  assert.equal(/instance = \(instance \+ 1\)/.test(sorgente), false);
});

test("la vetrina degli elettrodomestici si disegna solo a pagina aperta", () => {
  /* La pagina resta nel documento anche quando non e' in scena, e il giro del
   * guscio chiama `renderApplianceSection` a ogni cambio di stato. `force`
   * resta la via di chi ha ragione di insistere: il tocco sulla linguetta e i
   * richiami dell'editor. */
  const vetrina = leggi("sections/appliance-showcase-section.js");
  assert.match(vetrina, /if \(!force && !vetrinaVisibile\(\)\) return false;/);
  assert.match(
    vetrina,
    /function vetrinaVisibile\(\) \{\s*return Boolean\(doc\?\.getElementById\?\.\("page-appliances-main"\)\?\.classList\?\.contains\("active"\)\);/,
  );
});

test("le riparazioni di compatibilita' si accodano, non si sparano", () => {
  /* Erano cinque bracci indipendenti — microtask, fotogramma e tre timer —
   * e i renderer avvolti sono due: dieci passate per ogni giro di disegno.
   * Adesso due momenti soli, e chi e' gia' in coda non ci rientra. */
  const beta = leggi("sections/beta25-compatibility-section.js");
  assert.match(beta, /const inCoda = new Set\(\);/);
  assert.match(beta, /if \(!inCoda\.has\(callback\)\)/);
  assert.equal(/root\.setTimeout\?\.\(callback, 60\)/.test(beta), false);
  assert.equal(/root\.queueMicrotask\?\.\(callback\);/.test(beta), false);
  /* E la riparazione esce subito a pagina chiusa: le due griglie che tocca
   * stanno tutt'e due li' dentro. */
  assert.match(
    beta,
    /if \(!doc\?\.getElementById\?\.\("page-appliances-main"\)\?\.classList\?\.contains\("active"\)\) return false;/,
  );
});
