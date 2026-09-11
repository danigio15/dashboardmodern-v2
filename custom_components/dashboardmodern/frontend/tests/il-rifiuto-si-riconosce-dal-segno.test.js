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

/* ── e anche nella tendina, mentre si sceglie ──────────────────────────── */

/* «Nel menu a tendina dei rifiuti voglio vedere anche le icone, come hai fatto
 *  nel menu a tendina della sezione analisi dispositivi.»
 *
 * Dentro un <option> ci sta solo testo, e prima da lì l'emoji si toglieva: il
 * bidone disegnato sta accanto, nella testa della riga, e sembrava che
 * bastasse lui. Ma il bidone accanto dice cosa è scelto ADESSO — mentre si
 * sceglie la tendina è aperta e lo copre — e la scelta la si fa leggendo
 * undici righe di parole tutte uguali.
 */
import { readFileSync } from "node:fs";

const editor = readFileSync(
  new URL("../src/sections/rifiuti-editor-section.js", import.meta.url),
  "utf8",
);

test("ogni voce della tendina porta il segno del suo materiale", () => {
  assert.match(editor, /`\$\{voce\.icona\} \$\{nomeDelMateriale\(voce\.chiave\)\}`/);
  /* Il segno è quello del materiale, lo stesso della card e della tessera: uno
   * solo, scritto in un posto solo. Qui non se ne inventa una tabella. */
  assert.doesNotMatch(editor, /icona: "/);
});

test("è la stessa strada della tendina del Report", () => {
  /* Lì il guscio scrive «⚡ Lavatrice» dentro l'option, ed è il precedente
   * citato dalla richiesta: due tendine che si comportano diverso davanti alla
   * stessa domanda sono due cose da imparare invece di una. */
  const guscio = readFileSync(
    new URL("../legacy/dashboard-runtime-it.js", import.meta.url),
    "utf8",
  );
  assert.match(guscio, /<option value="\$\{d\.sensor\}">\$\{d\.icon \|\| '⚡'\} \$\{d\.name\}<\/option>/);
});
