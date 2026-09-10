/* I bidoni dei rifiuti, nella famiglia del catalogo.
 *
 * «Icone rifiuti non secondo lo stile del nostro catalogo: rendile omogenee e
 * creale, visto che non ci sono, ma ovviamente devono essere a colori e fatte
 * bene.»
 *
 * Non c'erano davvero: i materiali uscivano a emoji di sistema, che cambiano
 * faccia da un telefono all'altro e stavano accanto ai disegni in scocca blu
 * notte. Tre stili nella stessa schermata, che e' esattamente la cosa che il
 * catalogo proprietario era nato per finire.
 *
 * Il disegno e' UNO: un bidone, sempre lo stesso, nel riquadro 96x96 della
 * famiglia — stesso pannello azzurro, stessa scocca, stessa tavolozza. Quello
 * che cambia sono due cose sole:
 *
 *   · il COPERCHIO, del colore del bidone vero. Non e' una tinta inventata qui:
 *     e' la stessa che la sezione Rifiuti usa gia' per quel materiale, quindi
 *     la pastiglia della riga e il disegno non possono dire due colori diversi
 *     della stessa cosa;
 *   · l'EMBLEMA sulla scocca, chiaro sul blu notte come i simboli stampati sui
 *     cassonetti veri, che dice cosa ci va dentro.
 *
 * L'emblema sta tutto dentro un riquadro di ventisei pixel al centro della
 * scocca: e' l'unica regola che tiene undici disegni diversi dentro la stessa
 * sagoma, e a ventidue pixel — la misura vera nell'elenco — un simbolo che
 * sborda diventa una macchia sul bordo.
 *
 * Undici bidoni uguali e undici coperchi diversi si leggono a colpo d'occhio
 * anche piccoli: la forma dice «rifiuti», il colore dice quale, l'emblema lo
 * conferma quando c'e' spazio per guardarlo.
 */
import { PANNELLO, SCOCCA, FRONTALE, ACCENTO, SPENTO, guscio } from "./tavolozza-disegni.js";

/* Il verde e l'arancio degli emblemi che vogliono la loro tinta: la foglia e
 * la goccia d'olio. Sono gli stessi della tavolozza della plancia. */
const FOGLIA = 'fill="#22c55e"';
const GOCCIA = 'fill="#f97316"';

/* Il bidone senza coperchio e senza emblema: la parte che non cambia mai.
 * Corpo rastremato come quelli veri, due nervature appena accennate dentro la
 * scocca, e l'ombra appoggiata a terra perche' non sembri sospeso. */
const CASSONETTO =
  '<ellipse cx="48" cy="86" rx="25" ry="3.5" fill="#0f2942" opacity=".14"/>' +
  `<path ${SCOCCA} d="M26 40h44l-3.4 39.6A6 6 0 0 1 60.6 85H35.4a6 6 0 0 1-6-5.4Z"/>` +
  '<path fill="none" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round" opacity=".13" d="M36 46l-1 32M60 46l1 32"/>';

/* Il coperchio, del colore del bidone: barra, presa e la linea di luce che
 * tutti i disegni della famiglia hanno sopra. */
const coperchio = (colore) =>
  `<path fill="${colore}" d="M20 29h56a5 5 0 0 1 5 5v6H15v-6a5 5 0 0 1 5-5Z"/>` +
  `<path fill="${colore}" d="M41 20h14a4 4 0 0 1 4 4v5H37v-5a4 4 0 0 1 4-4Z"/>` +
  '<path fill="#ffffff" opacity=".34" d="M22 32h52a3 3 0 0 1 3 3H19a3 3 0 0 1 3-3Z"/>';

/* Gli emblemi, uno per materiale. Chiari sulla scocca, dentro il riquadro
 * 35..61 in orizzontale e 48..77 in verticale: chi ne aggiunge uno tenga i
 * suoi punti li' dentro. */
const EMBLEMI = Object.freeze({
  /* La bottiglia col collo stretto e il tappo. */
  plastica:
    `<rect ${ACCENTO} x="44.5" y="48" width="7" height="3.4" rx="1.4"/>` +
    `<path ${FRONTALE} d="M45 51.4h6V56c3 2 4.5 5 4.5 8.4V72a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4v-7.6c0-3.4 1.5-6.4 4.5-8.4Z"/>`,
  /* Il foglio con l'angolo piegato e due righe di scritto. */
  carta:
    `<path ${FRONTALE} d="M39 50h11.5l8.5 8.5V76H39Z"/>` +
    `<path ${SCOCCA} d="M50.5 50 59 58.5h-8.5Z"/>` +
    `<path fill="none" stroke="#0f2942" stroke-width="2.4" stroke-linecap="round" d="M43 64h12M43 70h8"/>`,
  /* Il calice: bottiglia e bicchiere sono due cose, e il calice non si
   * confonde con la bottiglia della plastica. */
  vetro:
    `<path ${FRONTALE} d="M40 50h16c0 7.5-3.2 12.6-8 13.8-4.8-1.2-8-6.3-8-13.8Z"/>` +
    `<rect ${FRONTALE} x="46.8" y="63" width="2.4" height="9"/>` +
    `<rect ${FRONTALE} x="41" y="72" width="14" height="3.4" rx="1.7"/>`,
  /* La mela col picciolo e la foglia. */
  organico:
    '<path fill="none" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round" d="M48 60v-7"/>' +
    `<path ${FOGLIA} d="M48.6 56.4c2-4.6 7.6-5.8 7.6-5.8s-.4 5.6-3.5 6.9-4.1-1.1-4.1-1.1Z"/>` +
    `<path ${FRONTALE} d="M48 62.4c1.6-3.2 7.2-4.2 9.4.4 2.2 4.6-1 12.8-4.6 14.6-2.2 1.1-3.8-.4-4.8-.4s-2.6 1.5-4.8.4c-3.6-1.8-6.8-10-4.6-14.6 2.2-4.6 7.8-3.6 9.4-.4Z"/>`,
  /* Il sacco annodato. */
  indifferenziato:
    '<path fill="none" stroke="#f8fafc" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M44 56.5 48 51l4 5.5"/>' +
    `<path ${FRONTALE} d="M40.5 58c0-2.4 3.2-3.6 7.5-3.6s7.5 1.2 7.5 3.6l2 14.4a4 4 0 0 1-4 4.6H42.5a4 4 0 0 1-4-4.6Z"/>`,
  /* La lattina: bocca ellittica, anello e le coste. */
  metalli:
    `<path ${FRONTALE} d="M40 54h16v19a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4Z"/>` +
    `<ellipse ${FRONTALE} cx="48" cy="54" rx="8" ry="3.2"/>` +
    `<circle ${SCOCCA} cx="48" cy="54" r="1.8"/>` +
    '<path fill="none" stroke="#0f2942" stroke-width="2.2" stroke-linecap="round" opacity=".55" d="M40.5 60h15M40.5 70h15"/>',
  /* Il rametto con due foglie. */
  verde:
    '<path fill="none" stroke="#f8fafc" stroke-width="2.8" stroke-linecap="round" d="M48 77V54"/>' +
    `<path ${FOGLIA} d="M47.5 63c-7-1-10-6.5-10-6.5s6.5-3 10 2.5ZM48.5 71c7-1 10-6.5 10-6.5s-6.5-3-10 2.5Z"/>`,
  /* La poltrona: schienale, seduta, braccioli e i piedi. */
  ingombranti:
    `<path ${FRONTALE} d="M39 52h18a3 3 0 0 1 3 3v9H36v-9a3 3 0 0 1 3-3Z"/>` +
    `<rect ${FRONTALE} x="34" y="62" width="28" height="10" rx="3"/>` +
    '<path fill="none" stroke="#f8fafc" stroke-width="2.6" stroke-linecap="round" d="M38 72v3.5M58 72v3.5"/>',
  /* La tanica con la goccia. */
  oli:
    `<path ${FRONTALE} d="M39 55h13a3 3 0 0 1 3 3v15a3.5 3.5 0 0 1-3.5 3.5H39.5A3.5 3.5 0 0 1 36 73V58a3 3 0 0 1 3-3Z"/>` +
    `<path ${FRONTALE} d="M52 50h4.5a1.5 1.5 0 0 1 1.5 1.5V56h-6Z"/>` +
    `<path ${GOCCIA} d="M45.5 61c2.8 4.2 4.2 6 4.2 8a4.2 4.2 0 0 1-8.4 0c0-2 1.4-3.8 4.2-8Z"/>`,
  /* Il biberon. Un pannolino disegnato in ventidue pixel diventa un secchiello
   * — provato — mentre il biberon si riconosce a ogni misura e dice la stessa
   * cosa: e' il bidone del bambino. */
  pannolini:
    `<path ${ACCENTO} d="M45 48h6a2 2 0 0 1 2 2v3h-10v-3a2 2 0 0 1 2-2Z"/>` +
    `<rect ${FRONTALE} x="41.5" y="53" width="13" height="3.4" rx="1.2"/>` +
    `<path ${FRONTALE} d="M42 57.5h12a2 2 0 0 1 2 2v13.5a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V59.5a2 2 0 0 1 2-2Z"/>` +
    '<path fill="none" stroke="#0f2942" stroke-width="2.2" stroke-linecap="round" opacity=".5" d="M45 63h6M45 69h6"/>',
  /* Le tre frecce del riciclo: l'anello e le punte. */
  altro: ["", ' transform="rotate(120 48 63)"', ' transform="rotate(240 48 63)"']
    .map((giro) => `<path ${FRONTALE}${giro} d="M36.5 68.4h15.5v-3.8l7 6.1-7 6.1v-3.8H36.5Z"/>`)
    .join(""),
});

/* Il ripiego: un bidone che non dice niente e' meglio di un buco, e un
 * materiale che non conosciamo il coperchio grigio ce l'ha davvero. */
const SENZA_EMBLEMA = `<circle ${SPENTO} cx="48" cy="62" r="5" opacity=".8"/>`;

/** Il corpo del disegno di un materiale, gia' col pannello della famiglia. */
export function corpoDelBidone(chiave, colore) {
  const emblema = EMBLEMI[String(chiave ?? "").trim()] || SENZA_EMBLEMA;
  return `${PANNELLO}${CASSONETTO}${coperchio(colore || "#0ea5e9")}${emblema}`;
}

/** Il disegno pronto da mettere nel documento, alla misura chiesta. */
export function disegnoDelBidone(chiave, colore, misura = 96) {
  const nome = String(chiave ?? "").trim() || "altro";
  return guscio(`bidone-${nome}`, corpoDelBidone(nome, colore), misura);
}

/** Le chiavi che un emblema ce l'hanno davvero: serve alle prove. */
export const MATERIALI_DISEGNATI = Object.freeze(Object.keys(EMBLEMI));
