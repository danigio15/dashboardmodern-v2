/* La modalita' compatta dei widget della Home (#224), nel design «C4».
 *
 * La preferenza vive in `cd_widgets.compatto` — mai, auto, sempre, con «auto»
 * come difetto — e si applica come attributo `data-dm-compatto` sull'ospite
 * `#dm-widgets`: «sempre» stringe ovunque, «auto» solo sotto i 520 pixel via
 * media query del foglio, «mai» non lascia traccia. Il foglio fa il resto:
 * pillole a due colonne, chip neutro, nome in inchiostro pieno, valore Inter
 * ancorato a destra, tacca d'accento a semipillola, didascalie e misure
 * nascoste — e chi le nasconde non le misura piu'.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { widgetPreferences } = await import("../src/sections/home-widgets-section.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const PONTE = readFileSync(join(SRC, "sections", "home-widgets-section.js"), "utf8");
const EDITOR = readFileSync(join(SRC, "sections", "todo-editor-section.js"), "utf8");

function scrivi(chiave, valore) {
  magazzino.set(chiave, JSON.stringify(valore));
}

test("la preferenza legge mai/auto/sempre, e il difetto e' auto", () => {
  magazzino.clear();
  assert.equal(widgetPreferences().compatto, "auto");
  for (const modo of ["mai", "auto", "sempre"]) {
    scrivi("cd_widgets", { compatto: modo });
    assert.equal(widgetPreferences().compatto, modo);
  }
  // Un valore che non esiste non passa: si torna al difetto.
  scrivi("cd_widgets", { compatto: "boh" });
  assert.equal(widgetPreferences().compatto, "auto");
  // E la preferenza convive con ordine, nascoste ed escluse.
  scrivi("cd_widgets", { compatto: "sempre", order: ["luci"], excluded: ["light.x"] });
  const preferenze = widgetPreferences();
  assert.equal(preferenze.compatto, "sempre");
  assert.deepEqual(preferenze.order, ["luci"]);
  assert.deepEqual(preferenze.excluded, ["light.x"]);
});

test("il disegnatore scrive l'attributo sull'ospite, e «mai» lo toglie", () => {
  // La modalita' e' un attributo: il resto lo fa il foglio, non JavaScript.
  assert.match(PONTE, /mounted\.removeAttribute\?\.\("data-dm-compatto"\)/);
  assert.match(PONTE, /mounted\.setAttribute\?\.\("data-dm-compatto", compatto\)/);
  assert.match(PONTE, /if \(compatto === "mai"\)/);
});

test("il foglio ha la C4 due volte: «sempre» ovunque, «auto» sotto i 520px", () => {
  // Le stesse regole con due radici: la media query decide per «auto».
  assert.match(PONTE, /#dm-widgets\[data-dm-compatto="sempre"\]/);
  assert.match(
    PONTE,
    /@media \(max-width:520px\)\{\$\{regoleCompatteCon\('#dm-widgets\[data-dm-compatto="auto"\]'\)\}/,
  );
  const compatta = PONTE.slice(PONTE.indexOf("function regoleCompatteCon"));
  // La pillola: due colonne, ~48px, raggio 14, e la prima riga sciolta.
  assert.match(compatta, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(compatta, /min-height:48px/);
  assert.match(compatta, /border-radius:14px/);
  assert.match(compatta, /\.dm-tile-cima\{display:contents\}/);
  // La tacca a semipillola, fusa nel bordo, senza la lama: animation none.
  assert.match(compatta, /width:4px;height:21px/);
  assert.match(compatta, /border-radius:0 4px 4px 0/);
  assert.match(compatta, /transform:none;animation:none/);
  // Il valore: Inter 800, tabulare, margine a zero per annullare l'Oswald.
  assert.match(compatta, /margin:0;padding:0/);
  assert.match(compatta, /font-weight:800;font-size:15\.5px/);
  // Il grado e la percentuale vanno in apice.
  assert.match(compatta, /align-self:flex-start/);
  // Didascalie e misure nascoste, e la pillola d'avviso col velo piatto al 10%.
  assert.match(compatta, /\.dm-tile-fondo\{display:none\}/);
  assert.match(compatta, /10%,var\(--card-bg,#fff\)\)/);
  assert.match(compatta, /width:5px;height:27px/);
  // Niente grana: la compatta e' piatta. L'alone pero' non sparisce —
  // e' il respiro degli avvisi («un avviso che non si sa leggere si muove
  // lo stesso», la prova delle animazioni lo pretende anche da telefono) —
  // e nella pillola si fa velo aderente che continua a pulsare.
  assert.match(compatta, /\.dm-tile-alone\{\n\s*inset:0;height:auto;border-radius:inherit/);
  assert.doesNotMatch(compatta, /\.dm-tile-alone\{display:none\}/);
  assert.match(compatta, /\.dm-tile::before\{display:none\}/);
});

test("il fitter non lascia ellissi spurie e le didascalie nascoste non si misurano", () => {
  // La soglia e' un pixel intero di sforo, non due.
  assert.match(
    PONTE,
    /nodo\.scrollWidth - nodo\.clientWidth >= 1 \|\| nodo\.scrollHeight - nodo\.clientHeight >= 1/,
  );
  // Il corpo minimo dei nomi scende a 6.7, per le pillole strette.
  assert.match(PONTE, /fallaEntrare\(nome, 0\.11, 6\.7\)/);
  // E lo scorrimento delle didascalie si salta quando la compatta le nasconde:
  // niente reflow a vuoto, la guardia sta sull'attributo.
  assert.match(PONTE, /function didascalieNascoste/);
  assert.match(PONTE, /if \(didascalieNascoste\(\)\) return 0;/);
  assert.match(PONTE, /matchMedia\?\.\("\(max-width: 520px\)"\)/);
});

test("la scheda Widget ha il segmented Mai | Auto | Sempre che scrive la scelta", () => {
  assert.match(EDITOR, /Tessere compatte/);
  for (const modo of ["mai", "auto", "sempre"])
    assert.match(EDITOR, new RegExp(`data-widget-compatto="\\$\\{valore\\}"|\\["${modo}",`));
  assert.match(EDITOR, /scriviPreferenze\(\{ compatto: clean\(compatto\.dataset\.widgetCompatto\) \}\)/);
  // E il riordino delle tessere non butta piu' il resto di cd_widgets.
  assert.match(EDITOR, /\{ \.\.\.base, \.\.\.pezzo \}/);
});
