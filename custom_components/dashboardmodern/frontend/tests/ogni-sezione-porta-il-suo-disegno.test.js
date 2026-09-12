/* Una sezione nuova porta il suo disegno, in tutti e tre i posti.
 *
 * «Ti avevo chiesto di inserire icone nostre su tutta la dashboard e continuo
 * a vedere icone che non sono nostre.»
 *
 * Il difetto è tornato quattro volte, sempre uguale: si aggiunge una sezione —
 * i Varchi, la Musica, gli Animali, le Batterie — e la sezione porta la sua
 * pagina, la sua scheda nel Config e la sua tessera, ma non si presenta alle
 * due tabelle che dicono «quale disegno va su questa voce». Quelle tabelle
 * stanno in altri due moduli, e non sono dove si lavora quando si scrive una
 * sezione. La voce resta con l'emoji del telefono, che cambia faccia da un
 * apparecchio all'altro.
 *
 * A trovarlo era sempre la stessa prova col browser: sedici minuti di coda,
 * tre schede rosse, e la diagnosi da leggere in un registro. Questa prova fa
 * la stessa domanda in un secondo, e la fa sull'elenco delle sezioni — cioè
 * sull'unico posto dove una sezione nuova deve per forza iscriversi.
 *
 * Da quando il disegno si può anche NON scrivere — chi si chiama come il
 * proprio disegno lo prende dal proprio nome — questa prova serve soprattutto
 * a chi non può: «sez3» non è il nome di nessun disegno, e per quelle la
 * tabella resta l'unico posto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SEZIONI, paginaDellaSezione } from "../src/core/lelenco-delle-sezioni.js";
import { haOggettoWidget } from "../src/core/oggetti-widget.js";

const sorgente = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

/** Le coppie voce → disegno di una tabella scritta come oggetto congelato. */
function tabella(testo, nome) {
  const apertura = testo.indexOf(`const ${nome} = Object.freeze({`);
  assert.notEqual(apertura, -1, `${nome}: la tabella non si trova più`);
  const chiusura = testo.indexOf("\n});", apertura);
  assert.notEqual(chiusura, -1, `${nome}: la tabella non si chiude`);
  const corpo = testo.slice(apertura, chiusura);
  const coppie = {};
  for (const riga of corpo.split("\n")) {
    const trovato = /^\s{2}"?([A-Za-z0-9_-]+)"?:\s*"([^"]+)",?\s*$/.exec(riga);
    if (trovato) coppie[trovato[1]] = trovato[2];
  }
  assert.ok(Object.keys(coppie).length > 10, `${nome}: letta quasi vuota, il formato è cambiato`);
  return coppie;
}

const SCHEDE = tabella(
  sorgente("../src/sections/beta4-mobile-polish-section.js"),
  "OGGETTO_DELLA_SCHEDA",
);
const PAGINE = tabella(sorgente("../src/sections/navigation-section.js"), "OGGETTO_DELLA_PAGINA");

/* Il nome del disegno che una voce si prende: quello scritto in tabella, o —
 * se la voce si chiama già come un disegno — il proprio nome. È la stessa
 * regola dei due moduli, e sta scritta una volta sola perché due copie di una
 * regola sono il modo in cui una delle due invecchia. */
const disegnoDi = (tabellaScritta, voce) => tabellaScritta[voce] || (haOggettoWidget(voce) ? voce : "");

test("ogni scheda del Config ha un disegno di casa, non un'emoji", () => {
  for (const voce of SEZIONI) {
    const disegno = disegnoDi(SCHEDE, voce.scheda);
    assert.ok(
      disegno,
      `${voce.scheda} (${voce.it}): nessun disegno. O si chiama come il suo disegno, o va scritto in OGGETTO_DELLA_SCHEDA.`,
    );
    assert.ok(haOggettoWidget(disegno), `${voce.scheda}: «${disegno}» non è un disegno di casa`);
  }
});

test("ogni pagina della plancia ha un disegno di casa nella barra in basso", () => {
  for (const voce of SEZIONI) {
    const pagina = paginaDellaSezione(voce);
    /* Le sezioni che uno si fa da sé non hanno una pagina sola: ognuna porta
     * il simbolo che l'utente le ha scelto, e nessuna tabella lo può sapere. */
    if (!pagina) continue;
    const disegno = disegnoDi(PAGINE, pagina);
    assert.ok(
      disegno,
      `${pagina} (${voce.it}): nessun disegno nella barra. O la pagina si chiama come il suo disegno, o va scritta in OGGETTO_DELLA_PAGINA.`,
    );
    assert.ok(haOggettoWidget(disegno), `${pagina}: «${disegno}» non è un disegno di casa`);
  }
});

test("quello che le due tabelle promettono, il catalogo lo sa disegnare", () => {
  for (const [nome, tavola] of [
    ["OGGETTO_DELLA_SCHEDA", SCHEDE],
    ["OGGETTO_DELLA_PAGINA", PAGINE],
  ])
    for (const [voce, disegno] of Object.entries(tavola))
      assert.ok(haOggettoWidget(disegno), `${nome}[${voce}] promette «${disegno}», che non esiste`);
});

/* Avere il disegno non basta: bisogna anche METTERLO, e metterlo quando la voce
 * nasce.
 *
 * Le voci che aggiungono i moduli — Stanze, Luci, Prese, Robot, le telecamere,
 * le porte — nascono nel fotogramma dopo `render`, e col simbolo scritto a mano
 * da chi le ha create. A rimpiazzarlo col disegno era solo l'aggancio su
 * `cdApplyNavVis`: una funzione del guscio, che al momento in cui questo modulo
 * si installa puo' non esserci ancora. Quando non c'era, l'aggancio non si
 * faceva — e non si riprovava mai piu': la barra restava col simbolo del
 * telefono, e chi guarda vede «icone che non sono nostre» su una plancia il cui
 * catalogo li aveva tutti.
 */
test("il disegno si rimette dove la barra si rifà, non solo se il guscio è già pronto", () => {
  const barra = sorgente("../src/sections/navigation-section.js");
  /* Insieme al filtro, che e' la cosa che gia' succedeva al momento giusto:
   * subito dopo `render` e in fondo allo stesso fotogramma. */
  assert.match(barra, /applicaLaVisibilita\(\);\s*\n\s*disegniNellaBarra\(\);\s*\n\s*filtraNelFotogramma\(\);/);
  assert.match(barra, /state\.filtroInCoda = false;\s*\n\s*applicaLaVisibilita\(\);\s*\n\s*disegniNellaBarra\(\);/);
  /* E gli agganci al guscio si riprovano quando il guscio dichiara di esserci:
   * tutt'e due si rifiutano di avvolgere due volte la stessa funzione, quindi
   * riprovare non costa niente. */
  assert.match(
    barra,
    /for \(const evento of \["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"\]\)\s*\n\s*root\.addEventListener\?\.\(evento, \(\) => \{\s*\n\s*accodaDopo\("cdApplyNavOrder"\);\s*\n\s*accodaDopo\("cdApplyNavVis"\);\s*\n\s*filtraDopo\("render"\);/,
  );
});
