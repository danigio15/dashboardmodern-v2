/* «I dati della wallbox sono ancora sbagliati: il totale consumato da inizio
 *  anno e' 1440,76 kWh.» La plancia ne diceva 546. Anche sulla 1.4.15, cioe'
 *  dopo che la correzione era uscita.
 *
 * Perche' i quattro riquadri del TOTALE ANNO avevano due padroni.
 *
 * Il conto giusto e' il nostro: si chiedono al Recorder i GIORNI e si sommano
 * (`mesiDaiGiorni`). Il conto sbagliato e' quello del guscio storico, in
 * `edCalcolaTotaliAnnoDispositivo`: chiede gli intervalli MENSILI e ne somma i
 * `change`, che su un contatore che si azzera ogni mese — quello mensile di
 * una wallbox e' esattamente questo — da' il divario fra due mesi al posto del
 * consumo di uno.
 *
 * Quella funzione non era stata spenta, e nessuno la attende: il guscio la
 * lancia e tira avanti. Scriveva «⏳ —», partiva con la sua domanda mensile, e
 * quando la risposta arrivava — dopo un giro in rete, quindi dopo di noi —
 * riscriveva i riquadri col numero vecchio. Vinceva sempre, perche' scriveva
 * per ultima. La correzione era nel codice e non arrivava sullo schermo.
 *
 * Adesso il padrone e' uno. Della vecchia resta il solo gesto che vale —
 * mettere i riquadri in attesa, senza cui cambiando dispositivo resterebbero i
 * numeri di quello di prima — e la domanda mensile non si fa piu'.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sezione = new URL("../src/sections/energy-section.js", import.meta.url);
const guscio = new URL("../legacy/dashboard-runtime-it.js", import.meta.url);

test("il totale anno del guscio si sostituisce, non si affianca", async () => {
  const source = await readFile(sezione, "utf8");
  assert.match(source, /function spegniIlTotaleAnnoDelGuscio\(\)/);
  /* Sostituzione: si prende il posto della funzione sul globale. `wrapFunction`
   * qui non servirebbe a niente — chiama sempre l'originale, e l'originale e'
   * proprio quello che riscriveva il numero vecchio. */
  assert.match(source, /root\.edCalcolaTotaliAnnoDispositivo = nostra;/);
  assert.doesNotMatch(source, /wrapFunction\("edCalcolaTotaliAnnoDispositivo"/);
  /* E l'originale non si chiama: niente domanda mensile, che era anche un giro
   * di Recorder buttato a ogni apertura. */
  assert.doesNotMatch(source, /precedente\.(?:apply|call)\(/);
});

test("si installa col resto, e due volte non fa danno", async () => {
  const source = await readFile(sezione, "utf8");
  assert.match(source, /spegniIlTotaleAnnoDelGuscio\(\);/);
  /* Il marchio e' la guardia: `installWrappers` gira piu' volte — all'avvio,
   * su `legacy-ready` e su `pageshow` — e la seconda non deve incatenare una
   * sostituzione sopra la precedente. */
  assert.match(source, /precedente\.__dmTotaleAnno\) return false;/);
  assert.match(source, /nostra\.__dmTotaleAnno = true;/);
});

test("i riquadri restano in attesa, cosi' cambiando dispositivo non mentono", async () => {
  const source = await readFile(sezione, "utf8");
  assert.match(source, /function iRiquadriDellAnnoAspettano\(selYear\)/);
  for (const id of [
    "ed-dkpi-anno-risp-eur",
    "ed-dkpi-anno-risp-kwh",
    "ed-dkpi-anno-costo-eur",
    "ed-dkpi-anno-costo-kwh",
  ])
    assert.match(source, new RegExp(`"${id}"`), id);
  assert.match(source, /for \(const id of RIQUADRI_DELL_ANNO\) setText\(id, "⏳ —"\);/);
  /* E la nostra passata parte subito dopo: e' lei che ci mette i numeri. */
  assert.match(source, /iRiquadriDellAnnoAspettano\(selYear\);\s*scheduleProjection\(\);/);
});

test("il ritardo del guscio non si aspetta piu': la sostituzione non torna una promessa", async () => {
  const source = await readFile(sezione, "utf8");
  /* La vecchia era `async`, e il suo ritardo era tutto il difetto. La nostra
   * non ha niente da attendere — e chi la chiamava non l'attendeva comunque. */
  assert.match(source, /function nostra\(_sensor, selYear\) \{/);
  assert.doesNotMatch(source, /async function nostra\(/);
});

/* Il fatto su cui questa correzione si appoggia, tenuto fermo qui perche' se
 * cambia la correzione smette di funzionare in silenzio.
 *
 * Il guscio chiama `edCalcolaTotaliAnnoDispositivo` dal PROPRIO interno, da
 * dentro `edCaricaDettaglio`. Sostituire la funzione sul globale arriva a
 * quella chiamata soltanto perche' il guscio e' uno script classico e la
 * dichiarazione sta al livello superiore: cosi' e' una proprieta' dell'oggetto
 * globale, e l'identificatore si risolve li' al momento della chiamata.
 *
 * Se un giorno il guscio diventasse un modulo, o finisse dentro un involucro,
 * la dichiarazione non sarebbe piu' sul globale e la sostituzione verrebbe
 * ignorata: il numero vecchio tornerebbe sullo schermo senza che nessun rosso
 * lo dica. Questa prova e' il rosso.
 */
test("il guscio dichiara quella funzione al livello superiore, e non e' un modulo", async () => {
  const source = await readFile(guscio, "utf8");
  assert.match(
    source,
    /^async function edCalcolaTotaliAnnoDispositivo\(sensor, selYear\) \{/m,
    "se non e' piu' al livello superiore, la sostituzione sul globale non la raggiunge",
  );
  /* Non `let` e non `const`: quelle vivono nel registro dichiarativo dello
   * script e non sull'oggetto globale, quindi non si sostituiscono. */
  assert.doesNotMatch(source, /^(?:let|const|var) edCalcolaTotaliAnnoDispositivo\b/m);
  /* E il file non e' avvolto: gli involucri che ha sono piccoli e con un nome,
   * non uno che si chiude in fondo intorno a tutto. */
  assert.doesNotMatch(source, /^\(function\s*\(\s*\)\s*\{/m);
});
