/* Le aperture scoperte dopo il primo avvio entrano da sole (#238).
 *
 * Il primo avvio rilevava porte e finestre e le metteva nel gruppo `win`; il
 * contatto montato la settimana dopo restava fuori finche' qualcuno non lo
 * scriveva a mano. Qui vale lo stesso meccanismo degli allagamenti e del fumo:
 * si confronta cio' che c'e' in casa con cio' che si conosce gia' — il gruppo
 * vivo, le aggiunte, le rimozioni — e solo il nuovo si aggiunge. Le rimozioni
 * dell'utente restano rimozioni.
 *
 * E gia' che Home Assistant dichiara la classe, l'icona di ripiego la segue:
 * porta per le porte, finestra per le finestre — senza toccare le icone che
 * l'utente ha scelto a mano.
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

const { isOpeningSensor, newOpenings, OPENING_DEVICE_CLASSES } = await import(
  "../src/sections/smoke-alerts-section.js"
);
const { alertIcon } = await import("../src/sections/alerts-section.js");

const scrivi = (chiave, valore) => magazzino.set(chiave, JSON.stringify(valore));

const porta = { state: "off", attributes: { device_class: "door" } };
const finestra = { state: "off", attributes: { device_class: "window" } };

test("un'apertura e' quello che Home Assistant dichiara tale", () => {
  assert.deepEqual([...OPENING_DEVICE_CLASSES], ["door", "window", "opening", "garage_door"]);
  assert.equal(isOpeningSensor("binary_sensor.porta_ingresso", porta), true);
  assert.equal(isOpeningSensor("binary_sensor.finestra_bagno", finestra), true);
  assert.equal(
    isOpeningSensor("binary_sensor.garage", {
      state: "off",
      attributes: { device_class: "garage_door" },
    }),
    true,
  );
  // Qui la classe non si indovina dal nome: e' il rilevamento, non la stima.
  assert.equal(isOpeningSensor("binary_sensor.porta_garage", { attributes: {} }), false);
  // Un movimento non e' un'apertura, e un cover non e' un binary_sensor.
  assert.equal(
    isOpeningSensor("binary_sensor.mov", { state: "on", attributes: { device_class: "motion" } }),
    false,
  );
  assert.equal(isOpeningSensor("cover.tapparella", finestra), false);
});

test("solo le aperture mai viste si aggiungono", () => {
  const states = {
    "binary_sensor.porta_ingresso": porta,
    "binary_sensor.finestra_bagno": finestra,
    "binary_sensor.finestra_nuova": finestra,
    "light.cucina": { state: "on", attributes: {} },
  };
  const nuove = newOpenings(
    { win: ["binary_sensor.porta_ingresso"] },
    {},
    states,
    ["binary_sensor.finestra_bagno"],
  );
  assert.deepEqual(nuove, ["binary_sensor.finestra_nuova"]);
});

test("una rimozione dell'utente e' una scelta, non un vuoto da riempire", () => {
  const states = { "binary_sensor.porta_ingresso": porta };
  const nuove = newOpenings({}, { win: ["binary_sensor.porta_ingresso"] }, states, []);
  assert.deepEqual(nuove, []);
});

test("una lista sporca non ferma il rilevamento", () => {
  /* Un salvataggio corrotto trasformava `extras.win` in un oggetto: qui non
   * deve morire niente, si guarda quel che si puo' e si va. */
  const states = { "binary_sensor.porta_ingresso": porta };
  const nuove = newOpenings({ win: { rotta: true } }, { win: null }, states, undefined);
  assert.deepEqual(nuove, ["binary_sensor.porta_ingresso"]);
});

/* ── l'icona che segue la classe ─────────────────────────────────────────── */

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
  assert.equal(alertIcon("binary_sensor.contatto", "win"), "🚪");
  assert.equal(alertIcon("sensor.batteria", "batt"), "🔋");
  assert.equal(alertIcon("sensor.qualcosa", "boh"), "🔔");
  delete globalThis._RAW_STATES;
});
