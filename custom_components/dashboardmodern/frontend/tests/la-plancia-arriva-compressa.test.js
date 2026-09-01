/* La plancia arriva compressa, e la compressione non si perde per strada.
 *
 * Dal campo, dopo aver ricevuto la beta impacchettata: «nulla e' cambiato». La
 * Diagnostica diceva «impacchettati (3 file)», quindi il pacchetto funzionava —
 * erano le RICHIESTE a non essere il problema. Chi entra da fuori casa passa da
 * un tunnel, e li' contano i byte: 4,9 MB in chiaro, e 4,9 MB restavano.
 *
 * Home Assistant serve questi file con aiohttp, e aiohttp guarda da se' se
 * accanto al file ce n'e' uno con lo stesso nome piu' `.br` o `.gz`: se il
 * browser li accetta, manda quello. Provato contro un server fatto come il suo:
 * `section-runtime.js` scende da 2007 kB a 357, e chi chiede `identity` riceve
 * ancora l'originale intero. Misurato in pagina: 5142 kB scaricati diventano
 * 1179, e a 5 Mbit/s la plancia e' pronta in 2768 ms invece di 4884.
 *
 * Le due cose che possono andare storte:
 *
 *   - una copia compressa che non corrisponde piu' al suo originale verrebbe
 *     servita al posto suo, e nessuno se ne accorgerebbe: il browser riceve
 *     senza un lamento del codice di ieri;
 *   - una copia compressa registrata come asset a se' entrerebbe nella firma
 *     della cartella, e la plancia cambierebbe indirizzo a ogni rilascio per
 *     niente — piu' il doppio dei byte letti a ogni avvio.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const RADICE = join(FRONTEND, "../../..");
const { comprimiGliAsset, togliLeCopieCompresse, copiaDi } = await import(
  join(RADICE, "scripts/impacchetta-la-plancia.mjs")
);

/* Una cartella finta con dentro le stesse specie di file della vera: uno
 * grosso, uno piccolo, uno che non e' testo, e la provenienza. */
function cartellaFinta() {
  const radice = mkdtempSync(join(tmpdir(), "dm-compressa-"));
  mkdirSync(join(radice, "legacy/vendor"), { recursive: true });
  mkdirSync(join(radice, "src/i18n"), { recursive: true });
  mkdirSync(join(radice, "src/sections"), { recursive: true });
  writeFileSync(join(radice, "legacy/grosso.js"), "export const x = 1;\n".repeat(5000));
  writeFileSync(join(radice, "legacy/foglio.css"), ".a{color:red}\n".repeat(400));
  writeFileSync(join(radice, "legacy/minuscolo.json"), '{"a":1}');
  writeFileSync(join(radice, "legacy/build-info.js"), 'export const BUILD_INFO = {"a":1};');
  writeFileSync(join(radice, "legacy/vendor/carattere.woff2"), Buffer.from([0, 1, 2, 3, 4]));
  writeFileSync(join(radice, "src/i18n/ja.js"), "export default {};\n".repeat(3000));
  writeFileSync(join(radice, "src/sections/una-sezione.js"), "export const y = 2;\n".repeat(3000));
  writeFileSync(join(radice, "panel.js"), "export const p = 3;\n".repeat(200));
  return radice;
}

test("ogni file di testo ha le sue due copie, e tornano all'originale", () => {
  const radice = cartellaFinta();
  try {
    const fatti = comprimiGliAsset(radice);
    assert.equal(fatti.length, 5, `mi aspettavo cinque file compressi, sono ${fatti.length}`);
    for (const percorso of fatti) {
      const originale = readFileSync(percorso);
      assert.ok(
        gunzipSync(readFileSync(`${percorso}.gz`)).equals(originale),
        `${percorso}: la copia gzip non torna all'originale`,
      );
      assert.ok(
        brotliDecompressSync(readFileSync(`${percorso}.br`)).equals(originale),
        `${percorso}: la copia brotli non torna all'originale`,
      );
    }
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("nemmeno i file piccoli restano senza copia", () => {
  /* Non e' pignoleria. Con una soglia, un file che oggi la supera e domani non
   * la supera piu' si lascerebbe dietro la copia compressa di ieri — e quella
   * verrebbe servita al posto del file nuovo. Guasto muto, dei peggiori.
   * Meglio un `.gz` da trecento byte. */
  const radice = cartellaFinta();
  try {
    comprimiGliAsset(radice);
    assert.ok(existsSync(join(radice, "legacy/minuscolo.json.gz")));
    assert.ok(existsSync(join(radice, "legacy/minuscolo.json.br")));
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("i caratteri e le immagini restano come sono", () => {
  /* Sono gia' compressi: rifarlo non toglie un byte e ne aggiunge al pacchetto
   * di rilascio. */
  const radice = cartellaFinta();
  try {
    comprimiGliAsset(radice);
    assert.ok(!existsSync(join(radice, "legacy/vendor/carattere.woff2.gz")));
    assert.ok(!existsSync(join(radice, "legacy/vendor/carattere.woff2.br")));
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("si comprime la strada buona, non quella del ripiego", () => {
  /* I sorgenti sciolti sotto `src/` li chiede solo il ripiego, cioe' il caso in
   * cui il pacchetto non arriva — che per disegno e' gia' «lenta come ieri».
   * Comprimerli costava 2,2 MB dentro il pacchetto di rilascio, scaricati da
   * tutti a ogni aggiornamento, per una strada che non dovrebbe prendere
   * nessuno.
   *
   * I cataloghi delle lingue invece stanno sotto `src/` ma sono sulla strada
   * buona: arrivano uno per volta a ogni avvio, apposta per non stare nel
   * pacchetto. */
  const radice = cartellaFinta();
  try {
    comprimiGliAsset(radice);
    assert.ok(
      existsSync(join(radice, "src/i18n/ja.js.br")),
      "il catalogo della lingua non e' compresso",
    );
    assert.ok(existsSync(join(radice, "panel.js.br")), "l'ingresso in cima non e' compresso");
    assert.ok(
      !existsSync(join(radice, "src/sections/una-sezione.js.br")),
      "i sorgenti del ripiego si portano dietro copie che nessuno chiedera'",
    );
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("la provenienza resta in chiaro", () => {
  /* `build-info.js` lo rigenera chi costruisce il pacchetto di rilascio, e lo
   * sostituisce dentro lo zip. Una copia compressa di quello di prima direbbe
   * la versione sbagliata — e la direbbe vincendo, perche' aiohttp serve la
   * copia compressa quando c'e'. Sono trecento byte: resta in chiaro. */
  const radice = cartellaFinta();
  try {
    comprimiGliAsset(radice);
    assert.ok(!existsSync(join(radice, "legacy/build-info.js.gz")));
    assert.ok(!existsSync(join(radice, "legacy/build-info.js.br")));
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("ripulire porta via anche le copie compresse", () => {
  /* Chi sviluppa apre la plancia dai sorgenti. Una copia compressa dimenticata
   * li' verrebbe servita al posto del file che sta modificando, e lo lascerebbe
   * a chiedersi perche' le sue modifiche non si vedono. */
  const radice = cartellaFinta();
  try {
    comprimiGliAsset(radice);
    assert.ok(existsSync(join(radice, "legacy/grosso.js.gz")));
    togliLeCopieCompresse(radice);
    assert.ok(!existsSync(join(radice, "legacy/grosso.js.gz")));
    assert.ok(!existsSync(join(radice, "legacy/grosso.js.br")));
    assert.ok(existsSync(join(radice, "legacy/grosso.js")), "ha portato via anche l'originale");
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

test("le copie compresse non entrano fra gli asset che l'integrazione registra", () => {
  /* `_runtime_assets` filtra per suffisso, e da quell'elenco escono sia le
   * rotte sia la firma della cartella. Se `.gz` o `.br` ci entrassero: un
   * indirizzo nuovo a ogni rilascio per niente, e il doppio dei byte letti a
   * ogni avvio solo per calcolare la firma. */
  const py = readFileSync(join(RADICE, "custom_components/dashboardmodern/frontend.py"), "utf8");
  const elenco = py.match(/ASSET_SUFFIXES = frozenset\(\s*\{(.*?)\}\s*\)/s)?.[1];
  assert.ok(elenco, "non trovo piu' l'elenco dei suffissi serviti");
  assert.ok(!elenco.includes('".gz"'), "le copie gzip finirebbero fra gli asset registrati");
  assert.ok(!elenco.includes('".br"'), "le copie brotli finirebbero fra gli asset registrati");
});

test("i gusci messi da parte non viaggiano dentro il pacchetto di rilascio", () => {
  /* Prima le copie di lavoro stavano accanto ai documenti, dentro la cartella
   * dell'integrazione: chi costruisce il pacchetto prende tutto quello che
   * trova li', e cosi' partivano per il mondo due documenti da centosei kB che
   * nessuno avrebbe mai chiesto. */
  const dove = copiaDi("legacy/dashboard.html");
  assert.ok(
    !dove.includes("custom_components"),
    `la copia di lavoro finisce dentro l'integrazione: ${dove}`,
  );
});
