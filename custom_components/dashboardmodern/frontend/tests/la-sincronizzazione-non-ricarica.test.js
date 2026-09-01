/* La plancia non si ricarica da sola.
 *
 * Nel filmato, quattro secondi dopo l'apertura, lo schermo diventa bianco, il
 * velo di avvio torna su, e dopo altri quattro secondi la plancia riparte —
 * sulla Home, buttando via la pagina Energia che si stava guardando. Non e' un
 * disegno che sfarfalla: e' `location.reload()`.
 *
 * A chiamarlo era il tiraggio della configurazione da Home Assistant. All'avvio
 * la plancia chiede a HA la configurazione dell'utente; se il timbro dell'ora
 * di HA e' piu' recente di quello di qui, la applicava e RICARICAVA la pagina.
 * Cioe': ogni volta che si e' toccata la configurazione da un'altra parte —
 * il computer, un'altra plancia — la prima apertura sul telefono costava due
 * avvii invece di uno, e chi stava guardando qualcosa se lo vedeva sparire.
 *
 * Per quasi tutto il ricaricamento non serve: applicare dal vivo e' la stessa
 * cosa che fa l'editor a ogni salvataggio. Lo store riceve il fotogramma e
 * avvisa le sezioni, `cdApplyNavVis()` rilegge quali sezioni vanno nella barra,
 * `render()` ridisegna il guscio. La prova su documento vero
 * (`e2e/la-configurazione-nuova-arriva-senza-ricaricare.spec.js`) mostra che lo
 * schermo che ne esce e' lo stesso di un avvio pulito con quella
 * configurazione.
 *
 * Restano fuori tre chiavi che le legge solo l'avvio — il marchio, i nomi delle
 * luci, le unita' clima: scriverle in memoria e lasciare lo schermo a dire la
 * cosa di prima sarebbe peggio del ricaricamento, quindi li' si ricarica. Sono
 * i pochi casi rimasti, e la differenza con prima e' che adesso e' l'eccezione
 * e non la regola.
 *
 * Qui si guarda la sorgente, perche' e' l'unico posto dove si vede a quale
 * condizione il ricaricamento resta: dentro `ws.onmessage` non ci si arriva da
 * fuori. Gli altri sei ricaricamenti li ha chiesti una persona che ha appena
 * premuto qualcosa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const RUNTIME = ["dashboard-runtime-it.js", "dashboard-runtime-en.js"];
const sorgente = (nome) => readFileSync(new URL(`../legacy/${nome}`, import.meta.url), "utf8");

/* Dove sta ogni ricaricamento, in ordine di comparsa nel file.
 *
 * Sei sono tasti: auto-rilevamento, salva generale, importa, azzera tutto,
 * prova il token del wizard, chiudi il wizard. Il settimo sta dentro `connect`
 * — e' il tiraggio da HA — e vale solo per le tre chiavi che le legge solo
 * l'avvio: quello lo guarda la prova qui sopra, riga per riga. */
const DOVE_SI_RICARICA = Object.freeze([
  "connect",
  "edAutoRileva",
  "edSaveGeneral",
  "edImport",
  "edResetAll",
  "wzTestToken",
  "wzFinish",
]);

/* La funzione dentro cui cade una posizione: l'ultima `function nome(` che
 * viene prima. Il guscio e' un file solo, tutto a funzioni di primo livello. */
function funzioneCheContiene(testo, posto) {
  let nome = "?";
  for (const trovata of testo.slice(0, posto).matchAll(/function (\w+)\s*\(/g)) nome = trovata[1];
  return nome;
}

for (const nome of RUNTIME) {
  test(`${nome}: il tiraggio da HA applica dov'e', e ricarica solo per le tre chiavi dell'avvio`, () => {
    const testo = sorgente(nome);
    const inizio = testo.indexOf("m.id === window._cdSyncReqId");
    assert.ok(inizio > 0, "il ramo del tiraggio non si trova piu': la prova va riscritta");
    const ramo = testo.slice(inizio, testo.indexOf("\n      return;\n", inizio));

    assert.match(ramo, /cdApplyNavVis\(\)/, "senza rileggere la barra restano linguette di prima");
    assert.match(ramo, /render\(\)/, "senza ridisegnare il guscio resta la configurazione vecchia");

    /* Il ricaricamento nel ramo puo' esserci, ma solo dietro la condizione: se
     * ricomparisse incondizionato tornerebbe il salto bianco del filmato. */
    const righeCheRicaricano = ramo
      .split("\n")
      .filter((riga) => riga.includes("location.reload()"));
    assert.equal(righeCheRicaricano.length, 1, "il tiraggio ricarica da piu' di un punto");
    assert.match(
      righeCheRicaricano[0],
      /CD_SOLO_ALL_AVVIO\.has\(k\)/,
      "il tiraggio ricarica senza guardare quali chiavi sono cambiate: e' il salto bianco del filmato",
    );
    assert.match(
      testo,
      /const CD_SOLO_ALL_AVVIO = new Set\(\['cd_branding', 'cd_luci', 'cd_clima_units'\]\)/,
      "l'elenco delle chiavi che legge solo l'avvio non e' piu' quello",
    );
  });

  test(`${nome}: i ricaricamenti stanno dove devono stare`, () => {
    const testo = sorgente(nome);
    const dove = [];
    for (
      let i = testo.indexOf("location.reload()");
      i >= 0;
      i = testo.indexOf("location.reload()", i + 1)
    )
      dove.push(funzioneCheContiene(testo, i));
    assert.deepEqual(
      dove,
      DOVE_SI_RICARICA,
      "un ricaricamento e' comparso, sparito o si e' spostato: se e' automatico e' il salto bianco che torna",
    );
  });

  test(`${nome}: applicare la configurazione conta cio' che cambia, non cio' che arriva`, () => {
    /* Contando ogni chiave del carico, il conto era sempre maggiore di zero
     * anche quando la configurazione era identica a quella gia' qui — e quel
     * numero era la ragione per rifare tutto. */
    const testo = sorgente(nome);
    const inizio = testo.indexOf("function cdSyncApply(");
    assert.ok(inizio > 0);
    const corpo = testo.slice(inizio, testo.indexOf("\n}", inizio));
    assert.match(
      corpo,
      /data\.dm_dashboard_state !== localStorage\.getItem\('dm_dashboard_state'\)/,
      "il fotogramma si riapplica anche quando e' lo stesso",
    );
    assert.match(
      corpo,
      /data\[k\] !== localStorage\.getItem\(k\)/,
      "le chiavi si riscrivono anche quando sono le stesse",
    );
  });
}
