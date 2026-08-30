/* Un'apertura tolta e rimessa deve restare, e deve poter avere la sua icona.
 *
 * PRIMO. Le liste sono due: `cd_gruppi_extra` — quello che l'utente ha
 * aggiunto — e `cd_gruppi_removed` — quello che ha tolto, comprese le voci di
 * serie. Il guscio le legge in quest'ordine: somma le aggiunte, poi toglie le
 * rimozioni. Ma chi aggiunge non ha mai ripulito la seconda: un'apertura tolta
 * una volta e rimessa dopo finiva in tutte e due, e la sottrazione arrivava
 * per ultima. Nel giro in corso si vedeva — l'aggiunta entra anche in memoria
 * — e al riavvio spariva. Da fuori si legge «non riesco piu' ad aggiungerne
 * altre»: si aggiungevano davvero, e non tornavano piu' su.
 *
 * SECONDO. L'icona la decideva il gruppo e basta: undici aperture, undici
 * porte uguali, e la finestra del bagno indistinguibile dalla portafinestra
 * del salotto.
 */
import assert from "node:assert/strict";
import test from "node:test";

/* Il modulo tocca il documento e il magazzino del browser: qui se ne mette in
 * piedi giusto quanto basta a farlo girare, prima di caricarlo. */
const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { alertIcon, riparaAggiunteTolte } = await import("../src/sections/alerts-section.js");

function scrivi(chiave, valore) {
  magazzino.set(chiave, JSON.stringify(valore));
}
function leggi(chiave) {
  return JSON.parse(magazzino.get(chiave) || "null");
}

test("un'apertura che sta in tutt'e due le liste resta aggiunta", () => {
  magazzino.clear();
  scrivi("cd_gruppi_extra", { win: ["binary_sensor.finestra_bagno", "binary_sensor.porta_garage"] });
  scrivi("cd_gruppi_removed", { win: ["binary_sensor.finestra_bagno", "binary_sensor.lucernario"] });
  assert.equal(riparaAggiunteTolte(), true);
  /* Chi e' stato rimesso esce dalla lista dei tolti; chi e' stato tolto e
   * basta ci resta — non e' compito di questo giro riportarlo indietro. */
  assert.deepEqual(leggi("cd_gruppi_removed").win, ["binary_sensor.lucernario"]);
  /* E la seconda passata non ha piu' niente da fare. */
  assert.equal(riparaAggiunteTolte(), false);
});

test("le liste che gia' vanno d'accordo non si toccano", () => {
  magazzino.clear();
  scrivi("cd_gruppi_extra", { win: ["binary_sensor.porta_garage"] });
  scrivi("cd_gruppi_removed", { win: ["binary_sensor.lucernario"] });
  assert.equal(riparaAggiunteTolte(), false);
  assert.deepEqual(leggi("cd_gruppi_removed").win, ["binary_sensor.lucernario"]);
});

test("la riparazione guarda ogni gruppo, non solo le aperture", () => {
  magazzino.clear();
  scrivi("cd_gruppi_extra", { batt: ["sensor.batteria_garage"] });
  scrivi("cd_gruppi_removed", { batt: ["sensor.batteria_garage"], win: ["binary_sensor.x"] });
  assert.equal(riparaAggiunteTolte(), true);
  assert.deepEqual(leggi("cd_gruppi_removed").batt, []);
  assert.deepEqual(leggi("cd_gruppi_removed").win, ["binary_sensor.x"]);
});

test("l'icona e' quella scelta, o quella del gruppo se non se n'e' scelta", () => {
  magazzino.clear();
  scrivi("cd_avvisi_icone", { "binary_sensor.finestra_bagno": "🪟" });
  assert.equal(alertIcon("binary_sensor.finestra_bagno", "win"), "🪟");
  assert.equal(alertIcon("binary_sensor.porta_garage", "win"), "🚪");
  assert.equal(alertIcon("sensor.batteria_garage", "batt"), "🔋");
  /* Un'entita' senza gruppo riconosciuto non resta muta. */
  assert.equal(alertIcon("sensor.qualcosa", "boh"), "🔔");
});

/* «Apertura: ancora non si puo' cambiare icona»: il campo era una casella di
 * testo nuda, e l'unica strada era l'emoji dalla tastiera. Ora accanto al
 * campo c'e' il tasto che apre il catalogo — lo stesso selettore delle icone
 * degli avvisi, dove porte, cancelli e serrature ci sono gia' — e il campo
 * resta scrivibile per chi vuole un'emoji fuori catalogo. */
test("l'icona della porta si sceglie dal catalogo, non solo dalla tastiera", async () => {
  const { readFile } = await import("node:fs/promises");
  const editor = await readFile(
    new URL("../src/sections/security-doors-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(editor, /data-door-icon-pick="dm-door-\$\{index\}-icon"/);
  assert.match(editor, /openEmojiPicker\(input, /);
  const beta11 = await readFile(
    new URL("../src/sections/beta11-real-device-polish-section.js", import.meta.url),
    "utf8",
  );
  assert.match(beta11, /export function openEmojiPicker/);
});
