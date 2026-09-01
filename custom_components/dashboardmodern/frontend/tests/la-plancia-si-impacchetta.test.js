/* La plancia sta in un pacchetto, e il pacchetto e' completo.
 *
 * Dal campo: «impiega ancora troppo tempo in caricamento, soprattutto in primo
 * avvio». Misurato: al primo avvio il browser scaricava CENTOSETTANTANOVE file
 * JavaScript. Non in fila — il documento li precarica tutti insieme — ma
 * centosettantanove richieste restano centosettantanove richieste, e su
 * HTTP/1.1 il browser ne serve sei per volta.
 *
 * Il pacchetto le riduce a tre. Le due cose che possono andare storte sono
 * l'una il rovescio dell'altra, e questa prova tiene ferme tutt'e due:
 *
 *   - se dal pacchetto manca qualcosa, quella parte della plancia non si
 *     installa piu' — e non se ne accorge nessuno finche' non si apre proprio
 *     quella sezione;
 *   - se nel pacchetto entra tutto, ci finiscono anche i tredici cataloghi
 *     delle lingue: quasi due megabyte a una casa che ne parla UNA, e il
 *     rimedio sarebbe peggio del male.
 *
 * Il documento riscritto si guarda a parte: i precaricamenti dei file sciolti
 * vanno via per forza, o il browser scarica tutto due volte — il pacchetto E i
 * moduli.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const RADICE = join(FRONTEND, "../../..");
const { guscioImpacchettato, INGRESSI } = await import(
  join(RADICE, "scripts/impacchetta-la-plancia.mjs")
);

function fileDentro(cartella) {
  const usciti = [];
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) usciti.push(...fileDentro(percorso));
    else if (voce.endsWith(".js")) usciti.push(percorso);
  }
  return usciti;
}

/* Il pacchetto si costruisce una volta sola: sono due secondi, ma tre prove che
 * lo rifanno da capo sono sei. */
const cartella = mkdtempSync(join(tmpdir(), "dm-pacco-"));
execFileSync(
  "npx",
  [
    "esbuild",
    ...INGRESSI.map((voce) => voce.sorgente),
    "--bundle",
    "--format=esm",
    "--splitting",
    "--outbase=.",
    `--outdir=${cartella}`,
    "--log-level=error",
  ],
  { cwd: FRONTEND, stdio: "inherit" },
);
const PACCO = fileDentro(cartella)
  .map((percorso) => readFileSync(percorso, "utf8"))
  .join("\n");
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

test("nel pacchetto c'e' ogni sezione che il runtime installa", () => {
  const runtime = readFileSync(join(FRONTEND, "src/sections/section-runtime.js"), "utf8");
  const chiamati = [...new Set(runtime.match(/install[A-Za-z0-9]+(?=\(\))/g) || [])];
  /* Non e' un numero tondo per caso: sono le sezioni che compongono la
   * plancia, e se il conto scende di molto vuol dire che la lettura qui sotto
   * ha smesso di funzionare, non che le sezioni sono sparite. */
  assert.ok(chiamati.length > 80, `mi aspettavo un'ottantina di sezioni, ne ho lette ${chiamati.length}`);
  const mancanti = chiamati.filter((nome) => !PACCO.includes(`function ${nome}`));
  assert.deepEqual(mancanti, [], `il pacchetto non installa: ${mancanti.join(", ")}`);
});

test("i cataloghi delle lingue restano fuori dal pacchetto", () => {
  /* `source-index.js` e' il corpus in cui la plancia e' scritta, non una
   * traduzione: quello puo' e deve starci. */
  const dentro = [...new Set(PACCO.match(/src\/i18n\/[a-zA-Z-]+\.js/g) || [])];
  assert.deepEqual(dentro, ["src/i18n/source-index.js"], `traduzioni finite dentro: ${dentro}`);
});

test("il documento impacchettato non precarica piu' i moduli sciolti", () => {
  const html = readFileSync(join(FRONTEND, "legacy/dashboard.html"), "utf8");
  /* Il documento del deposito e' quello dei sorgenti: e' cosi' che si
   * sviluppa, e questa prova gira su di lui. */
  assert.ok(html.includes('src="./modules-entry.js"'), "il documento non e' piu' quello dei sorgenti");
  const primaPreload = (html.match(/modulepreload/g) || []).length;
  assert.ok(primaPreload > 100, `mi aspettavo i precaricamenti dei moduli, ne ho contati ${primaPreload}`);

  const fatto = guscioImpacchettato(html);
  assert.ok(fatto.includes('src="./pacco/legacy/modules-entry.js"'), "il pacchetto non e' agganciato");
  assert.ok(
    fatto.includes('window.__DASHBOARDMODERN_PACCO_SEZIONI__'),
    "manca la dichiarazione di dove stanno le sezioni",
  );
  assert.ok(
    fatto.includes('window.__DASHBOARDMODERN_CATALOGHI__'),
    "manca la dichiarazione di dove stanno i cataloghi",
  );
  /* Restano i due del pacchetto, non i centottanta dei file sciolti. */
  assert.equal((fatto.match(/modulepreload/g) || []).length, 2);
  assert.doesNotMatch(fatto, /modulepreload" href="\.\.\/src\//);
});

test("il pacchetto si porta dentro la provenienza, e va generata prima", () => {
  /* `modules-entry.js` importa `build-info.js`, e chi impacchetta lo mura
   * dentro. Impacchettare PRIMA di generare la provenienza voleva dire murarci
   * la versione e il commit della release precedente: la 1.4.5 sarebbe uscita
   * dicendo di essere la 1.4.4, e il build-info generato dopo non l'avrebbe
   * letto piu' nessuno. Chiesto in revisione, e verificato: nel pacchetto
   * c'era davvero «1.4.4» insieme al commit di ieri. */
  const info = readFileSync(join(FRONTEND, "legacy/build-info.js"), "utf8");
  const versione = info.match(/"dashboardVersion"\s*:\s*"([^"]+)"/)?.[1];
  assert.ok(versione, "build-info.js non dichiara piu' la versione");
  assert.ok(
    PACCO.includes(`"dashboardVersion": "${versione}"`) ||
      PACCO.includes(`"dashboardVersion":"${versione}"`),
    "il pacchetto non si porta dentro la provenienza: chi lo costruisce non la vede",
  );

  const rilascio = readFileSync(join(RADICE, ".github/workflows/release.yml"), "utf8");
  const genera = rilascio.indexOf("generate_build_info.py");
  const impacchetta = rilascio.indexOf("impacchetta-la-plancia.mjs");
  assert.ok(genera > 0 && impacchetta > 0, "il rilascio non fa piu' questi due passi");
  assert.ok(
    genera < impacchetta,
    "il rilascio impacchetta prima di generare la provenienza: la versione murata sarebbe quella vecchia",
  );
});

test("se il pacchetto non arriva, il documento torna ai sorgenti da solo", () => {
  /* Dichiarare dove sta il pacchetto non basta: se il file non risponde — un
   * aggiornamento a meta', una copia incompleta — il browser resta con un solo
   * indirizzo, quello rotto, e la plancia non parte affatto. Chiesto in
   * revisione, ed e' giusto: il ripiego che avevo promesso copriva il caso
   * «guscio non riscritto», non «pacchetto assente». */
  const html = readFileSync(join(FRONTEND, "legacy/dashboard.html"), "utf8");
  const fatto = guscioImpacchettato(html);
  const tag = fatto.match(/<script type="module" src="\.\/pacco[^>]*>/)?.[0] || "";
  assert.match(tag, /onerror=/, "l'ingresso impacchettato non si accorge di non essere arrivato");
  assert.match(tag, /modules-entry\.js/, "il ripiego non rimette in pagina l'ingresso dei sorgenti");
  assert.match(
    tag,
    /__DASHBOARDMODERN_PACCO_SEZIONI__\s*=\s*null/,
    "ripiegando, le sezioni continuerebbero a essere chieste al pacchetto che non c'e'",
  );
  assert.match(
    tag,
    /__DASHBOARDMODERN_CATALOGHI__\s*=\s*null/,
    "ripiegando, i cataloghi continuerebbero a essere cercati accanto al pacchetto",
  );
});

test("ripulire non porta via il lavoro di chi sviluppa", () => {
  /* `--pulisci` rimetteva i gusci a HEAD con un `git checkout`, e cosi'
   * buttava via anche le modifiche non salvate: il ciclo impacchetta /
   * pulisci faceva perdere il lavoro. Chiesto in revisione. */
  const script = readFileSync(join(RADICE, "scripts/impacchetta-la-plancia.mjs"), "utf8");
  assert.doesNotMatch(script, /execFileSync\("git", \["checkout"/);
  assert.match(script, /prima-del-pacco/);
});

test("senza il pacchetto la plancia sa ancora da dove partire", async () => {
  /* Il ripiego non e' un di piu': se il passo che costruisce il pacchetto
   * salta, il documento resta quello dei sorgenti e la plancia deve avviarsi
   * lo stesso — veloce come prima, non rotta. */
  const config = readFileSync(join(FRONTEND, "legacy/config.js"), "utf8");
  assert.match(config, /pacco \? import\(pacco\) : import\("\.\.\/src\/sections\/section-runtime\.js"\)/);

  const { cartellaDeiCataloghi } = await import("../src/core/i18n.js");
  const prima = globalThis.__DASHBOARDMODERN_CATALOGHI__;
  try {
    delete globalThis.__DASHBOARDMODERN_CATALOGHI__;
    assert.equal(cartellaDeiCataloghi(), "../i18n/");
    globalThis.__DASHBOARDMODERN_CATALOGHI__ = "../../src/i18n/";
    assert.equal(cartellaDeiCataloghi(), "../../src/i18n/");
  } finally {
    if (prima === undefined) delete globalThis.__DASHBOARDMODERN_CATALOGHI__;
    else globalThis.__DASHBOARDMODERN_CATALOGHI__ = prima;
  }
});
