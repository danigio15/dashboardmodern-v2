/* L'icona di un avviso segue la classe che Home Assistant dichiara (#238).
 *
 * Il rilevamento automatico delle aperture non c'e' piu': la tessera che
 * alimentava se n'e' andata — «viene gia' gestito da Finestre, se li si mette
 * il sensore finestra dice quale e' aperto, quindi e' un duplicato» — e con
 * lei la lista che riempiva.
 *
 * Resta la meta' che vale per qualunque avviso: Home Assistant sa distinguere
 * una porta da una finestra e lo dichiara in `device_class`, e quel dato e'
 * piu' onesto di un disegno unico per tutto il gruppo. Vale come ripiego: chi
 * un'icona l'ha scelta a mano continua a vedere la sua.
 */
import assert from "node:assert/strict";
import test from "node:test";

/* I moduli toccano il documento e il magazzino del browser: qui se ne mette
 * in piedi giusto quanto basta a farli girare, prima di caricarli. */
const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { alertIcon } = await import("../src/sections/alerts-section.js");

const scrivi = (chiave, valore) => magazzino.set(chiave, JSON.stringify(valore));

const porta = { state: "off", attributes: { device_class: "door" } };
const finestra = { state: "off", attributes: { device_class: "window" } };

test("porta e finestra si distinguono senza scegliere niente", () => {
  magazzino.clear();
  globalThis._RAW_STATES = {
    "binary_sensor.porta_ingresso": porta,
    "binary_sensor.finestra_bagno": finestra,
    "binary_sensor.garage": { state: "off", attributes: { device_class: "garage_door" } },
  };
  assert.equal(alertIcon("binary_sensor.porta_ingresso", "win"), "🚪");
  assert.equal(alertIcon("binary_sensor.finestra_bagno", "win"), "🪟");
  assert.equal(alertIcon("binary_sensor.garage", "win"), "🚪");
  delete globalThis._RAW_STATES;
});

test("l'icona scelta a mano vince sulla classe", () => {
  magazzino.clear();
  scrivi("cd_avvisi_icone", { "binary_sensor.finestra_bagno": "🏖️" });
  globalThis._RAW_STATES = { "binary_sensor.finestra_bagno": finestra };
  assert.equal(alertIcon("binary_sensor.finestra_bagno", "win"), "🏖️");
  delete globalThis._RAW_STATES;
});

test("senza classe si torna al gruppo, come prima", () => {
  magazzino.clear();
  globalThis._RAW_STATES = { "binary_sensor.contatto": { state: "off", attributes: {} } };
  /* Un gruppo che c'e' ancora: `win` non e' piu' fra quelli sorvegliati, e
   * chiedergli un'icona vorrebbe dire chiederla al vuoto. */
  assert.equal(alertIcon("binary_sensor.allagamento", "allag"), "💧");
  assert.equal(alertIcon("sensor.batteria", "batt"), "🔋");
  assert.equal(alertIcon("sensor.qualcosa", "boh"), "🔔");
  delete globalThis._RAW_STATES;
});
