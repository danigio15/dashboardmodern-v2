/* La soglia di potenza: quando la casa sta tirando troppo (#508).
 *
 * «Possibilità di avere un campo dove inserire un valore massimo di potenza
 * che fa colorare di color ambra o rosso la card per capire un sovraccarico.»
 *
 * Le prove che contano sono tre, e sono tutte e tre casi in cui la risposta
 * sbagliata si vedrebbe a occhio nudo:
 *
 *   · l'immissione non e' un sovraccarico. Sei chilowatt che escono verso la
 *     rete sono una bella giornata di sole, e una tessera rossa a mezzogiorno
 *     d'agosto sarebbe la funzione che mente;
 *   · «non lo so» non e' «zero». Senza lettura, e senza soglia scritta, non si
 *     colora niente: colorare di verde chi non ha configurato nulla vorrebbe
 *     dire dare una risposta a chi non ha fatto la domanda;
 *   · la virgola. Chi scrive «3,3» non sta sbagliando, e `Number("3,3")` e'
 *     `NaN`: una soglia NaN non colorerebbe mai niente, in silenzio.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  COLORE_AMBRA,
  COLORE_ROSSA,
  LIVELLO_AMBRA,
  LIVELLO_QUIETE,
  LIVELLO_ROSSA,
  SOGLIA_POTENZA_KEY,
  SORGENTE_CASA,
  SORGENTE_RETE,
  coloreDelLivello,
  livelloDellaPotenza,
  sogliaDellaPotenza,
  sogliaScritta,
  wattDaSorvegliare,
} from "../src/core/la-soglia-della-potenza.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, "..");
const sorgente = (percorso) => readFileSync(join(RADICE, percorso), "utf8");

test("una soglia mai scritta non e' una soglia da zero", () => {
  const vuota = sogliaDellaPotenza(undefined);
  assert.equal(vuota.sorgente, SORGENTE_CASA);
  assert.equal(vuota.ambra, null);
  assert.equal(vuota.rossa, null);
  assert.equal(sogliaScritta(vuota), false);
  // E con una soglia che non c'e' non si colora niente, per quanto tiri la casa.
  assert.equal(livelloDellaPotenza(vuota, { casa: 99000 }).livello, LIVELLO_QUIETE);
});

test("la soglia si legge anche com'e' salvata: una stringa JSON", () => {
  const letta = sogliaDellaPotenza('{"sorgente":"rete","ambra":"3000","rossa":"3,3"}');
  assert.equal(letta.sorgente, SORGENTE_RETE);
  assert.equal(letta.ambra, 3000);
  // La virgola e' come si scrive un decimale in mezza Europa.
  assert.equal(letta.rossa, 3.3);
});

test("una stringa che non e' JSON non fa cadere niente", () => {
  const letta = sogliaDellaPotenza("{rotto");
  assert.equal(letta.sorgente, SORGENTE_CASA);
  assert.equal(sogliaScritta(letta), false);
});

test("un numero che non e' un numero, e uno negativo, non sono soglie", () => {
  const letta = sogliaDellaPotenza({ ambra: "tanto", rossa: -100 });
  assert.equal(letta.ambra, null);
  assert.equal(letta.rossa, null);
});

test("zero e' una soglia scritta, e vuol dire «qualunque consumo e' troppo»", () => {
  const letta = sogliaDellaPotenza({ rossa: 0 });
  assert.equal(letta.rossa, 0);
  assert.equal(sogliaScritta(letta), true);
  assert.equal(livelloDellaPotenza(letta, { casa: 1 }).livello, LIVELLO_ROSSA);
});

test("una sorgente sconosciuta ricade sulla casa", () => {
  assert.equal(sogliaDellaPotenza({ sorgente: "luna" }).sorgente, SORGENTE_CASA);
});

test("l'energia immessa in rete non e' un sovraccarico", () => {
  /* Rete negativa = immissione. Sei chilowatt che ESCONO sono il fotovoltaico
   * che lavora, e col valore assoluto la tessera sarebbe diventata rossa nel
   * momento migliore della giornata. */
  assert.equal(wattDaSorvegliare({ rete: -6000 }, SORGENTE_RETE), 0);
  const soglia = { sorgente: SORGENTE_RETE, rossa: 3300 };
  assert.equal(livelloDellaPotenza(soglia, { rete: -6000, casa: 700 }).livello, LIVELLO_QUIETE);
});

test("il prelievo dalla rete invece si guarda per intero", () => {
  const soglia = { sorgente: SORGENTE_RETE, ambra: 3000, rossa: 3300 };
  assert.equal(livelloDellaPotenza(soglia, { rete: 3100, casa: 200 }).livello, LIVELLO_AMBRA);
  assert.equal(livelloDellaPotenza(soglia, { rete: 3400, casa: 200 }).livello, LIVELLO_ROSSA);
});

test("le due sorgenti rispondono a due domande diverse", () => {
  /* La casa tira sei chilowatt col contatore quasi fermo: li sta facendo il
   * sole. Chi guarda il carico di casa vuole vederlo, chi guarda la rete no. */
  const letture = { casa: 6000, rete: 200 };
  assert.equal(
    livelloDellaPotenza({ sorgente: SORGENTE_CASA, rossa: 3300 }, letture).livello,
    LIVELLO_ROSSA,
  );
  assert.equal(
    livelloDellaPotenza({ sorgente: SORGENTE_RETE, rossa: 3300 }, letture).livello,
    LIVELLO_QUIETE,
  );
});

test("sotto, in mezzo e sopra: i tre gradini", () => {
  const soglia = { ambra: 3000, rossa: 3300 };
  assert.equal(livelloDellaPotenza(soglia, { casa: 2999 }).livello, LIVELLO_QUIETE);
  // Esattamente sopra conta come sopra: chi scrive 3000 vuol dire «da qui in su».
  assert.equal(livelloDellaPotenza(soglia, { casa: 3000 }).livello, LIVELLO_AMBRA);
  assert.equal(livelloDellaPotenza(soglia, { casa: 3300 }).livello, LIVELLO_ROSSA);
});

test("il verdetto dice anche oltre quale numero e' scattato", () => {
  const verdetto = livelloDellaPotenza({ ambra: 3000, rossa: 3300 }, { casa: 3100 });
  assert.equal(verdetto.limite, 3000);
  assert.equal(verdetto.watt, 3100);
  assert.equal(verdetto.sorgente, SORGENTE_CASA);
});

test("una sola delle due soglie basta", () => {
  assert.equal(livelloDellaPotenza({ rossa: 3300 }, { casa: 3100 }).livello, LIVELLO_QUIETE);
  assert.equal(livelloDellaPotenza({ ambra: 3000 }, { casa: 3100 }).livello, LIVELLO_AMBRA);
});

test("scritte al contrario, vince comunque il colore piu' grave", () => {
  /* Rossa piu' bassa dell'ambra non e' una configurazione sensata, ma e' una
   * configurazione possibile: guardando prima l'ambra si sarebbe restati in
   * ambra per sempre, e il rosso non si sarebbe mai visto. */
  assert.equal(livelloDellaPotenza({ ambra: 3300, rossa: 3000 }, { casa: 3100 }).livello, LIVELLO_ROSSA);
});

test("senza lettura non si conclude niente", () => {
  const soglia = { rossa: 3300 };
  assert.equal(livelloDellaPotenza(soglia, {}).livello, LIVELLO_QUIETE);
  assert.equal(livelloDellaPotenza(soglia, { casa: null }).watt, null);
  assert.equal(wattDaSorvegliare({ casa: "molti" }, SORGENTE_CASA), null);
});

test("in quiete non c'e' nessun colore da dare", () => {
  assert.equal(coloreDelLivello(LIVELLO_QUIETE), null);
  assert.equal(coloreDelLivello(LIVELLO_AMBRA), COLORE_AMBRA);
  assert.equal(coloreDelLivello(LIVELLO_ROSSA), COLORE_ROSSA);
});

test("la soglia viaggia fra i dispositivi, come il resto della casa", () => {
  /* Il limite del contratto e' dell'impianto, non del vetro da cui lo si e'
   * scritto: senza stare nell'elenco, chi la imposta dal computer troverebbe
   * la tessera muta sul telefono. */
  assert.ok(CONFIG_KEYS.includes(SOGLIA_POTENZA_KEY));
});

test("la tessera prende il colore da qui, e non se ne fa uno suo", () => {
  const testo = sorgente("src/sections/home-widgets-section.js");
  assert.match(testo, /from "\.\.\/core\/la-soglia-della-potenza\.js"/);
  assert.match(testo, /accent: coloreDelLivello\(verdetto\.livello\) \|\| "#f97316"/);
  /* Le letture sono quelle che la tessera ha gia' in mano: rileggere i sensori
   * per colorarsi vorrebbe dire colorarsi su una corrente e scriverne
   * un'altra, che in questa plancia e' gia' successo (#435). */
  assert.match(testo, /rete: rows\.find\(\(riga\) => riga\.group === "grid"\)\?\.watts \?\? null/);
});

test("il posto dove si scrive la soglia e' dentro le impostazioni dell'Energia", () => {
  const testo = sorgente("src/sections/la-soglia-della-potenza-section.js");
  assert.match(testo, /\[data-energy-panel="settings"\]/);
  /* La pagina Energia dice la stessa cosa della Home, e la dice solo quando
   * c'e' qualcosa da dire. */
  assert.match(testo, /view-ist/);
  assert.match(testo, /paginaVisibile\("page-energy"\)/);
  const runtime = sorgente("src/sections/section-runtime.js");
  assert.match(runtime, /installLaSogliaDellaPotenza\(\);/);
});

test("il sovraccarico di rete non si disegna con un router", () => {
  /* «rete» nel catalogo è un alias di «router»: la rete di casa, quella dei
   * cavi e del wi-fi. Qui si parla della rete ELETTRICA, e un router sopra un
   * allarme di sovraccarico dice una cosa falsa. */
  const catalogo = sorgente("src/core/catalogo-disegni.js");
  assert.match(catalogo, /rete: "router",/, "l'alias è ancora quello: il disegno non va chiesto lì");
  const sezione = sorgente("src/sections/la-soglia-della-potenza-section.js");
  assert.match(sezione, /SORGENTE_RETE \? "potenza" : "casa"/);
  assert.doesNotMatch(sezione, /SORGENTE_RETE \? "rete"/);
});

test("l'avviso e la fascia stanno sulla stessa riga anche sul telefono", () => {
  /* Erano su due righe sotto i 560 px, per una regola scritta apposta: «due
   * cose strette su uno schermo stretto non si leggono». Provata, e sbagliata:
   * due righe alte 115 px per dire quello che ne vuole 60, e due cose che si
   * leggono insieme — cosa chiede attenzione adesso, cosa sta facendo la casa —
   * messe a distanza.
   *
   * Adesso restano affiancate: l'avviso si stringe fino al 56% e la fascia
   * prende quello che resta. Misurato in Chromium col foglio di stile vero a
   * 360, 390, 414 e 430 px: il numero non si taglia mai e alla fascia resta una
   * pastiglia intera. */
  const casa = sorgente("src/sections/come-sta-la-casa-section.js");
  assert.doesNotMatch(
    casa,
    /@media \(max-width:560px\)\{\s*\n?\s*\.dm-casa-fascia\{flex-direction:column/,
    "la corsia non deve più impilarsi sul telefono",
  );
  assert.match(
    casa,
    /@media \(max-width:560px\)\{\s*\n\s*\.dm-casa-fascia > #dm-casa-riga\{flex:1 1 0;min-width:0;max-width:none\}\}/,
  );

  const soglia = sorgente("src/sections/la-soglia-della-potenza-section.js");
  /* L'avviso si stringe per stare accanto alla fascia. Quanto, lo dice la
   * prova qui sotto — qui conta solo che POSSA stringersi: senza `flex:0 1`
   * resterebbe della sua misura e spingerebbe fuori la fascia. */
  assert.match(soglia, /flex:0 1 auto;min-width:0;max-width:\d+%/);
});

test("la card è più piccola e la sua parolina scorre invece di essere tagliata", () => {
  const soglia = sorgente("src/sections/la-soglia-della-potenza-section.js");
  /* Più piccola: il tetto scende dal 56% al 46%, e con lui scendono disegno e
   * scritte — stringere la scatola lasciando dentro le misure di prima vuol
   * dire soltanto schiacciare il contenuto. */
  assert.match(soglia, /max-width:46%/);
  assert.match(soglia, /\.dm-soglia-allerta \.dm-casa-chip\{width:30px;height:30px/);

  /* La deriva è QUELLA della fascia, non una seconda: stessa animazione,
   * stesse due funzioni per strada e durata. Due derive scritte due volte
   * sarebbero due velocità diverse a dieci pixel di distanza. */
  assert.match(
    soglia,
    /import \{ durataDellaDeriva, spazioDaPercorrere \} from "\.\.\/core\/la-fascia-deriva\.js";/,
  );
  assert.match(soglia, /animation:dm-casa-deriva var\(--dm-casa-durata,12s\)/);

  /* Si misura la coda, non il nastro: su un elemento ancora `inline`
   * `scrollWidth` non dice quanto è larga la scritta, e la strada risultava
   * sempre zero — la parolina non si muoveva mai. */
  assert.match(soglia, /scrollWidth: coda\.scrollWidth,\s*\n\s*clientWidth: coda\.clientWidth,/);
  assert.doesNotMatch(soglia, /scrollWidth: nastro\.scrollWidth/);

  /* Il numero non si muove: è il motivo per cui l'avviso esiste, e uno che
   * scorre non si legge a colpo d'occhio. Si tronca semmai, non deriva. */
  assert.match(
    soglia,
    /\.dm-soglia-allerta \.dm-casa-testa\{\s*\n\s*display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/,
  );
  /* E chi ha chiesto meno animazioni non vede muovere niente. */
  assert.match(soglia, /@media\(prefers-reduced-motion:reduce\)\{\s*\n\s*\.dm-soglia-allerta \.dm-casa-coda/);
});
