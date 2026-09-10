/* «I numeri dei giorni non selezionati sono neri su uno sfondo di un colore
 *  simile» — solo in dark mode (#425).
 *
 * Il numero era scritto `color:var(--text-color,#0f172a)`. `--text-color` non
 * lo definisce nessuno: non e' un token della plancia — quello si chiama
 * `--text` — e non e' nemmeno un nome del tema di Home Assistant, che dice
 * `--primary-text-color`. Un nome che non esiste vale il suo ripiego, e li' il
 * ripiego era `#0f172a`: il nero del tema chiaro, scritto a mano. Col chiaro
 * non si notava — era il colore giusto per caso — e col fondo scuro restava
 * nero su blu notte.
 *
 * E' una famiglia intera di difetti, non un caso: `--muted`, `--border`,
 * `--accent-color`, `--line-color`, `--tc-rgb`, `--shadow-glass-strong`. Tutti
 * col ripiego del tema chiaro, tutti invisibili finche' qualcuno non accende
 * lo scuro. Non si vedono rileggendo il codice, perche' la riga sembra
 * corretta: dice un nome plausibile.
 *
 * Percio' li conta questa prova. Un nome che nessuno definisce e nessuno
 * scrive dal codice e' un ripiego travestito da variabile: l'elenco qui sotto
 * e' quello che resta, e ognuno ha la sua ragione scritta. Aggiungerne uno
 * nuovo senza una ragione fa fallire la prova.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";

const qui = (path) => new URL(path, import.meta.url);
const leggi = (path) => readFile(qui(path), "utf8");

/* I commenti fuori: dentro c'e' anche il codice raccontato, e un esempio non
 * e' una regola del foglio di stile. */
const senzaCommenti = (testo) => testo.replace(/\/\*[\s\S]*?\*\//g, " ");

async function fileDi(cartella) {
  const nomi = await readdir(qui(cartella));
  return Promise.all(
    nomi
      .filter((nome) => nome.endsWith(".js"))
      .map(async (nome) => ({ nome, testo: await leggi(`${cartella}${nome}`) })),
  );
}

/* Chi la definisce: una regola del foglio (`--nome:`), oppure il codice che la
 * scrive addosso a un elemento — `setProperty("--nome"...)` o uno degli aiuti
 * che ci passano sopra, che il nome lo portano comunque fra virgolette. */
function raccogliDefinite(testo, dentro) {
  for (const trovato of testo.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) dentro.add(trovato[1]);
  for (const trovato of testo.matchAll(/["'`](--[a-zA-Z0-9_-]+)["'`]/g)) dentro.add(trovato[1]);
  return dentro;
}

/* Quelli che restano, e perche'.
 *
 * Sono i nomi del tema di Home Assistant per i colori che vogliono dire la
 * stessa cosa nei due temi: un errore e' rosso sul bianco e sul nero, e il
 * ripiego scritto a mano e' quel rosso li'. Non portano il tema addosso,
 * quindi il ripiego non e' un difetto — e se un giorno HA li passasse
 * davvero, sarebbero i suoi. */
const AMMESSI = new Set(["--error-color", "--success-color", "--warning-color", "--info-color"]);

test("nessuna sezione chiede un colore con un nome che non esiste", async () => {
  const definite = new Set();
  for (const path of [
    "../legacy/dashboard-runtime-it.css",
    "../legacy/dashboard-runtime.css",
    "../legacy/dashboard-runtime-it.js",
  ])
    raccogliDefinite(await leggi(path), definite);

  const sezioni = [...(await fileDi("../src/sections/")), ...(await fileDi("../src/core/"))];
  sezioni.forEach(({ testo }) => raccogliDefinite(testo, definite));

  const orfane = new Map();
  sezioni.forEach(({ nome, testo }) => {
    for (const trovato of senzaCommenti(testo).matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
      const chiesta = trovato[1];
      if (definite.has(chiesta) || AMMESSI.has(chiesta)) continue;
      if (!orfane.has(chiesta)) orfane.set(chiesta, new Set());
      orfane.get(chiesta).add(nome);
    }
  });

  assert.deepEqual(
    [...orfane.entries()].map(([chiesta, dove]) => `${chiesta} (${[...dove].sort().join(", ")})`),
    [],
    "una variabile che nessuno definisce vale sempre il suo ripiego: col tema scuro e' il colore sbagliato",
  );
});

test("il numero del giorno dell'agenda legge il token della plancia", async () => {
  /* La riga della segnalazione, per nome. */
  const agenda = await leggi("../src/sections/calendario-section.js");
  assert.match(agenda, /\.dm-calp-numero\{[^}]*color:var\(--text,#0f172a\)/);
  assert.doesNotMatch(agenda, /--text-color/);
});

test("i nomi del tema di Home Assistant arrivano ai token nostri", async () => {
  /* L'alias della #206: le regole scritte col nome di HA non devono ripiegare
   * sul chiaro. Qui si tiene l'elenco completo di quelli che usiamo. */
  const fondazione = await leggi("../src/sections/theme-foundation-section.js");
  for (const nome of [
    "--card-background-color",
    "--ha-card-background",
    "--primary-background-color",
    "--secondary-background-color",
    "--divider-color",
    "--secondary-text-color",
    "--primary-text-color",
  ])
    assert.match(fondazione, new RegExp(`${nome}:var\\(--`), `manca l'alias di ${nome}`);
});
