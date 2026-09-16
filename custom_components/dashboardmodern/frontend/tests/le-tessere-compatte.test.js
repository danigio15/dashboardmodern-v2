/* La modalita' compatta dei widget della Home (#224), nel design «C4».
 *
 * La preferenza vive in `cd_widgets.compatto` — mai, auto, sempre, con «auto»
 * come difetto — e si applica come attributo `data-dm-compatto` sull'ospite
 * `#dm-widgets`: «sempre» stringe ovunque, «auto» solo sotto i 520 pixel via
 * media query del foglio, «mai» non lascia traccia. Il foglio fa il resto:
 * pillole a due colonne, chip neutro, nome in inchiostro pieno e valore Inter
 * SOTTO il nome, tacca d'accento a semipillola, didascalie e misure nascoste —
 * e chi le nasconde non le misura piu'.
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
  // La pillola: due colonne, ~52px, raggio 14, e la prima riga sciolta.
  assert.match(compatta, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(compatta, /min-height:52px/);
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

/* ── il nome e il valore non si contendono piu' la riga ────────────────────
 *
 * «ELETTRODOMESTIC 2», «TEMPERATU 24,2°», «AGEN 8 in arrivo»: il valore si
 * prendeva quello che gli serviva e al nome restava il resto, tagliato secco a
 * meta' parola dentro una pillola dove la seconda riga non ci sta. In colonna
 * il nome ha sempre la stessa larghezza, qualunque cosa dica il valore.
 */
test("nella pillola il nome sta sopra e il valore sotto, in colonna", () => {
  const compatta = PONTE.slice(PONTE.indexOf("function regoleCompatteCon"));
  // Due colonne dentro la pillola: il disegno, e la colonna del testo.
  assert.match(compatta, /grid-template-columns:30px minmax\(0,1fr\);grid-template-rows:auto auto/);
  // Il disegno tiene tutte e due le righe, in mezzo.
  assert.match(compatta, /grid-column:1;grid-row:1 \/ span 2;align-self:center/);
  // Il nome sulla prima riga, il valore sulla seconda, nella stessa colonna.
  assert.match(compatta, /\.dm-tile-label\{\n\s*grid-column:2;grid-row:1;/);
  assert.match(compatta, /\.dm-tile-val\{\n\s*grid-column:2;grid-row:2;/);
  /* Il valore non e' piu' ancorato a destra e non ha piu' un tetto: erano le
   * due cose che gli facevano togliere spazio al nome. */
  assert.doesNotMatch(compatta, /max-width:55%/);
  assert.doesNotMatch(compatta, /margin-left:auto/);
  assert.match(compatta, /max-width:100%;margin-left:0/);
  /* E il nome sta su una riga sola: la seconda e' del valore, e un nome che ci
   * scendesse dentro lo coprirebbe. */
  assert.match(compatta, /-webkit-line-clamp:1;white-space:nowrap/);
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
