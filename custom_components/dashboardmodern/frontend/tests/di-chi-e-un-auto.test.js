/* Cos'e' un'auto, e chi comanda.
 *
 * La sezione EV non aveva bug: aveva sei padroni. `cd_ev_cars` era letta e
 * riscritta da nove posti diversi, e ogni correzione fatta negli anni e' stata
 * un argine contro uno di loro — si tappava un lato e l'acqua usciva dall'altro.
 *
 * Questi test difendono le tre regole del padrone unico: l'identita' non e' il
 * nome, le foto appartengono all'auto, e attiva e' un'auto — non una posizione.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  VEHICLE_KEY_FIELD,
  VEHICLE_OVERRIDES_FIELD,
  VEHICLE_SEQ_FIELD,
  nuovoVeicolo,
  nuovoVeicoloId,
  normalizeVehicle,
  pickVehicle,
  removeVehicle,
  storedVehicles,
  updateVehicle,
  vehicleEntities,
  vehicleIndex,
  vehicleLabel,
  vehicleList,
  vehiclePhoto,
  vehiclePhotos,
} from "../src/core/vehicle-model.js";

const VECCHIE = Object.freeze([
  { name: "MINI", ov: { "dm.ev_batteria_auto": "sensor.mini_soc" }, img: "/local/mini.png", brand: "MINI" },
  { name: "Leapmotor", ov: {}, imgPlugged: "/local/leap.png" },
]);

test("una configurazione senza uid ne riceve uno, e da li' se lo tiene", () => {
  const lista = vehicleList(VECCHIE);
  assert.deepEqual(lista.map((car) => car[VEHICLE_KEY_FIELD]), ["auto-1", "auto-2"]);
  // Rileggendo l'elenco appena scritto gli uid non cambiano: sono scritti.
  assert.deepEqual(vehicleList(lista).map((car) => car[VEHICLE_KEY_FIELD]), ["auto-1", "auto-2"]);
});

test("l'identita' non e' il nome: rinominare non fa diventare un'altra auto", () => {
  /* La chiave si ricavava dal nome e dalla marca, e si ricalcolava: due auto
   * chiamate quasi uguale ne ricavavano una sola, e sceglierne una apriva
   * l'altra. */
  const [mini] = vehicleList(VECCHIE);
  const rinominata = updateVehicle([mini], mini[VEHICLE_KEY_FIELD], { name: "La mia MINI" })[0];
  assert.equal(rinominata[VEHICLE_KEY_FIELD], mini[VEHICLE_KEY_FIELD]);
  assert.equal(rinominata.name, "La mia MINI");
  // E l'uid non si riscrive nemmeno provandoci esplicitamente.
  const forzata = updateVehicle([mini], mini[VEHICLE_KEY_FIELD], { [VEHICLE_KEY_FIELD]: "altro" })[0];
  assert.equal(forzata[VEHICLE_KEY_FIELD], mini[VEHICLE_KEY_FIELD]);
});

test("due profili non possono avere lo stesso uid", () => {
  // Sceglierne uno aprirebbe l'altro: e' il guasto da cui si viene.
  const lista = vehicleList([
    { [VEHICLE_KEY_FIELD]: "auto-1", name: "A" },
    { [VEHICLE_KEY_FIELD]: "auto-1", name: "B" },
  ]);
  assert.equal(new Set(lista.map((car) => car[VEHICLE_KEY_FIELD])).size, 2);
});

test("un uid cancellato non torna buono una seconda volta", () => {
  const lista = vehicleList(VECCHIE);
  const salvato = storedVehicles(lista, {});
  const terza = nuovoVeicolo(lista, "Tesla", salvato.metadata);
  assert.equal(terza[VEHICLE_KEY_FIELD], "auto-3");
  const dopo = storedVehicles([...lista, terza], salvato.metadata);
  assert.equal(dopo.metadata[VEHICLE_SEQ_FIELD], 3);
  // Via la terza: il segno resta, e la prossima e' la quarta.
  const senza = removeVehicle(dopo.cars, "auto-3");
  assert.deepEqual(senza.map((car) => car[VEHICLE_KEY_FIELD]), ["auto-1", "auto-2"]);
  assert.equal(nuovoVeicoloId(senza, dopo.metadata), "auto-4");
});

test("l'ultima auto non si toglie: resterebbe niente", () => {
  const [sola] = vehicleList([{ name: "MINI" }]);
  assert.deepEqual(removeVehicle([sola], sola[VEHICLE_KEY_FIELD]), [sola]);
});

test("le foto appartengono all'auto, non a una casella sciolta", () => {
  /* Vivevano anche in due caselle che mostravano l'auto attiva: due verita'
   * sulla stessa cosa, e bastava configurare la vettura sbagliata perche' si
   * scambiassero. */
  const [mini, leap] = vehicleList(VECCHIE);
  assert.deepEqual(vehiclePhotos(mini), { idle: "/local/mini.png", plugged: "" });
  // Col cavo attaccato vince la seconda, se c'e'; altrimenti resta la prima.
  assert.equal(vehiclePhoto(mini, true), "/local/mini.png");
  assert.equal(vehiclePhoto(leap, true), "/local/leap.png");
  assert.equal(vehiclePhoto(leap, false), "/local/leap.png");
  assert.equal(vehiclePhoto({}, true), "");
});

test("attiva e' un'auto, non una posizione", () => {
  /* La casella teneva un indice, e ogni riordino dell'elenco spostava l'auto
   * in uso sotto i piedi di chi la stava guardando. */
  const lista = vehicleList(VECCHIE);
  assert.equal(pickVehicle(lista, "auto-2").name, "Leapmotor");
  const riordinata = [lista[1], lista[0]];
  assert.equal(pickVehicle(riordinata, "auto-2").name, "Leapmotor");
  // Un numero si accetta ancora: chi arriva da prima non perde l'auto scelta.
  assert.equal(pickVehicle(lista, "1").name, "Leapmotor");
  // E un riferimento che non esiste piu' non lascia senza niente.
  assert.equal(pickVehicle(lista, "auto-99").name, "MINI");
  assert.equal(pickVehicle([], "auto-1"), null);
});

test("la mappatura tiene solo i riferimenti dm.ev_ che hanno un valore", () => {
  const car = normalizeVehicle({
    ov: { "dm.ev_batteria_auto": "sensor.x", "dm.ev_odometro": "", "dm.core_qualcosa": "sensor.y" },
  });
  assert.deepEqual(car[VEHICLE_OVERRIDES_FIELD], { "dm.ev_batteria_auto": "sensor.x" });
});

test("le entita' di tutte le auto si raccolgono in un colpo", () => {
  const ids = vehicleEntities(vehicleList(VECCHIE));
  assert.deepEqual([...ids], ["sensor.mini_soc"]);
});

test("un'auto senza nome ne ha comunque uno da mostrare", () => {
  assert.equal(vehicleLabel({}, 0, "Auto"), "Auto 1");
  assert.equal(vehicleLabel({ name: "MINI" }, 3, "Auto"), "MINI");
});

test("dove sta un'auto nell'elenco, e quando non c'e' piu'", () => {
  const lista = vehicleList(VECCHIE);
  assert.equal(vehicleIndex(lista, "auto-2"), 1);
  assert.equal(vehicleIndex(lista, "auto-99"), -1);
  assert.equal(vehicleIndex(lista, ""), -1);
});

test("il modulo e' puro, e la sezione legge da li'", async () => {
  const modello = await readFile(new URL("../src/core/vehicle-model.js", import.meta.url), "utf8");
  assert.doesNotMatch(modello, /\bdocument\.|\blocalStorage\.|getContext|createElement/);
  const sezione = await readFile(new URL("../src/sections/ev-section.js", import.meta.url), "utf8");
  /* Sei moduli leggevano `cd_ev_cars` grezza, ognuno con la sua idea di cosa ci
   * fosse scritto: da qui in poi la forma la decide un posto solo. */
  assert.match(sezione, /return vehicleList\(legacy\.length \? legacy : canonicalProfiles\(\)\)/);
  assert.match(sezione, /pickVehicle\(list, root\.localStorage\?\.getItem\(VEHICLE_ACTIVE_KEY\)/);
});
