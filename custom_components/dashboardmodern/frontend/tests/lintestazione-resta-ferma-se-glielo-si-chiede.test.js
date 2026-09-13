/* «Valutare se mettere un'opzione che tiene fissa tutta la parte iniziale, e
 * se uno scorre verso il basso vede il resto» (#521).
 *
 * La parte iniziale è l'intestazione: hamburger, nome della casa, meteo e ora.
 * Qui si prova quello che si può provare senza uno schermo — dove sta la
 * scelta, che nasce spenta, che resta su questo apparecchio e che porta la sua
 * risposta addosso al documento e non su un nodo che il guscio rifà.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");
const sezione = leggi("sections/testa-fissa-section.js");

test("nasce spenta: chi non la chiede non se la ritrova", () => {
  /* Su un telefono quella striscia è un quinto dello schermo, e tenerla ferma
   * vuol dire leggere il resto da una feritoia. Chi la vuole l'accende. */
  assert.match(sezione, /getItem\?\.\(CASELLA\) === "1"/);
  assert.match(sezione, /setItem\?\.\(CASELLA, vera \? "1" : "0"\)/);
});

test("resta su questo apparecchio, come il chiosco e il tema", () => {
  /* Il tablet appeso al muro la vuole ferma, il telefono no: sincronizzarla
   * renderebbe impossibile averle tutt'e due. */
  assert.match(sezione, /const CASELLA = "dm_testa_fissa"/);
  const guardia = readFileSync(
    new URL("./nessuna-configurazione-resta-a-terra.test.js", import.meta.url),
    "utf8",
  );
  assert.match(guardia, /dm_testa_fissa:/);
});

test("l'attributo sta sulla radice, non sull'intestazione", () => {
  /* L'intestazione la ridisegna il guscio a ogni giro: una classe scritta su
   * un nodo che viene rifatto è una classe che sparisce da sola. */
  assert.match(sezione, /doc\?\.documentElement/);
  assert.match(sezione, /radice\.setAttribute\(ATTRIBUTO, "true"\)/);
  assert.match(sezione, /radice\.removeAttribute\(ATTRIBUTO\)/);
});

test("si tiene ferma con sticky, non con fixed", () => {
  /* Sticky resta dentro il flusso: la pagina sotto non ci va a finire dietro e
   * non serve compensare l'altezza a mano — che è il modo in cui queste cose
   * si rompono al primo schermo di dimensione diversa. */
  assert.match(sezione, /position:sticky;top:0/);
  assert.doesNotMatch(sezione, /position:fixed/);
  /* E non su uno schermo basso, dove del resto resterebbe una feritoia. */
  assert.match(sezione, /@media \(min-height:560px\)/);
});

test("l'interruttore sta in ⚙️ Impostazioni accanto al chiosco", () => {
  const condiviso = leggi("sections/shared.js");
  assert.match(condiviso, /testaFissa: 17/);
  /* Fra il chiosco (15) e Assist (20): sono la stessa famiglia di scelte. */
  assert.match(condiviso, /chiosco: 15/);
  assert.match(sezione, /ORDINE_IMPOSTAZIONI\.testaFissa/);
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /import \{ installTestaFissa \} from "\.\/testa-fissa-section\.js";/);
  assert.match(runtime, /installTestaFissa\(\);/);
});

test("vale in tutti e due i posti dove l'intestazione può stare", () => {
  /* L'intestazione sta sotto body, ma chi la mette in fila fra i blocchi della
   * Home la sposta dentro #page-home (`portaLaTestataInPagina`). Col solo
   * `body > header` la testa ferma smetteva di funzionare proprio nella pagina
   * in cui l'utente l'aveva spostata, e tornava a funzionare uscendo dalla
   * Home — il contrario di quello che chiede chi la accende. */
  assert.match(sezione, /body > header,\s*\n\s*html\[\$\{ATTRIBUTO\}="true"\] #page-home > header\{/);
  assert.match(
    sezione,
    /body > header::before,\s*\n\s*html\[\$\{ATTRIBUTO\}="true"\] #page-home > header::before\{/,
  );
  /* E quel trasloco esiste davvero: se un giorno cambia nome o destinazione,
   * questa riga lo dice prima che la testa ferma smetta di funzionare. */
  const blocchi = leggi("sections/home-blocchi-section.js");
  assert.match(blocchi, /pagina\.prepend\(testata\)/);
});
