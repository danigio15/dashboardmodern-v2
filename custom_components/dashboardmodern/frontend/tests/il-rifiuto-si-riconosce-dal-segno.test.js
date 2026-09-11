/* Il rifiuto si riconosce dal suo bidone (#384).
 *
 * «Nel widget visualizzare l'immagine del rifiuto oltre alla descrizione,
 *  sarebbe una chicca.» E poi, sulla prima stesura: «le icone non sono quelle,
 *  non mettere cose che non appartengono al nostro catalogo».
 *
 * L'immagine di un rifiuto è il bidone che disegniamo noi — `disegni-rifiuti.js`
 * — quello della pagina Rifiuti, della scheda in configurazione e del foglio con
 * cui si sceglie il materiale. Un'emoji al suo posto è un'icona d'altri.
 *
 * Quindi: dove si può disegnare si disegna il bidone — la faccia della tessera
 * e le caselle della finestra — e dove ci sta solo testo restano le parole. La
 * didascalia della tessera è testo, e infatti dice i nomi e basta.
 *
 * Le prove si fanno disegnare la tessera vera, con le due strade da cui la gente
 * ci arriva: il turno scritto a mano sul frigo (#366) e l'entità calendario.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.DashboardModernModules = {
  store: { getSection: (nome) => ({ rooms: [{ id: "r1", name: "Camera" }] })[nome] },
};

const { modelliDelleTessere } = await import("../src/sections/home-widgets-section.js");
const { fraseDellaTessera } = await import("../src/core/racconto-tessera.js");

const IT = (italiano) => italiano;

/** Una data scritta come la scrive chi compila la scheda. */
function giorno(avanti) {
  const data = new Date(Date.now() + avanti * 86400000);
  const mese = String(data.getMonth() + 1).padStart(2, "0");
  return `${data.getFullYear()}-${mese}-${String(data.getDate()).padStart(2, "0")}`;
}

/** La tessera Rifiuti come la disegna il ponte. */
function tessera(config, stati = {}) {
  magazzino.clear();
  magazzino.set("cd_rifiuti", JSON.stringify(config));
  return (modelliDelleTessere(stati) || []).find((widget) => widget?.key === "rifiuti") || null;
}

/** Il turno di casa, con i materiali messi nei giorni a partire da `da`. */
const turno = (da, giorni) => ({
  righe: [],
  calendario: "",
  turno: { inizio: giorno(da), giorni },
});

const calendario = (messaggio, avanti) => [
  { righe: [], calendario: "calendar.rifiuti", turno: {} },
  {
    "calendar.rifiuti": {
      entity_id: "calendar.rifiuti",
      state: "off",
      attributes: { message: messaggio, start_time: `${giorno(avanti)} 06:00:00` },
    },
  },
];

test("la faccia della tessera è il bidone del prossimo ritiro", () => {
  const rifiuti = tessera(turno(0, [["plastica"], [], [], [], [], [], [], [], [], [], [], [], [], []]));
  assert.equal(rifiuti.value, "Oggi");
  /* Il disegno è quello nostro, non un'emoji: si riconosce dal marchio che il
   * catalogo dei disegni scrive addosso a ogni bidone. */
  assert.match(rifiuti.faccia, /data-dm-art="bidone-plastica"/);
  assert.match(rifiuti.faccia, /<svg/);
  /* La firma dice a chi ridipinge quando la faccia è cambiata davvero. */
  assert.equal(rifiuti.facciaFirma, "plastica~oggi");
});

test("la didascalia è parole: lì un disegno non ci sta", () => {
  const rifiuti = tessera(
    turno(-1, [[], [], ["carta", "organico"], [], [], [], [], [], [], [], [], [], [], []]),
  );
  /* Domani la tessera dice prima il gesto — stasera va fuori — e poi cosa. */
  assert.equal(rifiuti.caption, "Da mettere fuori stasera · Carta e cartone · Organico");
  assert.doesNotMatch(rifiuti.caption, /[\u{1F300}-\u{1FAFF}]/u);
});

test("ogni casella della finestra porta il bidone del suo materiale", () => {
  const rifiuti = tessera(
    turno(0, [["vetro"], ["indifferenziato"], [], [], [], [], [], [], [], [], [], [], [], []]),
  );
  const disegni = rifiuti.rows.map((riga) => riga.disegno);
  assert.match(disegni[0], /data-dm-art="bidone-vetro"/);
  assert.match(disegni[1], /data-dm-art="bidone-indifferenziato"/);
  /* La parola resta accanto al disegno, per i posti dove ci sta solo testo: la
   * fascia «come sta la casa» scrive quello che riceve e basta. */
  assert.deepEqual(
    rifiuti.rows.map((riga) => riga.glyph),
    ["🍾", "🗑️"],
  );
});

test("il calendario porta il bidone del materiale quando il messaggio lo dice", () => {
  const rifiuti = tessera(...calendario("Vetro", 2));
  assert.equal(rifiuti.caption, "Vetro");
  assert.match(rifiuti.rows[0].disegno, /data-dm-art="bidone-vetro"/);
  assert.match(rifiuti.faccia, /data-dm-art="bidone-vetro"/);
});

test("e quando non lo dice non si disegna un bidone a caso", () => {
  /* Un bidone qualunque direbbe una frazione che nessuno ha letto: meglio il
   * simbolo di sempre, che dice «rifiuti» e non mente. */
  const rifiuti = tessera(...calendario("Ritiro porta a porta", 2));
  assert.equal(rifiuti.caption, "Ritiro porta a porta");
  assert.equal(rifiuti.rows[0].disegno, "");
  assert.equal(rifiuti.faccia, "");
  assert.equal(rifiuti.rows[0].glyph, "📅");
});

test("la frase parlata resta senza segni: si legge, non si guarda", () => {
  const rifiuti = tessera(turno(0, [["plastica"], [], [], [], [], [], [], [], [], [], [], [], [], []]));
  const frase = fraseDellaTessera(rifiuti, IT);
  assert.match(frase, /Plastica/);
  assert.doesNotMatch(frase, /🧴|<svg/);
  // Il nome della riga non se lo porta appiccicato: il segno viaggia a parte.
  assert.equal(rifiuti.prossimi[0].name, "Plastica");
});

test("senza niente in vista non si disegna niente", () => {
  /* Il calendario configurato ma che non risponde: non c'è nessuna data, e
   * nemmeno nessun materiale da disegnare. */
  const rifiuti = tessera({ righe: [], calendario: "calendar.rifiuti", turno: {} }, {});
  assert.equal(rifiuti.caption, "Nessuna data in vista");
  assert.deepEqual(rifiuti.prossimi, []);
  assert.equal(rifiuti.faccia, "");
});

/* ── e anche mentre si sceglie, ma coi bidoni nostri ───────────────────── */

/* «Nel menu a tendina dei rifiuti voglio vedere anche le icone.» E poi: «le
 *  icone non sono quelle, non mettere cose che non appartengono al nostro
 *  catalogo».
 *
 * Le icone dei rifiuti sono i bidoni che disegniamo noi — `disegni-rifiuti.js`
 * — e dentro un <option> di sistema non ci stanno: lì ci sta solo testo, e
 * l'unica cosa che ci si potrebbe mettere è un'emoji qualunque, che nostra non
 * è. Quindi la tendina di sistema se n'è andata, e la scelta si fa con lo
 * stesso foglio con cui si dice cosa esce in un giorno del turno: stessi
 * bidoni, stesse righe.
 */
import { readFileSync } from "node:fs";

const editor = readFileSync(
  new URL("../src/sections/rifiuti-editor-section.js", import.meta.url),
  "utf8",
);

test("il materiale non si sceglie più da una tendina di sistema", () => {
  /* Un <option> porta solo testo: lì dentro il nostro bidone non entra, e
   * un'emoji al suo posto sarebbe un'icona che non è nostra. */
  assert.doesNotMatch(editor, /<option value=/);
  assert.doesNotMatch(editor, /voce\.icona/);
  assert.match(editor, /<button type="button" class="ed-input dm-rifiuti-ed-materiale"/);
  // Il valore resta dov'era, con lo stesso marchio: chi raccoglie non cambia.
  assert.match(editor, /<input type="hidden" data-dm-rifiuti-campo="materiale"/);
});

test("si sceglie dal foglio, con i bidoni disegnati da noi", () => {
  assert.match(editor, /function apriLaTendinaDelMateriale\(riga\)/);
  assert.match(editor, /apriIlFoglioDiScelta\(\{\s*titolo: t\("Che materiale è", "Which material"\)/);
  /* Le righe del foglio le veste una funzione sola, la stessa dei giorni del
   * turno: una domanda sola si fa in un modo solo. */
  assert.match(editor, /function voceDelMateriale\(materiale, premuto\)/);
  assert.match(
    editor,
    /disegnoDelBidone\(materiale\.chiave, materiale\.colore, 26\)/,
  );
  assert.equal((editor.match(/function voceDelMateriale/g) || []).length, 1);
  assert.match(editor, /const riga = voceDelMateriale\(materiale, scelti\.has\(materiale\.chiave\)\)/);
});

test("scelto il materiale, la riga si riveste senza ridisegnare la scheda", () => {
  /* Ridisegnare butterebbe via quello che si sta scrivendo nelle altre righe:
   * il vestito lo cambia una funzione sola, chiamata sul posto. */
  assert.match(editor, /function vestiLaRiga\(riga, chiave\)/);
  assert.match(editor, /campo\.value = materiale\.chiave;\s*vestiLaRiga\(riga, materiale\.chiave\);/);
  assert.match(editor, /disegnoDelBidone\(voce\.chiave, voce\.colore, 32\)/);
});

test("i bidoni sono quelli del nostro catalogo, non emoji", () => {
  const disegni = readFileSync(
    new URL("../src/core/disegni-rifiuti.js", import.meta.url),
    "utf8",
  );
  assert.match(disegni, /export function disegnoDelBidone\(chiave, colore, misura = 96\)/);
  assert.match(editor, /import \{ disegnoDelBidone \} from "\.\.\/core\/disegni-rifiuti\.js"/);
});
