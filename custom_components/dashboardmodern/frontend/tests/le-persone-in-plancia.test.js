/* Le persone hanno una casa in plancia, e la loro chiave viaggia.
 *
 * La sezione disegna le card in cima alla Home e l'editor scrive `cd_people`:
 * questa prova difende i fili che tengono insieme la cosa — la chiave nella
 * configurazione condivisa (con la revisione alzata, perché una chiave
 * aggiunta si travasa dai salvataggi più vecchi), la chiave sotto gli occhi
 * del cancello degli eventi (senza, il cambio zona di una persona non
 * ridisegnerebbe niente), e le due sezioni installate dal runtime.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("cd_people viaggia nella configurazione condivisa, alla revisione 5", async () => {
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION } = await import(
    "../src/sections/config-persistence-section.js"
  );
  assert.ok(CONFIG_KEYS.includes("cd_people"), "le persone devono viaggiare tra i dispositivi");
  assert.ok(CONFIG_KEYS_REVISION >= 5, "una chiave aggiunta alza la revisione");
});

test("il cancello degli eventi conosce cd_people", () => {
  const gate = leggi("core/state-event-gate.js");
  assert.match(
    gate,
    /"cd_people"/,
    "senza, i cambi di zona delle persone non arrivano alle card",
  );
});

test("il runtime installa le card e l'editor delle persone", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installPeopleSection\(\)/);
  assert.match(runtime, /installPeopleEditorSection\(\)/);
});

test("le card stanno in cima alla Home e ricadono sull'avatar se la foto è rotta", () => {
  const sezione = leggi("sections/people-section.js");
  assert.match(sezione, /dashboard-pills-row/, "l'ancora è la fila delle pillole di stato");
  assert.match(sezione, /addEventListener\("error"/, "la foto rotta non resta come icona spezzata");
  assert.match(sezione, /dashboardmodern:state-changed/, "le card seguono lo stato vivo");
});

test("l'editor usa il selettore foto condiviso e valida l'entità", () => {
  const editor = leggi("sections/people-editor-section.js");
  assert.match(editor, /pickMediaImage/, "la foto passa dallo stesso selettore dell'auto");
  assert.match(editor, /person\|device_tracker/, "solo entità che sanno dove sta una persona");
  assert.match(editor, /AVATAR_EMOJI/, "l'avatar si sceglie tra facce e persone, non tra prese");
  assert.match(editor, /builderMarkup/, "il costruttore della faccia sta nell'editor");
});

test("il ritratto vive sulla card: si compone, respira e sbatte le ciglia", () => {
  const sezione = leggi("sections/people-section.js");
  assert.match(sezione, /ritrattoVivo/, "la card monta il ritratto vivo, non un'immagine ferma");
  assert.match(sezione, /fermaRitrattiPersi/, "chi non e' piu' a schermo smette di battere le ciglia");
  /* L'espressione la decide quello che la plancia sa gia' della persona: chi
   * e' a casa e' contento, chi ha la batteria agli sgoccioli o il telefono
   * fermo da ore ha le palpebre pesanti. */
  assert.match(sezione, /assonnato/);
  assert.match(sezione, /contento/);

  const disegno = leggi("sections/person-avatar-section.js");
  assert.match(disegno, /dmAvatarRespiro/, "il respiro e' CSS: lo fa il compositore");
  assert.match(disegno, /requestAnimationFrame/, "il battito e' a fotogrammi, ma solo mentre dura");
  assert.match(disegno, /setTimeout/, "e fuori dal battito si dorme");
  assert.doesNotMatch(disegno, /setInterval/, "un ciclo che non si ferma mai su una plancia non ci sta");

  /* Il modello dice quali due immagini servono e come incastrarle, e basta:
   * si prova senza un browser, ed e' il motivo per cui e' un modulo suo. */
  const modello = leggi("core/avatar-3d.js");
  assert.doesNotMatch(modello, /\bdocument\.|getContext|createElement|@keyframes/,
    "il modello non tocca il documento: dice solo quali pezzi");
});

test("il campo dell'entità persona è riconosciuto anche da vuoto", () => {
  /* La guardia dei campi riconosce un'entita' dal placeholder: senza `person`
   * e `device_tracker` nell'elenco, il campo vuoto restava una casella nuda e
   * la ricerca non si apriva — il valore pieno lo salvava per caso. */
  const guardia = leggi("sections/entity-picker-guard-section.js");
  assert.match(guardia, /person\|device_tracker\|zone/, "i domini delle persone nel placeholder");
});
