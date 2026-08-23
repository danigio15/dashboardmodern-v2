/* La foto dell'auto ha UNA casa: il profilo. Tutto il resto la segue.
 *
 * Il segnalato: «le foto caricate le ho cambiate ma esce ancora quella
 * vecchia». Il pannello mostrava le foto giuste — leggeva il profilo — e la
 * plancia disegnava quella vecchia — leggeva le due caselle piatte, che sono
 * per-dispositivo e dalla 1.1.7 non viaggiano piu' con la configurazione.
 * Due fonti, due verita'. Questi test inchiodano la struttura nuova:
 *
 *  - il disegno legge il profilo attivo, la stessa fonte del pannello, e
 *    risemina le caselle a ogni passata (derivate, mai piu' fonte);
 *  - il bottone verde «SALVA SEZIONE» salva anche le foto toccate: salvava
 *    solo le entita', e il percorso scritto li' si perdeva in silenzio;
 *  - all'avvio la copia canonica si allinea a `cd_ev_cars` PRIMA del persist:
 *    chi salvava e ricaricava subito — il toast dice proprio «ricarica per
 *    applicare» — riapriva con la copia vecchia che riscriveva la lista;
 *  - cancellata l'ultima auto, se ne vanno anche le caselle del disegno e
 *    l'indice dell'attiva: «quando cancello non cancella tutto», chiuso.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("il disegno legge il profilo attivo e risemina le caselle", () => {
  const sezione = leggi("sections/ev-section.js");
  const corpo = sezione.slice(
    sezione.indexOf("export function applyVehicleAsset()"),
    sezione.indexOf("/* ── the two photos, in the configuration"),
  );
  assert.match(corpo, /const photos = fotoDelProfiloAttivo\(\);/,
    "la plancia deve disegnare dalla stessa fonte del pannello");
  assert.doesNotMatch(corpo, /const photos = configuredPhotos\(\);/,
    "le caselle piatte sono per-dispositivo: come fonte mostrano la foto di mesi fa");
  assert.match(corpo, /storePhoto\(EV_PHOTO_KEYS\.idle, photos\.idle\);/);
  assert.match(corpo, /storePhoto\(EV_PHOTO_KEYS\.plugged, photos\.plugged\);/);
});

test("la correzione del percorso storto arriva fino al profilo", () => {
  /* Se si fermasse alle caselle, la risemina del giro dopo la annullerebbe e
   * la correzione ripartirebbe a ogni disegno, per sempre. */
  const sezione = leggi("sections/ev-section.js");
  const corpo = sezione.slice(
    sezione.indexOf("export function applyVehicleAsset()"),
    sezione.indexOf("/* ── the two photos, in the configuration"),
  );
  assert.match(corpo, /saveProfilePhotos\(\{/);
});

test("«SALVA SEZIONE» salva anche le foto toccate", () => {
  const sezione = leggi("sections/ev-section.js");
  assert.match(sezione, /root\.edSaveSezione\s*=\s*saveSection/,
    "il bottone verde e' quello che chiunque preme: senza il giro delle foto le perdeva");
  const corpo = sezione.slice(sezione.indexOf("function saveSection(button"));
  assert.match(corpo, /data-ev-photo-edited="true"/,
    "si salva solo un campo toccato: un pannello mai aperto non deve riscrivere niente");
  assert.match(corpo, /savePhotos\(panel\)/);
});

test("all'avvio la copia canonica si allinea a cd_ev_cars, non il contrario", async () => {
  const { DashboardStore } = await import("../src/core/dashboard-store.js");
  const dati = new Map();
  const storage = {
    getItem: (chiave) => (dati.has(chiave) ? dati.get(chiave) : null),
    setItem: (chiave, valore) => dati.set(chiave, String(valore)),
    removeItem: (chiave) => dati.delete(chiave),
  };
  /* La copia canonica e' rimasta indietro di un giro: porta la foto vecchia.
   * `cd_ev_cars` porta quella appena salvata, e la pagina e' stata ricaricata
   * prima che la copia si aggiornasse. */
  const vecchia = [{ name: "T03", img: "/local/scia-vecchia.png", imgPlugged: "" }];
  const nuova = [{ name: "T03", img: "/local/leapmotor.png", imgPlugged: "/local/boiler.png" }];
  dati.set(
    "dm_dashboard_state",
    JSON.stringify({ schema_version: 99, sections: { ev: vecchia }, visibility: {} }),
  );
  dati.set("cd_ev_cars", JSON.stringify(nuova));
  const store = new DashboardStore({ storage });
  store.migrate();
  const auto = store.getSection("ev");
  assert.equal(auto[0]?.img, "/local/leapmotor.png",
    "la lista appena salvata deve vincere sulla fotografia vecchia della copia");
  assert.equal(auto[0]?.imgPlugged, "/local/boiler.png");
  const riscritta = JSON.parse(dati.get("cd_ev_cars"));
  assert.equal(riscritta[0]?.img, "/local/leapmotor.png",
    "il persist dell'avvio non deve riscrivere la lista con la copia vecchia");
});

test("una lista cancellata resta cancellata anche per la copia", async () => {
  const { DashboardStore } = await import("../src/core/dashboard-store.js");
  const dati = new Map();
  const storage = {
    getItem: (chiave) => (dati.has(chiave) ? dati.get(chiave) : null),
    setItem: (chiave, valore) => dati.set(chiave, String(valore)),
    removeItem: (chiave) => dati.delete(chiave),
  };
  const fantasma = [{ name: "B10", img: "/local/scia.png" }];
  dati.set(
    "dm_dashboard_state",
    JSON.stringify({ schema_version: 99, sections: { ev: fantasma }, visibility: {} }),
  );
  dati.set("cd_ev_cars", JSON.stringify([]));
  const store = new DashboardStore({ storage });
  store.migrate();
  assert.deepEqual(store.getSection("ev"), [],
    "una lista vuota ma presente e' una scelta: l'auto cancellata non risorge dalla copia");
});

test("cancellata l'ultima auto, se ne vanno caselle e indice", () => {
  const sezione = leggi("sections/ev-section.js");
  const corpo = sezione.slice(sezione.indexOf("function carButton("));
  assert.match(corpo, /if \(primaDelTasto\.length && !elenco\.length\)/,
    "si pulisce solo quando la lista si e' svuotata ADESSO: una lista vuota da sempre e' il formato vecchio a caselle sole");
  assert.match(corpo, /storePhoto\(EV_PHOTO_KEYS\.idle, ""\)/);
  assert.match(corpo, /storePhoto\(EV_PHOTO_KEYS\.plugged, ""\)/);
  assert.match(corpo, /removeItem\("cd_ev_car_active"\)/);
});
