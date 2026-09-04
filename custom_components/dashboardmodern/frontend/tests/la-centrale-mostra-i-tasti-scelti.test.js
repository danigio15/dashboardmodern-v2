/* Quali tasti dell'antifurto si vedono: quello che la centrale accetta, meno
 * quello che si e' scelto di non vedere.
 *
 * La 1.3.0 ha smesso di mostrare tasti che non facevano niente, leggendo
 * `supported_features`. Restava l'altra meta': una Ring accetta cinque
 * inserimenti, e chi in vacanza non ci va mai si ritrovava due tasti che non
 * premera' mai davanti a quello che usa ogni sera. Adesso la fila si spunta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALARM_MODE_CHOICE_KEY,
  alarmHiddenModes,
  alarmVisibleModes,
} from "../src/core/alarm-panel.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

/* Una centrale che accetta tutto: casa, fuori, notte, vacanza, parziale. */
const COMPLETA = { attributes: { supported_features: 1 | 2 | 4 | 16 | 32 } };
/* Ring via ring-mqtt: casa e fuori, e basta. */
const RING = { attributes: { supported_features: 3 } };

const modi = (stateObj, scelte) => alarmVisibleModes(stateObj, scelte).map((voce) => voce.mode);

test("senza scelta si vede tutto quello che la centrale accetta", () => {
  assert.deepEqual(modi(COMPLETA, null), ["home", "away", "night", "vacation", "custom", "disarm"]);
  assert.deepEqual(modi(RING, []), ["home", "away", "disarm"]);
});

test("una modalita' tolta sparisce dalla fila", () => {
  assert.deepEqual(modi(COMPLETA, ["vacation", "custom"]), ["home", "away", "night", "disarm"]);
});

test("lo sblocco non si toglie: e' l'unico che deve esserci sempre", () => {
  assert.ok(modi(COMPLETA, ["disarm"]).includes("disarm"));
});

test("togliere una modalita' che la centrale non ha non cambia niente", () => {
  assert.deepEqual(modi(RING, ["night", "vacation"]), ["home", "away", "disarm"]);
});

test("toglierle tutte non lascia la sezione col solo sblocco", () => {
  /* Non e' una preferenza, e' un gesto sbagliato: si ignora e si torna a
   * mostrare quello che la centrale accetta. */
  assert.deepEqual(modi(RING, ["home", "away"]), ["home", "away", "disarm"]);
});

test("la memoria si legge in tutte le forme in cui puo' arrivare", () => {
  assert.deepEqual(alarmHiddenModes(["night"]), ["night"]);
  // La forma a mappa, come la scriverebbe un elenco di interruttori.
  assert.deepEqual(alarmHiddenModes({ night: false, away: true }), ["night"]);
  // Nomi che non sono modalita' non entrano.
  assert.deepEqual(alarmHiddenModes(["notte", "night", 7, null]), ["night"]);
  assert.deepEqual(alarmHiddenModes("no"), []);
  assert.deepEqual(alarmHiddenModes(undefined), []);
});

test("la casella ha un nome, e chi la scrive e chi la legge usano quello", () => {
  assert.equal(ALARM_MODE_CHOICE_KEY, "cd_antifurto_modi");
  const vetrina = leggi("sections/security-showcase-section.js");
  assert.match(vetrina, /ALARM_MODE_CHOICE_KEY/,
    "la vetrina legge la scelta, altrimenti spuntarla non si vedrebbe");
  const editor = leggi("sections/alarm-modes-editor-section.js");
  assert.match(editor, /ALARM_MODE_CHOICE_KEY/);
  /* E le pastiglie da spuntare sono solo quelle che la centrale accetta: si
   * chiede a chi la centrale ce l'ha in mano invece di risolverla due volte. */
  assert.match(editor, /dmAlarmSupportedModes/);
  assert.match(vetrina, /root\.dmAlarmSupportedModes\s*=/);
});

/* ── e le tre cose che la review ha trovato dopo ────────────────────────────
 *
 * Tre difetti che nascono tutti dalla stessa distrazione: la scelta di cosa si
 * vede e' stata trattata come se fosse la stessa cosa di cosa la centrale sa
 * fare. Sono due domande diverse, e confonderle costa.
 */

test("la scelta viaggia con la configurazione, come tutte le altre", () => {
  /* Senza il suo nome nell'elenco delle chiavi gestite, il salvataggio partiva
   * lo stesso ma senza il valore: la scelta restava sul telefono che l'aveva
   * fatta, spariva dagli altri dispositivi e dal backup non usciva. */
  const persistenza = leggi("sections/config-persistence-section.js");
  assert.match(persistenza, /"cd_antifurto_modi"/);
  assert.match(persistenza, /"cd_clima_rapido"/);
  /* E chi aggiunge chiavi alza la revisione, altrimenti un salvataggio vecchio
   * che quelle chiavi non le ha non viene completato con quelle di qui.
   * (La 14 aggiunge il verso girato dei sensori, #244; la 15 lo scaldabagno
   * elettrico, #253; la 16 la scelta degli impianti termici e la caldaia,
   * sempre #253; la 17 il gruppo di continuita', #256; la 18 i calendari,
   * #259; la 19 le sezioni che si fa l'utente, #262; la 20 gli impianti
   * solari, che adesso possono essere piu' d'uno; la 21 le aree d'allarme,
   * #285, che sono la stessa cosa per la centrale; la 22 come si vede
   * l'energia in Home con piu' impianti, #286; la 23 la doppia conferma
   * delle aperture, #275.) */
  assert.match(persistenza, /CONFIG_KEYS_REVISION = 26/);
});

test("una modalita' nascosta a mano non ne accende un'altra al posto suo", () => {
  /* Il ripiego su «Fuori» e' per le centrali che un inserimento non lo
   * dichiarano. Se la centrale lo dichiara ed e' chi guarda ad averlo tolto,
   * accendere «Fuori» direbbe che la casa e' inserita fuori mentre e' inserita
   * in casa: su un antifurto e' la bugia peggiore. */
  const vetrina = leggi("sections/security-showcase-section.js");
  /* La regola sta in `modoAcceso`, che e' quello che rispondono sia il tasto
   * acceso della pagina sia quello della tessera della Home (#316). */
  const pezzo = vetrina.slice(vetrina.indexOf("function modoAcceso"), vetrina.indexOf("export function alarmModeButtons"));
  assert.match(pezzo, /alarmModes\(stateObj\)/,
    "il ripiego si calcola su quello che la centrale accetta");
  assert.match(pezzo, /modiVisibili\(stateObj\)\.some/,
    "e poi si spegne tutto se quel tasto non e' fra quelli che si vedono");
  assert.doesNotMatch(pezzo, /alarmActiveMode\(\s*state,\s*modiVisibili/,
    "passare le sole visibili e' esattamente il difetto");
  assert.match(vetrina, /root\.dmAlarmActiveMode = \(state\) => modoAcceso\(state\)/,
    "la plancia storica chiede la stessa regola, non una sua copia");
});

test("il limite conta le modalita' che la centrale accetta adesso, non i ricordi", () => {
  /* Chi cambia centrale si porta dietro nella casella nomi che oggi non
   * vogliono dire piu' niente: contandoli si arrivava al limite con due
   * modalita' ancora in fila, e la plancia rispondeva «almeno una deve
   * restare» a chi ne vedeva due. */
  const editor = leggi("sections/alarm-modes-editor-section.js");
  assert.match(editor, /accettabili\.has\(voce\)/);
  assert.match(editor, /nascoste\.length >= accettabili\.size/);
  assert.doesNotMatch(editor, /fuori\.size >= accettate\(\)\.length/);
});
