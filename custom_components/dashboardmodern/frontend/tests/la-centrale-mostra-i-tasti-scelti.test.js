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
