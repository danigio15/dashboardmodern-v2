/* La plancia in un pacchetto, invece che in centosettantanove file.
 *
 * Dal campo: «impiega ancora troppo tempo in caricamento, soprattutto in primo
 * avvio». Non era il velo — quello se ne va presto — ed era misurabile: al
 * primo avvio il browser scaricava CENTOSETTANTANOVE file JavaScript per
 * quattro megabyte. Non in fila, che sarebbe stato peggio: il documento li
 * precarica tutti insieme. Ma centosettantanove richieste restano
 * centosettantanove richieste, e su HTTP/1.1 il browser ne serve sei per volta
 * — una trentina di ondate prima di avere tutto. Al secondo avvio la cache le
 * tiene, ed e' per questo che si sente solo la prima volta.
 *
 * Qui si mettono insieme. Restano fuori i tredici cataloghi delle lingue —
 * quasi due megabyte, e a una casa ne serve UNO — che continuano ad arrivare
 * uno alla volta quando servono.
 *
 * Poi dal campo e' tornato «nulla e' cambiato», e aveva ragione: le richieste
 * non erano il problema. Chi apre la plancia da fuori casa passa da un tunnel,
 * e li' contano i BYTE — quattro megabyte e mezzo, prima e dopo il pacchetto.
 * Per questo lo script fa una seconda cosa: mette accanto a ogni file una copia
 * gia' compressa, e Home Assistant manda quella. Da 4,9 MB a 1,2.
 *
 * Niente minificazione, e stavolta con una misura sotto: sopra la compressione
 * vale il dieci per cento — 95 kB su 956 — e non vale i nomi veri, che sono
 * quelli che rendono leggibile un errore arrivato dal campo.
 *
 * Lo script si usa cosi':
 *
 *   node scripts/impacchetta-la-plancia.mjs           costruisce il pacchetto
 *   node scripts/impacchetta-la-plancia.mjs --pulisci  torna ai sorgenti
 *
 * Nel deposito i gusci restano quelli dei sorgenti: chi sviluppa apre la
 * plancia e vede i file veri. E' il rilascio a chiamare questo script prima di
 * fare il pacchetto, e i gusci riscritti finiscono solo li' dentro.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = join(RADICE, "custom_components/dashboardmodern/frontend");
const PACCO = join(FRONTEND, "legacy/pacco");
const GUSCI = ["legacy/dashboard.html", "legacy/dashboard-en.html"];

/* I due ingressi della plancia. Il primo lo carica il documento; il secondo
 * lo chiede `config.js` quando il guscio e' pronto, ed e' quello che si porta
 * dietro tutte le sezioni. */
export const INGRESSI = Object.freeze([
  { sorgente: "legacy/modules-entry.js", nel_pacco: "legacy/modules-entry.js" },
  { sorgente: "src/sections/section-runtime.js", nel_pacco: "src/sections/section-runtime.js" },
]);

/* Il segno che il guscio riscritto porta in fronte: da qui si riconosce un
 * documento gia' impacchettato, e --pulisci sa cosa togliere. */
export const APERTURA = "<!-- dm:pacco -->";
const CHIUSURA = "<!-- /dm:pacco -->";

function costruisci() {
  rmSync(PACCO, { recursive: true, force: true });
  mkdirSync(PACCO, { recursive: true });
  execFileSync(
    "npx",
    [
      "esbuild",
      ...INGRESSI.map((voce) => voce.sorgente),
      "--bundle",
      "--format=esm",
      "--splitting",
      "--outbase=.",
      `--outdir=${PACCO}`,
      "--log-level=warning",
    ],
    { cwd: FRONTEND, stdio: "inherit" },
  );
}

/* Il documento senza i suoi centottantuno precaricamenti, e con il pacchetto
 * al loro posto. I precaricamenti vanno tolti per forza: sono richieste che il
 * browser parte a fare comunque, e lasciarle vorrebbe dire scaricare tutto due
 * volte — il pacchetto E i file sciolti. */
export function guscioImpacchettato(html) {
  const senzaPreload = html.replace(
    /^[ \t]*<link rel="modulepreload" href="\.\.\/src\/[^"]*">\n/gm,
    "",
  );
  const dichiarazione =
    `${APERTURA}\n` +
    `<link rel="modulepreload" href="./pacco/legacy/modules-entry.js">\n` +
    `<script>\n` +
    `/* Dove la plancia trova le sue parti, adesso che sono in un pacchetto.\n` +
    `   Senza queste due righe valgono i sorgenti, ed e' cosi' che si sviluppa. */\n` +
    `window.__DASHBOARDMODERN_PACCO_SEZIONI__ = "./pacco/src/sections/section-runtime.js";\n` +
    `window.__DASHBOARDMODERN_CATALOGHI__ = "../../src/i18n/";\n` +
    `window.__DASHBOARDMODERN_IMPACCHETTATA__ = true;\n` +
    `</script>\n` +
    `${CHIUSURA}\n`;
  /* Il ripiego, per davvero.
   *
   * Dichiarare dove sta il pacchetto non basta: se il file non arriva — un
   * aggiornamento a meta', una copia incompleta — il browser resta con un solo
   * indirizzo, quello che non risponde, e la plancia non parte affatto. Il
   * documento deve accorgersene da se'. `onerror` scatta proprio quando lo
   * script non si carica: allora si ritirano le due dichiarazioni, cosi'
   * `config.js` torna a chiedere le sezioni ai sorgenti, e si rimette in pagina
   * l'ingresso di sempre. Il caso peggiore torna a essere «lenta come ieri». */
  const ripiego =
    `<script type="module" src="./pacco/legacy/modules-entry.js" ` +
    `onerror="window.__DASHBOARDMODERN_PACCO_SEZIONI__=null;` +
    `window.__DASHBOARDMODERN_CATALOGHI__=null;` +
    `window.__DASHBOARDMODERN_IMPACCHETTATA__=false;` +
    `var s=document.createElement('script');s.type='module';s.src='./modules-entry.js';` +
    `document.head.appendChild(s)"></script>`;
  return senzaPreload
    .replace(/^[ \t]*<link rel="modulepreload" href="\.\/modules-entry\.js">\n/m, dichiarazione)
    .replace(/<script type="module" src="\.\/modules-entry\.js"><\/script>/, ripiego);
}

/* Il documento com'era prima, messo da parte.
 *
 * `--pulisci` rimetteva i gusci a HEAD con un `git checkout`, e cosi' buttava
 * via anche le modifiche non salvate di chi stava lavorando su quei file: il
 * ciclo `impacchetta` / `impacchetta:pulisci` gli faceva perdere il lavoro.
 * Chiesto in revisione. Adesso si conserva la copia di partenza e si rimette
 * quella: torna esattamente il documento che c'era, salvato o no.
 *
 * Le copie stanno FUORI dalla cartella dell'integrazione: li' dentro finivano
 * dritte nel pacchetto di rilascio — due documenti da centosei kB che nessuno
 * avrebbe mai chiesto, spediti a tutti. */
const RIPOSTIGLIO = join(RADICE, ".gusci-prima-del-pacco");
export const copiaDi = (relativo) =>
  join(RIPOSTIGLIO, `${relativo.replace(/\//g, "_")}.prima-del-pacco`);

function scriviIGusci() {
  mkdirSync(RIPOSTIGLIO, { recursive: true });
  for (const relativo of GUSCI) {
    const percorso = join(FRONTEND, relativo);
    const html = readFileSync(percorso, "utf8");
    if (html.includes(APERTURA)) continue;
    const fatto = guscioImpacchettato(html);
    if (fatto === html) throw new Error(`${relativo}: non ho trovato dove agganciare il pacchetto`);
    writeFileSync(copiaDi(relativo), html);
    writeFileSync(percorso, fatto);
  }
}

/* La plancia gia' compressa, accanto a se stessa.
 *
 * Il pacchetto ha tolto le richieste — da centosettantanove a tre — e dal campo
 * e' tornato «nulla e' cambiato». La diagnostica diceva «impacchettati (3
 * file)», quindi funzionava: erano le richieste a non essere il problema. Chi
 * entra da fuori casa passa da un tunnel, e li' contano i BYTE. Erano 4,9 MB in
 * chiaro, e restavano 4,9 MB anche dopo il pacchetto.
 *
 * Home Assistant serve questi file con aiohttp, e aiohttp guarda da se' se
 * accanto al file ce n'e' uno con lo stesso nome piu' `.br` o `.gz`: se il
 * browser dice di accettarli, manda quello. Verificato: chi chiede `identity`
 * riceve ancora l'originale, quindi non si rompe niente. Non serve toccare una
 * riga di Python — bastano i file.
 *
 * Misurato sui file veri: 4890 kB in chiaro, 1264 in gzip, 956 in brotli.
 * Brotli lo capiscono tutti i browser su HTTPS; gzip serve a chi entra da casa
 * su `http://`, dove Chrome il brotli non lo chiede nemmeno. Quindi tutti e
 * due.
 *
 * Si comprime TUTTO il servibile, senza soglie: un file che oggi supera una
 * soglia e domani non la supera piu' si lascerebbe dietro la copia compressa
 * vecchia, e quella verrebbe servita al posto della nuova. Un guasto muto, e
 * dei peggiori. Meglio qualche `.gz` da trecento byte. */
const DA_COMPRIMERE = Object.freeze(new Set([".js", ".css", ".json", ".html", ".svg"]));
const FUORI_DAL_GIRO = Object.freeze(new Set(["e2e", "tests", "__pycache__", "node_modules"]));
/* `build-info.js` no: il pacchetto di rilascio lo rigenera e lo sostituisce
 * dentro lo zip, e una copia compressa di quello vecchio direbbe la versione
 * sbagliata. Resta in chiaro, e sono trecento byte. */
const SENZA_COPIA_COMPRESSA = "build-info.js";

function* daServire(cartella) {
  for (const voce of readdirSync(cartella)) {
    if (FUORI_DAL_GIRO.has(voce)) continue;
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) yield* daServire(percorso);
    else if (DA_COMPRIMERE.has(extname(voce)) && voce !== SENZA_COPIA_COMPRESSA) yield percorso;
  }
}

export function comprimiGliAsset(radice = FRONTEND) {
  const fatti = [];
  for (const percorso of daServire(radice)) {
    const originale = readFileSync(percorso);
    writeFileSync(`${percorso}.gz`, gzipSync(originale, { level: 9 }));
    writeFileSync(`${percorso}.br`, brotliCompressSync(originale));
    /* Una copia compressa che non torna all'originale e' peggio di nessuna
     * copia: verrebbe servita al posto suo, e nessuno se ne accorgerebbe. */
    if (!gunzipSync(readFileSync(`${percorso}.gz`)).equals(originale))
      throw new Error(`${percorso}: la copia gzip non torna all'originale`);
    if (!brotliDecompressSync(readFileSync(`${percorso}.br`)).equals(originale))
      throw new Error(`${percorso}: la copia brotli non torna all'originale`);
    fatti.push(percorso);
  }
  return fatti;
}

export function togliLeCopieCompresse(cartella) {
  for (const voce of readdirSync(cartella)) {
    if (FUORI_DAL_GIRO.has(voce)) continue;
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) togliLeCopieCompresse(percorso);
    else if (voce.endsWith(".gz") || voce.endsWith(".br")) rmSync(percorso, { force: true });
  }
}

function pulisci() {
  togliLeCopieCompresse(FRONTEND);
  rmSync(PACCO, { recursive: true, force: true });
  for (const relativo of GUSCI) {
    const copia = copiaDi(relativo);
    if (!existsSync(copia)) continue;
    writeFileSync(join(FRONTEND, relativo), readFileSync(copia, "utf8"));
    rmSync(copia, { force: true });
  }
  rmSync(RIPOSTIGLIO, { recursive: true, force: true });
}

function main() {
  if (process.argv.includes("--pulisci")) {
    pulisci();
    console.log("pacchetto tolto: la plancia riparte dai sorgenti");
    return;
  }
  costruisci();
  scriviIGusci();
  const entrata = join(PACCO, "legacy/modules-entry.js");
  if (!existsSync(entrata)) throw new Error("il pacchetto non contiene l'ingresso della plancia");
  /* Per ultima, e non e' un dettaglio: comprime anche i gusci riscritti e il
   * pacchetto appena fatto. Comprimere prima avrebbe messo da parte la
   * versione di prima di tutto il lavoro. */
  const compressi = comprimiGliAsset();
  console.log(
    `plancia impacchettata in legacy/pacco/, ${compressi.length} file con copia .gz e .br`,
  );
}

if (process.argv[1] && process.argv[1].endsWith("impacchetta-la-plancia.mjs")) main();
