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
 * Niente minificazione: il guadagno grosso e' il numero di richieste, e con i
 * nomi veri un errore dal campo si legge ancora. Si potra' aggiungere quando
 * il resto sara' assestato.
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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  return senzaPreload
    .replace(/^[ \t]*<link rel="modulepreload" href="\.\/modules-entry\.js">\n/m, dichiarazione)
    .replace(
      /<script type="module" src="\.\/modules-entry\.js"><\/script>/,
      '<script type="module" src="./pacco/legacy/modules-entry.js"></script>',
    );
}

function scriviIGusci() {
  for (const relativo of GUSCI) {
    const percorso = join(FRONTEND, relativo);
    const html = readFileSync(percorso, "utf8");
    if (html.includes(APERTURA)) continue;
    const fatto = guscioImpacchettato(html);
    if (fatto === html) throw new Error(`${relativo}: non ho trovato dove agganciare il pacchetto`);
    writeFileSync(percorso, fatto);
  }
}

function pulisci() {
  rmSync(PACCO, { recursive: true, force: true });
  execFileSync("git", ["checkout", "--", ...GUSCI], { cwd: FRONTEND, stdio: "inherit" });
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
  console.log("plancia impacchettata in legacy/pacco/");
}

if (process.argv[1] && process.argv[1].endsWith("impacchetta-la-plancia.mjs")) main();
