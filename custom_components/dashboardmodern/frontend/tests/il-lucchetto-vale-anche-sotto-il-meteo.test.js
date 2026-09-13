/* «Ho bloccato una entità "luci" che non si deve spegnere. Sulla home, nel
 *  widget basso premendo su LUCI, mi rileva accesa e non me la fa spegnere,
 *  mentre sotto la barra meteo sul riassunto di casa premendo sulle luci
 *  accese, quell'entità mi mette il pulsante "spegni" e la spengo.» (#539)
 *
 * Il lucchetto c'era e funzionava: la pagina delle Luci, le Prese, gli
 * impianti termici e il widget della Home lo chiedono tutti alla stessa
 * funzione, `siComanda`. La finestra che la fascia sotto il meteo apre — nata
 * dopo, con la 1.4.24 — non lo chiedeva a nessuno.
 *
 * Un blocco che vale in un posto e non nell'altro non è un blocco: è una cosa
 * in più da ricordarsi, e la si scopre nel momento peggiore, cioè quando la
 * luce si spegne.
 *
 * Le due cose da difendere sono che il tasto non si offra e che il comando non
 * parta: la seconda conta quanto la prima, perché un tasto che sparisce ma un
 * servizio che risponde lascia il buco dov'era.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(
  new URL("../src/sections/come-sta-la-casa-section.js", import.meta.url),
  "utf8",
);

test("la finestra di cosa è acceso chiede il lucchetto alla funzione di tutti", () => {
  /* Non una copia della regola scritta di qua: la stessa funzione che usano la
   * pagina delle Luci, le Prese e il widget. */
  assert.match(sorgente, /import \{[^}]*\bsiComanda\b[^}]*\} from "\.\/shared\.js";/s);
});

test("il tasto non si offre su un'entità bloccata", () => {
  assert.match(sorgente, /const tasto =\s*\n?\s*comando && siComanda\(entita\)/);
});

test("e il comando si rifiuta anche se qualcuno lo fa partire lo stesso", () => {
  /* La regola non sta nel tasto. Un tasto grigio che poi funziona sarebbe
   * peggio di un tasto normale — è la stessa frase che sta in `shared.js`. */
  const corpo = sorgente.slice(sorgente.indexOf("function spegni(entita)"));
  const fine = corpo.indexOf("\n}");
  const dentro = corpo.slice(0, fine);
  assert.match(dentro, /if \(!siComanda\(entita\)\) return false;/);
  /* E il rifiuto viene PRIMA di chiamare Home Assistant. */
  assert.ok(
    dentro.indexOf("siComanda") < dentro.indexOf("dmCallHaService"),
    "il blocco si controlla prima di chiamare il servizio",
  );
});
