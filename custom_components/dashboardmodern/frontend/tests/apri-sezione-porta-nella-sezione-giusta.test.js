/* «Il tasto "Apri sezione" del widget porte apre ancora la sezione Sicurezza
 * invece che la sua nuova» (#501).
 *
 * Le porte e i cancelli sono usciti dalla Sicurezza con la #275: hanno la loro
 * pagina, «Apri porte», e la loro voce nella barra. La tavola che dice a quale
 * sezione porta ogni tessera era rimasta indietro, e il tasto in fondo alla
 * finestra portava in una pagina dove quelle porte non ci sono piu'.
 *
 * Il difetto vero non e' una riga sbagliata: e' che quella tavola scrive a mano
 * nomi di voci che le sezioni dichiarano per conto loro, e nessuno accorgeva
 * quando le due cose smettevano di dire la stessa cosa. Questa prova e' il
 * posto dove se ne accorge: il nome scritto nella tavola deve essere quello
 * esportato dalla sezione, e una tessera che una pagina ce l'ha deve avere la
 * sua riga.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { ALLERTE_TAB } from "../src/sections/allerte-section.js";
import { BATTERIE_TAB } from "../src/sections/batterie-section.js";
import { CALENDARIO_TAB } from "../src/sections/calendario-section.js";
import { CITOFONO_TAB } from "../src/sections/citofono-section.js";
import { LIGHTS_TAB } from "../src/sections/lights-page-section.js";
import { MEDIA_TAB } from "../src/sections/media-player-section.js";
import { PRESE_TAB } from "../src/sections/prese-section.js";
import { PRESENZA_TAB } from "../src/sections/presenza-section.js";
import { RIFIUTI_TAB } from "../src/sections/rifiuti-section.js";
import { ROBOT_TAB } from "../src/sections/robot-section.js";
import { APERTURE_TAB } from "../src/sections/security-doors-section.js";
import { STAMPANTI_TAB } from "../src/sections/stampanti-section.js";
import { UPS_TAB } from "../src/sections/ups-section.js";
import { VARCHI_TAB } from "../src/sections/varchi-section.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

/* Le costanti che la tavola puo' nominare invece di battere il nome a mano.
 * Scritte cosi', qui si risolvono e il paragone vale lo stesso. */
const COSTANTI = Object.freeze({
  ALLERTE_TAB,
  APERTURE_TAB,
  BATTERIE_TAB,
  CALENDARIO_TAB,
  CITOFONO_TAB,
  LIGHTS_TAB,
  MEDIA_TAB,
  PRESE_TAB,
  PRESENZA_TAB,
  RIFIUTI_TAB,
  ROBOT_TAB,
  STAMPANTI_TAB,
  UPS_TAB,
  VARCHI_TAB,
});

/* La tavola, letta dal sorgente: e' un letterale congelato, e leggerlo qui
 * costa meno che montare mezza plancia per chiederglielo. */
function tavolaDelleSezioni() {
  const inizio = SORGENTE.indexOf("const SEZIONE_DEL_WIDGET = Object.freeze({");
  assert.ok(inizio > 0, "la tavola delle sezioni deve esistere");
  const fine = SORGENTE.indexOf("});", inizio);
  const corpo = SORGENTE.slice(inizio, fine);
  const coppie = {};
  for (const riga of corpo.split("\n")) {
    const pulita = riga.trim();
    if (pulita.startsWith("/*") || pulita.startsWith("*")) continue;
    const trovato = pulita.match(/^([a-z]+):\s*("([a-z0-9-]+)"|([A-Z_]+)),$/);
    if (!trovato) continue;
    const nome = trovato[4];
    if (nome) {
      assert.ok(nome in COSTANTI, `la costante «${nome}» non e' fra quelle note a questa prova`);
      coppie[trovato[1]] = COSTANTI[nome];
    } else coppie[trovato[1]] = trovato[3];
  }
  return coppie;
}

test("la tessera delle porte apre «Apri porte», non la Sicurezza", () => {
  const tavola = tavolaDelleSezioni();
  assert.equal(tavola.porte, APERTURE_TAB);
  assert.equal(APERTURE_TAB, "porte");
  assert.notEqual(tavola.porte, "security");
  /* E scritta con la costante della sezione, non col nome battuto a mano: e'
   * il modo di non ritrovarsi indietro alla prossima volta. */
  assert.match(SORGENTE, /\n  porte: APERTURE_TAB,/);
});

test("ogni tessera che ha una pagina ha la sua riga, col nome che la pagina dichiara", () => {
  const tavola = tavolaDelleSezioni();
  /* Le sezioni che dichiarano la loro voce: il nome nella tavola deve essere
   * quello, o il tasto porta altrove — che e' esattamente la #501. */
  const dichiarate = {
    luci: LIGHTS_TAB,
    prese: PRESE_TAB,
    varchi: VARCHI_TAB,
    presenza: PRESENZA_TAB,
    batterie: BATTERIE_TAB,
    citofono: CITOFONO_TAB,
    stampanti: STAMPANTI_TAB,
    ups: UPS_TAB,
    agenda: CALENDARIO_TAB,
    rifiuti: RIFIUTI_TAB,
    robot: ROBOT_TAB,
    allerte: ALLERTE_TAB,
    media: MEDIA_TAB,
  };
  for (const [tessera, voce] of Object.entries(dichiarate)) {
    const scritto = tavola[tessera];
    assert.ok(scritto, `la tessera «${tessera}» deve sapere dove portare`);
    assert.equal(scritto, voce, `la tessera «${tessera}» porta nella sezione sbagliata`);
  }
});

test("chi non ha una pagina non ha una riga, e il tasto non compare", () => {
  const tavola = tavolaDelleSezioni();
  /* Fumo e allagamenti sono avvisi: compaiono in Home da soli quando hanno
   * qualcosa da dire, e una pagina loro non ce l'hanno. L'aria si configura
   * dalla scheda Allerte ma le sue misure quella pagina non le mostra: un
   * tasto che ci portasse aprirebbe una pagina senza quello che si stava
   * guardando. E le tessere che sono elenchi della Home — quelle in evidenza,
   * gli aggiornamenti, le segnalazioni — non sono una sezione. */
  for (const senzaPagina of [
    "fumo",
    "allagamenti",
    "aria",
    "evidenza",
    "aggiornamenti",
    "segnalazioni",
  ])
    assert.equal(tavola[senzaPagina], undefined, `«${senzaPagina}» non ha una pagina dove andare`);
  /* E chi disegna il tasto lo chiede alla tavola: senza voce, niente piede. */
  assert.match(SORGENTE, /function piedeDellaSezione\(widget\) \{\n  if \(!voceDellaSezione\(widget\.key\)\) return "";/);
  assert.match(SORGENTE, /const vaiAllaSezione = piedeDellaSezione\(widget\);/);
});

/* Il piede si rifa' a ogni giro, non solo all'apertura (trovato lavorando alla
 * #501).
 *
 * La voce di una sezione la crea il suo modulo, e puo' nascere DOPO che la
 * tessera e' stata aperta — su un telefono, dove la plancia parte piu' adagio,
 * capita davvero. Disegnato una volta sola, il tasto non c'era e non compariva
 * piu' finche' non si chiudeva e si riapriva la finestra. */
test("il tasto si rifa' a ogni giro: una voce nata dopo lo fa comparire", () => {
  const inizio = SORGENTE.indexOf("if (state.expanded === widget.key) {");
  assert.notEqual(inizio, -1);
  const corpo = SORGENTE.slice(inizio, SORGENTE.indexOf("const body = doc.querySelector", inizio));
  assert.match(corpo, /const vuole = piedeDellaSezione\(widget\);/);
  /* E nei due sensi: chi nasce dopo compare, chi si spegne se ne va — un tasto
   * che promette una pagina spenta e' peggio di nessun tasto. */
  assert.match(corpo, /if \(!vuole\) piede\?\.remove\(\);/);
  assert.match(corpo, /else if \(!piede\) scheda\.insertAdjacentHTML\("beforeend", vuole\);/);
});
