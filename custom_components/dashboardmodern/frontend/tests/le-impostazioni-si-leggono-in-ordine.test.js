/* «Lingua non presente nella parte iniziale del config dove c'è assistenza,
 * prima usciva lì.»
 *
 * Le due righe che i moduli aggiungono alla scheda ⚙️ Impostazioni — la lingua
 * e Assist — si mettevano ognuna con la propria ancora: la lingua sotto il
 * tasto «salva» dei Generali, Assist sotto la lingua. Ma Assist si installa
 * prima della lingua (`section-runtime.js`, riga 918 contro 1039), e quando
 * tocca a lui la riga della lingua non c'è ancora: allora ricadeva in cima
 * alla scheda, e la lingua finiva sotto di lui.
 *
 * Il difetto non era di Assist: era che l'ordine di quello che si legge veniva
 * dall'ordine in cui i moduli si caricano. Adesso il posto è un numero che la
 * riga si porta scritto addosso, e arrivare primi o ultimi non cambia niente.
 * Questa prova arriva nei due ordini possibili e pretende lo stesso risultato.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ORDINE_IMPOSTAZIONI, inserisciInOrdine } from "../src/sections/shared.js";

/* Il minimo di DOM che serve al collocatore: dei figli in fila, un attributo
 * per riga, e i tre modi di infilarne una. */
function nodo(nome = "") {
  return {
    nome,
    attrs: new Map(),
    parentElement: null,
    setAttribute(chiave, valore) {
      this.attrs.set(chiave, String(valore));
    },
    getAttribute(chiave) {
      return this.attrs.has(chiave) ? this.attrs.get(chiave) : null;
    },
    after(altro) {
      const dentro = this.parentElement;
      if (!dentro) return;
      dentro.figli.splice(dentro.figli.indexOf(this) + 1, 0, stacca(altro, dentro));
    },
  };
}

function stacca(figlio, dentro) {
  const vecchio = figlio.parentElement;
  if (vecchio) vecchio.figli.splice(vecchio.figli.indexOf(figlio), 1);
  figlio.parentElement = dentro;
  return figlio;
}

function contenitore() {
  return {
    figli: [],
    querySelectorAll(selettore) {
      const chiave = selettore.replace(/^\[|\]$/g, "");
      return this.figli.filter((figlio) => figlio.getAttribute(chiave) !== null);
    },
    insertBefore(figlio, prima) {
      this.figli.splice(this.figli.indexOf(prima), 0, stacca(figlio, this));
    },
    prepend(figlio) {
      this.figli.unshift(stacca(figlio, this));
    },
    append(figlio) {
      this.figli.push(stacca(figlio, this));
    },
  };
}

const nomi = (dentro) => dentro.figli.map((figlio) => figlio.nome);

/** Mette le due righe nell'ordine di arrivo chiesto, e dice com'è finita. */
function scheda(ordineDiArrivo, { conAncora = true } = {}) {
  const corpo = contenitore();
  const salva = nodo("salva");
  if (conAncora) corpo.append(salva);
  const ancora = () => (conAncora ? salva : null);
  const righe = { lingua: nodo("lingua"), assist: nodo("assist") };
  for (const quale of ordineDiArrivo)
    inserisciInOrdine(corpo, righe[quale], ORDINE_IMPOSTAZIONI[quale], ancora);
  return corpo;
}

test("la lingua sta sopra Assist, arrivi prima l'una o prima l'altro", () => {
  assert.deepEqual(nomi(scheda(["lingua", "assist"])), ["salva", "lingua", "assist"]);
  // È questo il caso vero: Assist si installa per primo.
  assert.deepEqual(nomi(scheda(["assist", "lingua"])), ["salva", "lingua", "assist"]);
});

test("senza il blocco Generali le righe restano in cima, e sempre in quest'ordine", () => {
  /* Il blocco «Generali» il guscio lo disegna solo a chi può vederlo: su una
   * plancia con l'utente admin impostato, chi guarda da un altro utente non ce
   * l'ha. Le righe non spariscono e non si scambiano di posto. */
  assert.deepEqual(nomi(scheda(["assist", "lingua"], { conAncora: false })), [
    "lingua",
    "assist",
  ]);
  assert.deepEqual(nomi(scheda(["lingua", "assist"], { conAncora: false })), [
    "lingua",
    "assist",
  ]);
});

test("l'ordine è dichiarato in un posto solo, e la lingua viene prima", () => {
  assert.ok(
    ORDINE_IMPOSTAZIONI.lingua < ORDINE_IMPOSTAZIONI.assist,
    "la lingua è la preferenza più generale delle due: sta sopra",
  );
});

test("una riga che torna non si sdoppia e non cambia posto", () => {
  // L'editor si ridisegna in continuazione: rimettere la stessa riga deve
  // essere un gesto che non lascia tracce.
  const corpo = contenitore();
  const riga = nodo("lingua");
  inserisciInOrdine(corpo, riga, ORDINE_IMPOSTAZIONI.lingua, () => null);
  inserisciInOrdine(corpo, riga, ORDINE_IMPOSTAZIONI.lingua, () => null);
  assert.deepEqual(nomi(corpo), ["lingua"]);
});
