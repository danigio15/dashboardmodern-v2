/* «Nel widget visualizzare l'immagine del rifiuto oltre alla descrizione,
 *  sarebbe una chicca.» (#384)
 *
 * Un ritiro si riconosce dal segno prima che dalla parola — il barattolo, la
 * bottiglia, la mela — e la tessera il segno ce l'aveva già: ogni riga lo porta
 * nella sua casella. Nella didascalia però restavano i soli nomi, e quella è la
 * riga che si legge passando.
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

test("la didascalia porta il segno del materiale accanto al nome", () => {
  const rifiuti = tessera(turno(0, [["plastica"], [], [], [], [], [], [], [], [], [], [], [], [], []]));
  assert.equal(rifiuti.value, "Oggi");
  assert.equal(rifiuti.caption, "🧴 Plastica");
  assert.deepEqual(rifiuti.prossimi, [
    { name: "Plastica", glyph: "🧴", quando: "oggi", giorni: 0 },
  ]);
});

test("con due ritiri lo stesso giorno ognuno porta il suo", () => {
  const rifiuti = tessera(
    turno(-1, [[], [], ["carta", "organico"], [], [], [], [], [], [], [], [], [], [], []]),
  );
  /* Domani la tessera dice prima il gesto — stasera va fuori — e poi cosa. */
  assert.equal(rifiuti.caption, "Da mettere fuori stasera · 📦 Carta e cartone · 🍎 Organico");
});

test("il segno è quello che la riga porta già nella sua casella", () => {
  /* Non se ne inventa un altro: due segni per la stessa cosa sono il modo in
   * cui uno dei due, un giorno, dice un materiale diverso dall'altro. */
  const rifiuti = tessera(
    turno(0, [["vetro"], ["indifferenziato"], [], [], [], [], [], [], [], [], [], [], [], []]),
  );
  const segni = rifiuti.rows.map((riga) => riga.glyph);
  assert.deepEqual(segni, ["🍾", "🗑️"]);
  assert.equal(rifiuti.prossimi[0].glyph, segni[0]);
});

test("il calendario porta il segno del materiale quando il messaggio lo dice", () => {
  const rifiuti = tessera(...calendario("Vetro", 2));
  assert.equal(rifiuti.caption, "🍾 Vetro");
  assert.equal(rifiuti.rows[0].glyph, "🍾");
});

test("e quando non lo dice resta il segno del calendario, non un materiale inventato", () => {
  /* «♻️ Altro» sarebbe una risposta, e lì una risposta non c'è: il messaggio
   * non nomina nessuna frazione. */
  const rifiuti = tessera(...calendario("Ritiro porta a porta", 2));
  assert.equal(rifiuti.caption, "📅 Ritiro porta a porta");
  assert.equal(rifiuti.rows[0].glyph, "📅");
});

test("la frase parlata resta senza segni: si legge, non si guarda", () => {
  const rifiuti = tessera(turno(0, [["plastica"], [], [], [], [], [], [], [], [], [], [], [], [], []]));
  const frase = fraseDellaTessera(rifiuti, IT);
  assert.match(frase, /Plastica/);
  assert.doesNotMatch(frase, /🧴/);
  // Il nome della riga non se lo porta appiccicato: il segno viaggia a parte.
  assert.equal(rifiuti.prossimi[0].name, "Plastica");
});

test("senza niente in vista la didascalia non prova a mettere un segno", () => {
  /* Il calendario configurato ma che non risponde: non c'è nessuna data, e
   * nemmeno nessun materiale da disegnare. */
  const rifiuti = tessera({ righe: [], calendario: "calendar.rifiuti", turno: {} }, {});
  assert.equal(rifiuti.caption, "Nessuna data in vista");
  assert.deepEqual(rifiuti.prossimi, []);
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
