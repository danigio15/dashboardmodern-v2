/* La tessera del MiniPC sceglie le misure, non le parole.
 *
 * La didascalia della tessera mostra RAM e disco accanto alla CPU, e per
 * sapere quali righe fossero le tre quote leggeva l'etichetta: `CPU`, `RAM`,
 * `Disco`, `Disk`. Ma l'etichetta e' testo tradotto — in giapponese la RAM si
 * chiama メモリ e il disco ディスク, in arabo الذاكرة e القرص — e li' nessuna
 * riga superava quel confronto: la tessera aveva le letture in mano e non
 * scriveva niente sotto il numero. Segnalato in revisione sulla PR #251.
 *
 * Adesso ogni riga si porta dietro il nome della misura — `cpu`, `ram`,
 * `disco` — che non cambia con la lingua, e la didascalia sceglie da li'.
 * Queste prove guardano la tessera in tre lingue: l'italiano in cui e'
 * scritta, e due che non condividono nemmeno l'alfabeto.
 */
import assert from "node:assert/strict";
import test from "node:test";

/* Il minimo perche' la tessera possa lavorare fuori da un browser: dove
 * tenere le preferenze dei widget, e come si risolve un riferimento mappato
 * nell'entita' vera. */
globalThis.localStorage = {
  valori: new Map(),
  getItem(chiave) {
    return this.valori.has(chiave) ? this.valori.get(chiave) : null;
  },
  setItem(chiave, valore) {
    this.valori.set(chiave, String(valore));
  },
  removeItem(chiave) {
    this.valori.delete(chiave);
  },
};

const MAPPATURA = {
  "dm.server_cpu": "sensor.minipc_cpu",
  "dm.server_ram": "sensor.minipc_ram",
  "dm.server_disco": "sensor.minipc_disco",
};
globalThis.resolveEntity = (riferimento) => MAPPATURA[riferimento] || riferimento;

const STATI = {
  "sensor.minipc_cpu": { state: "42" },
  "sensor.minipc_ram": { state: "61" },
  "sensor.minipc_disco": { state: "77" },
};

const { setLocale, resetLocale } = await import("../src/core/i18n.js");
const { minipcModel } = await import("../src/sections/home-widgets-section.js");

test("in italiano la didascalia porta le altre due quote", () => {
  resetLocale();
  const tessera = minipcModel(STATI);
  assert.equal(tessera.value, "42%");
  assert.equal(tessera.caption, "RAM 61% · Disco 77%");
});

test("in giapponese e in arabo la didascalia c'e' lo stesso", async () => {
  for (const lingua of ["ja", "ar"]) {
    await setLocale(lingua, { persist: false, apply: false });
    const tessera = minipcModel(STATI);

    // La CPU resta il numero in grande, in ogni lingua.
    assert.equal(tessera.value, "42%", `${lingua}: la CPU in grande`);

    // E sotto ci sono due quote, non zero: e' esattamente quello che si
    // perdeva quando la scelta passava dalle etichette.
    const pezzi = tessera.caption.split(" · ");
    assert.equal(pezzi.length, 2, `${lingua}: due quote in didascalia, non «${tessera.caption}»`);
    assert.ok(pezzi[0].endsWith(" 61%"), `${lingua}: la RAM con il suo valore`);
    assert.ok(pezzi[1].endsWith(" 77%"), `${lingua}: il disco con il suo valore`);

    // Le parole sono tradotte davvero: se restassero in inglese questa prova
    // passerebbe anche col difetto, e non proverebbe niente.
    assert.doesNotMatch(tessera.caption, /RAM|Disco|Disk/, `${lingua}: etichette tradotte`);
  }
  resetLocale();
});

test("le righe portano il nome della misura, che non si traduce", async () => {
  await setLocale("ja", { persist: false, apply: false });
  const chiavi = minipcModel(STATI).rows.map((riga) => riga.chiave);
  assert.deepEqual(chiavi, ["cpu", "ram", "disco"]);
  resetLocale();
});
