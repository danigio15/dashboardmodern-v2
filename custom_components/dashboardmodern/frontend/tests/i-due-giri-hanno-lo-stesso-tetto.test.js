/* Le stesse prove, girate due volte, devono avere lo stesso tetto di tempo.
 *
 * La 1.4.16 non e' uscita, e niente era rosso. Il cancello del rilascio
 * (`release.yml`) dava venticinque minuti per shard dove il giro che autorizza
 * il merge (`e2e.yml`) ne dava trenta: gli stessi test, due budget diversi.
 * Cresciuta la suite, gli shard di WebKit stavano dentro i trenta e venivano
 * troncati ai venticinque — «cancelled» e non «failure», quindi «Publish
 * release» si saltava in silenzio. Un cancello piu' severo del controllo che
 * autorizza il merge non protegge niente: rende impossibile rilasciare quello
 * che e' gia' stato approvato, e lo fa senza dirlo.
 *
 * Il perche' stava scritto in un commento accanto a tutti e due i numeri, e un
 * commento non ferma nessuno. Qui i due numeri si guardano in faccia.
 *
 * E la stessa cosa vale per il tetto della singola prova: quello di serie e'
 * trenta secondi per tutti e tre i browser, ma WebKit su iPad ci mette una
 * volta e mezza gli altri. Chi se n'e' ricordato l'ha scritto a mano nel
 * proprio file — novantacinque volte, in cinquantacinque file — e le prove che
 * cadono sono esattamente quelle a cui nessuno l'ha scritto. Il pavimento sta
 * dove il browser e' dichiarato, e qui si controlla che ci sia per ognuno.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const leggi = (percorso) => readFileSync(join(RADICE, percorso), "utf8");

/* Il lavoro che gira le prove nel browser: e' quello nel contenitore di
 * Playwright, in tutti e due i file. Gli altri lavori dello stesso file — la
 * verifica, la pubblicazione — hanno un tetto loro e non c'entrano. */
function lavoroDelBrowser(yaml) {
  const pezzi = yaml.split(/\n(?= {2}[a-z][a-z0-9-]*:\n)/);
  const trovato = pezzi.find((pezzo) => pezzo.includes("mcr.microsoft.com/playwright"));
  assert.ok(trovato, "nessun lavoro gira le prove nel contenitore di Playwright");
  return trovato;
}

const tetto = (pezzo) => Number(pezzo.match(/^\s*timeout-minutes:\s*(\d+)\s*$/m)?.[1]);

const spartizione = (pezzo) =>
  [...pezzo.matchAll(/-\s*\{\s*project:\s*([\w-]+),\s*shard:\s*(\d+),\s*shards:\s*(\d+)\s*\}/g)]
    .map(([, progetto, pezzoNumero, quanti]) => `${progetto} ${pezzoNumero}/${quanti}`)
    .sort();

const GIRO = lavoroDelBrowser(leggi(".github/workflows/e2e.yml"));
const CANCELLO = lavoroDelBrowser(leggi(".github/workflows/release.yml"));

test("il cancello del rilascio da' lo stesso tempo del giro che autorizza il merge", () => {
  assert.ok(Number.isInteger(tetto(GIRO)), "il giro normale non dichiara un tetto");
  assert.equal(
    tetto(CANCELLO),
    tetto(GIRO),
    "un tetto piu' stretto qui non protegge: tronca gli shard senza farli diventare rossi, " +
      "e la release si salta in silenzio",
  );
});

test("le prove si spartiscono allo stesso modo nei due giri", () => {
  /* Se il rilascio spartisse WebKit in tre dove il giro normale lo spartisce in
   * quattro, ogni pezzo del rilascio sarebbe piu' lungo di un terzo: lo stesso
   * tetto tornerebbe a non bastare, e per la stessa ragione di prima. */
  assert.deepEqual(spartizione(CANCELLO), spartizione(GIRO));
});

test("ogni browser dichiara il proprio tetto per prova, senza fidarsi di quello di serie", () => {
  const config = leggi("playwright.config.js");
  const dentroProgetti = config.slice(config.indexOf("projects: ["));
  const nomi = [...dentroProgetti.matchAll(/name:\s*"([\w-]+)"/g)].map(([, nome]) => nome);
  assert.deepEqual(nomi, ["desktop", "mobile", "webkit-ipad"]);

  for (const nome of nomi) {
    const inizio = dentroProgetti.indexOf(`name: "${nome}"`);
    const fine = dentroProgetti.indexOf('name: "', inizio + 1);
    const pezzo = dentroProgetti.slice(inizio, fine === -1 ? undefined : fine);
    assert.match(
      pezzo,
      /timeout:\s*[\d_]+/,
      `«${nome}» si affida ai trenta secondi di serie: e' il tranello in cui sono cadute ` +
        "le prove lunghe che nessuno si e' ricordato di allungare a mano",
    );
  }

  /* WebKit e' il piu' lento dei tre, e il suo tetto lo dice. */
  const tempo = (nome) =>
    Number(
      dentroProgetti
        .slice(dentroProgetti.indexOf(`name: "${nome}"`))
        .match(/timeout:\s*([\d_]+)/)?.[1]
        .replaceAll("_", ""),
    );
  assert.ok(
    tempo("webkit-ipad") > tempo("desktop"),
    "WebKit ci mette di piu' degli altri due: dargli lo stesso tempo vuol dire " +
      "farlo cadere per primo",
  );
});
