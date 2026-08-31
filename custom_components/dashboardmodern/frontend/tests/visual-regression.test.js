import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readLegacyBundle } from "./legacy-source.js";

const legacy = new URL("../legacy/", import.meta.url);
const expectedTabs = [
  "home",
  "energy",
  "appliances-main",
  "ev",
  "boiler",
  "clima",
  "temp",
  "tapparelle",
  "irrigazione",
  "piscina",
  "security",
  "server",
  "config",
];
/* Le impronte cambiano solo con una modifica voluta al foglio vendorizzato.
 * Questo giro sono due:
 *
 *  - il telefono non decide piu' lui quanto e' grande un carattere. Android
 *    gonfia da solo il testo dentro i contenitori che scorrono in orizzontale,
 *    ed e' per questo che il font delle linguette delle stanze in Temperature
 *    tornava «sballato» ogni volta che lo si rimpiccioliva in CSS;
 *  - le linguette dell'editor stanno in colonna. Erano diciassette voci in una
 *    fila che scorreva, tre visibili per volta: adesso si vedono tutte e il
 *    corpo della scheda si apre accanto invece che sotto. Da telefono tenuto in
 *    piedi la colonna si stringe al simbolo — il nome lo nasconde chi quel
 *    pezzo lo crea — e si riallarga appena il telefono si gira;
 *  - tutte le finestre della plancia hanno una veste sola: erano nate una alla
 *    volta e si vedeva — un anello bianco cucito nel bordo che sul tema scuro
 *    faceva da taglio, un'entrata lunga mezzo secondo, e un tasto di chiusura
 *    che pesava piu' del titolo;
 *  - a barra ferma sparisce il sensore che la chiama. Da desktop la barra sta
 *    nascosta e si affaccia quando il puntatore le arriva vicino: a chiamarla
 *    e' un rettangolo invisibile che le sborda intorno, e che sta dentro di
 *    lei — quindi sopra la pagina. Con la barra gia' ferma e alzata quella
 *    fascia cadeva sulla seconda fila delle tessere della Home, e quelle
 *    tessere non si riuscivano a premere. Sotto, un po' di respiro in piu';
 *  - la barra e' piu' bassa e meno trasparente. Era alta ottanta pixel e
 *    velata al sessantacinque per cento: con del contenuto sotto le scritte
 *    delle sezioni ci si perdevano dentro. Adesso il fondo e' quasi pieno, il
 *    vetro sfoca di piu' — quello che passa sotto si intuisce e non si legge,
 *    che e' il punto di un vetro smerigliato — e ogni voce costa dodici pixel
 *    in meno: l'icona e il nome ci stanno lo stesso, il resto era aria;
 *  - sul tondo di chiusura dello storico c'era una X di troppo. La X la
 *    disegna il ::before della regola generica, che azzera la misura del
 *    testo per nascondere quella scritta nel markup; la regola specifica
 *    dello storico rimetteva font-size 14px e le si vedevano tutte e due;
 *  - il Chiudi resta in cima anche a lista scorsa. Nei popup lunghi (il
 *    Clima rapido con tante stanze) l'intestazione scorreva via col
 *    contenuto: «il tasto Chiudi sta troppo in fondo e non si legge». Ora
 *    e' sticky sul bordo alto del foglio, col fondo pieno, e il foglio non
 *    supera l'area visibile vera (dvh) sull'app Android;
 *  - la chiusura si legge, e si legge uguale dappertutto. «Rendi coerenti le
 *    x chiudi ovunque, non solo x»: qui dentro il tondino nascondeva la
 *    parola (font-size:0) e ridisegnava la croce col ::before, mentre lo
 *    storico aveva pure una regola sua che rimetteva il testo. Ora .ev-waw-close
 *    torna la pillola scritta «✕ CHIUDI» — nessun azzeramento del carattere,
 *    nessun ::before, e l'eccezione dello storico non serve piu': tutti i
 *    fogli della plancia chiudono con la stessa pastiglia. */
const vendoredCssSnapshots = {
  "dashboard-runtime-it.css": "93d2c9db5f62b641c1fd92d58db332aafd6e96d84a38e6610efd17fd3edba6be",
  "dashboard-runtime-en.css": "02a4749ff9090df9612cfe022062d487aabc7c6c34600d5cf61177e91f427710",
};

for (const file of ["dashboard.html", "dashboard-en.html"]) {
  const source = readLegacyBundle(file);
  test(`${file}: navbar order and structural classes retain their DOM snapshot`, () => {
    const nav = source.match(/<nav class="tabs bottom-nav-bar">([\s\S]*?)<\/nav>/)?.[1] || "";
    assert.deepEqual(
      [...nav.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]),
      expectedTabs,
    );
    for (const token of [
      "tab active",
      "icon",
      "text",
      "page active",
      "weather-widget",
      "cam-card",
      "appl-wide-card",
    ])
      assert.match(source, new RegExp(`class="[^"]*${token}`));
  });
  test(`${file}: Lights has assignment/reorder but no room lifecycle controls`, () => {
    const editor = source.slice(
      source.indexOf("function editorRenderLuci"),
      source.indexOf("function cdLuciAddRoom"),
    );
    assert.match(editor, /cdLuciSetRoom/);
    assert.match(editor, /cdLuciMove/);
    assert.doesNotMatch(
      editor,
      /ed-new-luci-room|cdLuciRenameRoom|cdLuciDeleteRoom|cdLuciAddRoom\(/,
    );
  });
  test(`${file}: canonical CRUD branches do not write legacy storage`, () => {
    for (const functionName of ["edApplSave", "edApplDel", "dmSaveCameras"]) {
      const start = source.indexOf(`function ${functionName}`);
      const body = source.slice(start, source.indexOf("\n}", start) + 2);
      const canonical = body.match(/if\(store\)\{?([\s\S]*?)(?:return;?|\}\s*else)/)?.[1] || "";
      assert.doesNotMatch(canonical, /localStorage\.(?:setItem|removeItem)/, functionName);
    }
  });
}

test("language-specific vendored layout styles retain byte-for-byte snapshots", () => {
  for (const [file, expected] of Object.entries(vendoredCssSnapshots)) {
    const value = readFileSync(new URL(`../legacy/${file}`, import.meta.url));
    assert.equal(createHash("sha256").update(value).digest("hex"), expected, file);
  }
});

test("shared legacy CSS does not own appliance card geometry", () => {
  const source = readFileSync(new URL("../legacy/dashboard-runtime.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-page-grid/);
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-wide-card/);
  assert.doesNotMatch(source, /#page-appliances-main\s+\.appl-ic/);
  assert.doesNotMatch(source, /\.appl-action-btn\s*\{/);
});
