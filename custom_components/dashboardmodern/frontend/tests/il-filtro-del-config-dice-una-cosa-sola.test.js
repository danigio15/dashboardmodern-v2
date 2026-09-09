/* «Il filtro dell'alberatura non va: parte su Plancia ma in realta' vedo
 *  tutto, e se clicco Tutte resta cliccato anche l'altro.»
 *
 * Erano due difetti nello stesso posto.
 *
 * Il primo: l'accensione di un chip voleva dire due cose diverse a seconda di
 * quale chip fosse. Sulle famiglie diceva «la scheda aperta e' di questa
 * famiglia»; su «Tutte» diceva «non stai filtrando». A riposo erano vere
 * entrambe, quindi si accendevano in due — «Plancia» e «Tutte» — e chi
 * guardava vedeva due tasti scelti. Il filtro vero, poi, lo diceva un terzo
 * segno: un anello. Tre segni per due frasi.
 *
 * Il secondo: il Config si apriva sulla Plancia ma senza filtrare niente. Il
 * chip diceva Plancia e la colonna mostrava tutte le sezioni; non c'era modo
 * di sapere quale delle due contasse.
 *
 * Adesso: acceso vuol dire «e' questo che stai vedendo», e lo e' per un chip
 * solo. E partire sulla Plancia vuol dire vedere la Plancia.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sezione = new URL("../src/sections/alberatura-del-config-section.js", import.meta.url);

test("acceso lo e' il chip che filtra, e non quello della scheda aperta", async () => {
  const source = await readFile(sezione, "utf8");
  /* La classe segue la scelta, non la scheda. */
  assert.match(
    source,
    /class="dm-alberatura-famiglia\$\{voce\.chiave === scelta \? " active" : ""\}"/,
  );
  /* E la famiglia della scheda aperta non decide piu' l'accensione: dentro la
   * costruzione della fila quella variabile non serve piu' a nessuno. */
  assert.doesNotMatch(source, /voce\.chiave === attiva \? " active" : ""/);
});

test("il filtro non porta piu' un anello: un segno solo per una frase sola", async () => {
  const source = await readFile(sezione, "utf8");
  assert.doesNotMatch(source, /\[aria-pressed="true"\]\{\s*box-shadow/);
  /* `aria-pressed` resta: e' quello che un lettore di schermo deve sentire. */
  assert.match(source, /aria-pressed="\$\{voce\.chiave === scelta \? "true" : "false"\}"/);
});

test("a riposo si accende «Tutte», da sola: e' vero, si vede tutto", async () => {
  const source = await readFile(sezione, "utf8");
  /* Il Config si apre senza filtro — `famiglia: ""` — e in quello stato
   * l'unico chip acceso e' «Tutte». Nessuna famiglia si accende per il fatto
   * che la scheda aperta e' la sua: era quella la seconda accensione. */
  assert.match(source, /famiglia: "",\n\}\);/);
  assert.match(source, /dm-alberatura-tutte\$\{scelta \? "" : " active"\}/);
});
