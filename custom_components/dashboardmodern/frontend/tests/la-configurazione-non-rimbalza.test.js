/* La configurazione non rimbalza piu' fra le plance.
 *
 * Il segnalato, al nono giro: la foto dell'auto OSCILLA da sola fra due
 * vetture, ogni pochi secondi, sulla stessa pagina. Non era piu' il disegno:
 * erano i DATI, riscritti a intervalli dal ciclo della configurazione
 * condivisa. Ogni plancia accesa si faceva scrittore — il persist del negozio
 * riscrive le chiavi anche senza gesti, e quelle riscritture venivano marcate
 * «in sospeso» — e una plancia rimasta aperta col runtime vecchio rispingeva
 * per sempre i suoi dati stantii, che il telefono aggiornato accettava e poi
 * ricopriva, avanti e indietro.
 *
 * Tre regole chiudono il rimbalzo:
 *  - le scritture di proiezione del negozio non sono gesti e non marcano;
 *  - un transact che cambia davvero il contenuto e' un gesto, e lo annuncia;
 *  - il recinto di generazione: uno scatto scritto da un runtime vecchio non
 *    vince su un dispositivo gia' configurato.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("uno scatto di generazione vecchia non vince su una plancia configurata", async () => {
  const { sharedReconcileAction, WRITER_GENERATION } = await import(
    "../src/sections/config-persistence-section.js"
  );
  const vecchio = {
    revision: 41,
    updated_at: 1000,
    keys_revision: 4,
    // Il runtime vecchio il campo non lo manda proprio.
    values: { cd_ev_cars: '[{"name":"B10","img":"/local/scia-vecchia.png"}]' },
  };
  const locale = { cd_ev_cars: '[{"name":"T03","img":"/local/leapmotor.png"}]' };
  assert.equal(
    sharedReconcileAction({
      snapshot: vecchio,
      local: locale,
      localConfigured: true,
      pendingAt: 0,
      syncedRevision: 40,
    }),
    "push-local",
    "la copia propria si rispinge finche' la plancia vecchia non viene ricaricata",
  );
  // Fra dispositivi della stessa generazione il recinto non decide mai:
  // valgono le regole di sempre (niente in sospeso -> si adotta il remoto).
  assert.equal(
    sharedReconcileAction({
      snapshot: { ...vecchio, writer_generation: WRITER_GENERATION },
      local: locale,
      localConfigured: true,
      pendingAt: 0,
      syncedRevision: 40,
    }),
    "restore-remote",
  );
  // E un dispositivo NON configurato adotta anche uno scatto vecchio: e' una
  // plancia nuova che eredita, non un duello.
  assert.equal(
    sharedReconcileAction({
      snapshot: vecchio,
      local: {},
      localConfigured: false,
      pendingAt: 0,
      syncedRevision: 0,
    }),
    "restore-remote",
  );
});

test("la generazione viaggia nella busta e si rilegge", async () => {
  const { normalizeSharedSnapshot, WRITER_GENERATION } = await import(
    "../src/sections/config-persistence-section.js"
  );
  assert.equal(WRITER_GENERATION >= 1, true);
  const letto = normalizeSharedSnapshot({
    revision: 7,
    writer_generation: 1,
    values: { cd_ev_cars: "[]" },
  });
  assert.equal(letto.writer_generation, 1);
  assert.equal(normalizeSharedSnapshot({ revision: 7, values: {} }).writer_generation, 0);
  const sezione = leggi("sections/config-persistence-section.js");
  assert.match(sezione, /writer_generation: WRITER_GENERATION,/,
    "lo scatto spinto deve dichiarare la propria generazione");
});

test("le scritture di proiezione del negozio non sono gesti", () => {
  const sezione = leggi("sections/config-persistence-section.js");
  const corpo = sezione.slice(sezione.indexOf("function installStorageMutationBridge"));
  const setItem = corpo.slice(0, corpo.indexOf("storage.removeItem = function"));
  const removeItem = corpo.slice(corpo.indexOf("storage.removeItem = function"));
  assert.match(setItem, /!storage\.__dashboardStoreProjecting/,
    "il persist riscrive le chiavi anche senza gesti: marcarlo faceva di ogni plancia uno scrittore");
  assert.match(
    removeItem.slice(0, removeItem.indexOf("__dmPersistenceMutationBridge = true")),
    /!storage\.__dashboardStoreProjecting/,
  );
  assert.match(sezione, /"dashboardmodern:store-user-write", \(\) => markPending\(\)/,
    "i gesti veri che passano dal negozio devono continuare a sincronizzare");
});

test("un transact che cambia il contenuto annuncia il gesto, uno identico no", async () => {
  const { DashboardStore } = await import("../src/core/dashboard-store.js");
  const dati = new Map();
  const storage = {
    getItem: (chiave) => (dati.has(chiave) ? dati.get(chiave) : null),
    setItem: (chiave, valore) => dati.set(chiave, String(valore)),
    removeItem: (chiave) => dati.delete(chiave),
  };
  const store = new DashboardStore({ storage });
  store.migrate();
  const annunci = [];
  const originale = globalThis.dispatchEvent;
  globalThis.dispatchEvent = (event) => {
    if (event?.type === "dashboardmodern:store-user-write") annunci.push(event.detail);
    return true;
  };
  try {
    await store.transact("ev", "test-save", () => {
      store.state.sections.ev = [{ name: "T03", img: "/local/leapmotor.png" }];
    });
    assert.equal(annunci.length, 1, "un salvataggio vero deve annunciarsi");
    await store.transact("ev", "test-noop", () => {});
    assert.equal(annunci.length, 1, "un transact che non cambia niente non e' un gesto");
  } finally {
    globalThis.dispatchEvent = originale;
  }
});

test("il ripristino resta ripristino anche fuori dall'idratazione", () => {
  const sezione = leggi("sections/config-persistence-section.js");
  const corpo = sezione.slice(sezione.indexOf("function refreshRuntimeAfterRestore"));
  assert.match(corpo.slice(0, 900), /__DASHBOARDMODERN_PERSIST_RESTORE__ = true/,
    "la rimigrazione del negozio dopo un ripristino non deve marcare gesti");
});

test("il conflitto esaurito non adotta lo scatto di un runtime vecchio", () => {
  const sezione = leggi("sections/config-persistence-section.js");
  const corpo = sezione.slice(sezione.indexOf("async function pushShared"));
  assert.match(corpo, /rimasto\.writer_generation < WRITER_GENERATION && configured/,
    "cedere il duello proprio a chi il recinto ferma rimetterebbe la foto vecchia");
});

test("lo scatto spinto porta la generazione fino al backend", () => {
  /* Il recinto vive del campo scritto: `snapshot()` lo dichiara, ma la busta
   * del websocket veniva ricostruita a mano con tre campi soltanto — il
   * backend timbrava 0 su ogni scrittura e il recinto scattava CONTRO ogni
   * scatto remoto: due dispositivi aggiornati si sarebbero rispinti a
   * vicenda per sempre. */
  const sezione = leggi("sections/config-persistence-section.js");
  const corpo = sezione.slice(sezione.indexOf("function sharedSet"));
  assert.match(
    corpo.slice(0, 900),
    /writer_generation: Number\(value\.writer_generation\) \|\| WRITER_GENERATION/,
    "sharedSet deve inoltrare la generazione, o il backend timbra 0",
  );
});
