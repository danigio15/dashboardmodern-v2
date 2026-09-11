/* «In the home configuration, it is possible to change the position of the
 * blocks; it would be nice if it were also possible to change the position of
 * the header containing the weather» (#492).
 *
 * L'intestazione col meteo e l'ora e' un riquadro solo — bordo, fondo, il
 * meteo dentro e l'orologio accanto — e stava inchiodato sotto il nome della
 * casa. Adesso e' un blocco della Home come gli altri: finche' sta per primo
 * resta dov'e' sempre stato, e da qualunque altro posto scende in pagina e si
 * mette in fila.
 *
 * Tre cose da difendere, e sono tutte e tre modi di rompere una Home che
 * funzionava.
 *
 * La prima: chi si era gia' riordinato la Home non deve, per il solo fatto di
 * aggiornare, ritrovarsi il meteo staccato dall'intestazione. La prova sta
 * nell'ordine dei blocchi, con gli altri.
 *
 * La seconda: il riquadro e' UNO. Cercarlo solo dentro l'intestazione, da
 * quando puo' stare altrove, vuol dire fabbricarne un secondo — due riquadri
 * col meteo, e l'orologio in quello sbagliato.
 *
 * La terza: quello che rende piccolo il meteo dentro il riquadro deve seguire
 * il riquadro. Era scritto addosso all'intestazione, e il riquadro spostato si
 * ritrovava il meteo alla taglia da card intera: icona a settanta, temperatura
 * a cinquantadue, cioe' esattamente quello che si era tolto di mezzo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  BLOCCHI_DELLA_HOME,
  BLOCCO_DEL_METEO,
  CHIAVE_ORDINE_BLOCCHI,
  ilMeteoStaInTestata,
} from "../src/core/ordine-dei-blocchi.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("il meteo e' un blocco della Home, e di serie e' il primo", () => {
  assert.ok(BLOCCHI_DELLA_HOME.includes(BLOCCO_DEL_METEO));
  assert.equal(BLOCCHI_DELLA_HOME[0], BLOCCO_DEL_METEO);
  /* Primo vuol dire «sopra tutto», e sopra tutto e' l'intestazione: chi non ha
   * mai toccato niente non deve vedere la Home muoversi di un pixel. */
  assert.equal(ilMeteoStaInTestata(null), true);
  /* E non si inventa una chiave nuova: l'ordine si scrive dove si e' sempre
   * scritto, che e' anche il motivo per cui non serve una migrazione. */
  assert.equal(CHIAVE_ORDINE_BLOCCHI, "cd_home_blocchi");
  assert.ok(CONFIG_KEYS.includes(CHIAVE_ORDINE_BLOCCHI));
});

test("il riquadro e' uno solo: si cerca dovunque sia, non solo in testata", () => {
  const sorgente = leggi("sections/weather-in-masthead-section.js");
  /* Il difetto che questa riga impedisce: `header.querySelector(...)` trovava
   * il nulla appena il riquadro era sceso in pagina, e ne fabbricava un altro
   * nell'intestazione. */
  assert.match(sorgente, /let riga = doc\.querySelector\("\.dm-testata-riga"\);/);
  assert.doesNotMatch(sorgente, /querySelector\(":scope > \.dm-testata-riga"\)/);
  /* E dove va lo decide l'ordine dei blocchi, non questa sezione da sola. */
  assert.match(sorgente, /function casaDellaRiga\(\)/);
  assert.match(sorgente, /ilMeteoStaInTestata\(readJson\(CHIAVE_ORDINE_BLOCCHI, null\)\)/);
  /* Gia' a casa non si tocca: in pagina il posto preciso lo decide chi mette
   * in fila i blocchi, e rimetterlo in fondo a ogni giro sarebbe una lite. */
  assert.match(sorgente, /if \(riga\.parentElement === casa\) return riga;/);
});

test("la taglia piccola del meteo segue il riquadro, non l'intestazione", () => {
  const sorgente = leggi("sections/weather-in-masthead-section.js");
  const stile = sorgente.slice(sorgente.indexOf("const STILE = "), sorgente.indexOf("export function"));
  /* Nessuna regola che riguardi il riquadro o quello che ci sta dentro puo'
   * restare appesa all'intestazione: li' il riquadro non ci sta piu' sempre. */
  const appese = [...stile.matchAll(/header\.dm-testata-col-meteo ([.#][\w-]+)/g)].map(
    (pezzo) => pezzo[1],
  );
  assert.deepEqual(
    [...new Set(appese)].sort(),
    /* Queste tre sono davvero dell'intestazione: il nome della casa, il suo
     * involucro e il tasto del menu. Restano dove sono. */
    [".brand-text", ".ha-menu-btn", ".header-left-wrap"],
  );
  /* E quelle del riquadro pesano quanto prima: senza il «body» davanti,
   * «.dm-testata-riga .weather-widget» vale due classi e il fondo scuro del
   * guscio — «html[data-theme=dark] .weather-widget», due classi piu' un
   * elemento — tornerebbe a vincere, rimettendo il gradiente da card intera
   * dentro il riquadro. */
  assert.match(stile, /body \.dm-testata-riga \.weather-widget\{/);
  assert.match(stile, /body \.dm-testata-riga \.w-icon\{/);
  /* Sceso in pagina, lo stacco da quello che viene dopo se lo mette lui: nella
   * testata glielo dava il «row-gap» della testata, che in pagina non c'e'. */
  assert.match(stile, /#page-home>\.dm-testata-riga\{margin:0 0 18px\}/);
});

test("chi mette in fila i blocchi sa che il meteo e' uno di loro", () => {
  const sorgente = leggi("sections/home-blocchi-section.js");
  /* Il riquadro conta come blocco solo quando e' sceso in pagina: `dentro`
   * torna null per chi non e' figlio della Home, e finche' sta in testata non
   * c'e' niente da mettere in fila. */
  assert.match(
    sorgente,
    /if \(nome === BLOCCO_DEL_METEO\)\s*\n\s*return \[dentro\(doc\.querySelector\("\.dm-testata-riga"\)\)\]\.filter\(Boolean\);/,
  );
  /* E ha un nome nella scheda: una riga senza etichetta non si sposta. */
  assert.match(sorgente, /meteo: \["\u{1F324}️", t\("Intestazione col meteo", "Weather header"\)\]/u);
  /* Alla freccia il riquadro cambia casa PRIMA che si rimetta in fila: dopo,
   * sarebbe una fila con un blocco in meno, e lo si vedrebbe muoversi solo al
   * prossimo giro di stati. */
  assert.match(
    sorgente,
    /writeJsonIfChanged\(CHIAVE_ORDINE_BLOCCHI, prossima\);[\s\S]{0,500}?rigaDellaTestata\(\);\s*\n\s*applicaLOrdineDeiBlocchi\(\);/,
  );
});
