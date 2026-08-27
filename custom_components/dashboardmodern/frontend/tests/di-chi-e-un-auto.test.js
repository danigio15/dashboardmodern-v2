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

test("quello che il modello non conosce non lo butta via", () => {
  /* Un profilo porta anche campi che non appartengono a questo modello: l'id
   * canonico con cui lo store lo indicizza, l'interruttore che dice se e'
   * attiva, e domani chissa'. Riscrivendo l'oggetto da zero sparivano — e lo
   * store, non trovando piu' l'id, gliene assegnava uno nuovo: la stessa auto
   * diventava un'altra a ogni salvataggio. */
  const car = normalizeVehicle({ id: "ev-pluto", name: "Pluto", enabled: false, domani: "x" });
  assert.equal(car.id, "ev-pluto");
  assert.equal(car.enabled, false);
  assert.equal(car.domani, "x");
  // E sopravvive anche al giro completo di scrittura e rilettura.
  const salvato = storedVehicles([car], {});
  assert.equal(vehicleList(salvato.cars)[0].id, "ev-pluto");
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

test("nessun altro modulo si tiene la sua idea di quale auto sia attiva", async () => {
  /* `beta-compat` e `beta11` leggevano `cd_ev_cars` grezza e `cd_ev_car_active`
   * come POSIZIONE, ognuno con la sua idea di cosa fosse l'identita' di una
   * vettura. Erano tre moduli con tre idee della stessa cosa, e bastava che
   * l'elenco cambiasse ordine perche' due di loro parlassero di auto diverse.
   * Adesso lo chiedono a chi le auto le possiede. */
  for (const nome of ["beta-compat-section.js", "beta11-real-device-polish-section.js"]) {
    const sorgente = await readFile(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");
    // Le chiavi grezze, non le parole: nei commenti si racconta com'era, ed e'
    // giusto che restino scritte.
    assert.doesNotMatch(sorgente, /["']cd_ev_cars["']/, nome);
    assert.doesNotMatch(sorgente, /["']cd_ev_car_active["']/, nome);
  }
  /* Chi ancora chiede «quale auto» lo chiede a chi le auto le possiede. E chi
   * non ha piu' niente da chiedere — beta11, da quando la card del brand ha
   * un padrone solo — non lo chiede affatto: e' il modo migliore di non avere
   * un'idea propria. */
  const compat = await readFile(
    new URL("../src/sections/beta-compat-section.js", import.meta.url),
    "utf8",
  );
  assert.match(compat, /from "\.\/ev-section\.js"/);
});

test("la scheda dice di quale auto parla, e la bozza non e' di nessuna", async () => {
  /* Tre casi, e quello di mezzo e' quello che si dimentica. Una bozza che
   * ricade sull'auto in uso le mette addosso i panni della vettura che sta
   * nascendo — ed e' il gesto da cui una si prendeva i dati dell'altra. */
  const sezione = await readFile(new URL("../src/sections/ev-section.js", import.meta.url), "utf8");
  assert.match(sezione, /export function editedVehicle/);
  const corpo = sezione.match(/export function editedVehicle[\s\S]*?\n\}/)[0];
  assert.match(corpo, /if \(chiave === ""\) return null;/);

  const marca = await readFile(
    new URL("../src/sections/personalization-section.js", import.meta.url),
    "utf8",
  );
  /* La card «Brand e modello» segue l'auto aperta con la matita, non quella in
   * uso: erano due contesti nella stessa schermata, e si sceglieva la marca
   * credendo di vestire l'una mentre si vestiva l'altra. */
  assert.match(marca, /editedVehicle\(cars\)/);
  assert.match(marca, /panel\.dataset\.dmVehicleUid/);
  // E il badge doppione nella riga delle linguette non si disegna piu'.
  assert.doesNotMatch(marca, /createElement\("span"\);\s*badge\.className/);
});

test("la card del marchio ha un padrone solo", async () => {
  /* Ne aveva tre. Uno la costruiva; un secondo ci appendeva i propri
   * ascoltatori e riempiva l'elenco dei modelli per conto suo; un terzo
   * riallineava le tendine all'auto che credeva giusta. Tre opinioni sullo
   * stesso quadratino, e vinceva l'ultima che passava — da li' la bozza
   * vestita da Leapmotor, i modelli che non si riempivano, e il riquadro che
   * raccontava una macchina mentre le tendine ne dicevano un'altra.
   *
   * Adesso la costruisce e la comanda un modulo solo. Gli altri due non la
   * toccano piu': niente ascoltatori appesi, niente valori rimessi a forza. */
  const nomi = [
    "beta11-real-device-polish-section.js",
    "beta9-real-device-polish-section.js",
  ];
  for (const nome of nomi) {
    const sorgente = await readFile(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");
    assert.doesNotMatch(sorgente, /select\[data-brand\]/, nome);
    assert.doesNotMatch(sorgente, /select\[data-model\]/, nome);
    assert.doesNotMatch(sorgente, /\[data-brand-preview\]/, nome);
  }
  /* Il padrone c'e', e disegna il riquadro dalle sue tendine — non da quello
   * che immagina, e non una volta sola: a ogni cambio. */
  const marca = await readFile(
    new URL("../src/sections/personalization-section.js", import.meta.url),
    "utf8",
  );
  assert.match(marca, /const brandSelect = panel\.querySelector\("select\[data-brand\]"\)/);
  assert.match(marca, /const modelSelect = panel\.querySelector\("select\[data-model\]"\)/);
  const disegno = marca.match(/const refreshPreview = \(\) => \{[\s\S]*?\n  \};/)[0];
  assert.match(disegno, /carBrandVisual\(selectedBrand/);
});

test("il nome del marchio non finisce dentro l'icona", async () => {
  /* Era il testo alternativo di un `<img>`: in un riquadro alto quanto
   * un'icona ci andava a capo, e «MINI» diventava «MI / NI». Adesso il segno
   * non e' piu' un'immagine ma una maschera — la forma dal file, il colore
   * dalla plancia — e il nome lo portano `title` e `aria-label`, che si
   * leggono e non si disegnano. */
  const catalogo = await readFile(
    new URL("../src/core/personalization-catalog.js", import.meta.url),
    "utf8",
  );
  const canonico = catalogo.match(/data-brand-source="canonical"[\s\S]{0,1400}?\n  \}/)[0];
  assert.doesNotMatch(canonico, /<img/);
  assert.match(canonico, /title="\$\{item\.name\}"/);
  assert.match(canonico, /aria-label="\$\{item\.name\}"/);
  assert.doesNotMatch(canonico, /onerror/);
});

test("se il cavo lo dice un sensore, non si indovina piu'", async () => {
  /* La plancia deduceva il cavo attaccato dal testo dello stato di ricarica e,
   * in mancanza, dalla potenza del wallbox. Sono indizi: un wallbox fermo a
   * zero watt col cavo dentro e l'auto piena veniva letto come cavo staccato,
   * e la foto dell'auto tornava a quella di riposo da sola.
   *
   * Quasi tutte le wallbox pubblicano un sensore che lo dice davvero. Adesso
   * si puo' dichiarare, e allora si crede a lui. */
  const sezione = await readFile(new URL("../src/sections/ev-section.js", import.meta.url), "utf8");
  const corpo = sezione.match(/export function vehiclePlugged\(\)[\s\S]*?\n\}/)[0];
  const primaRiga = corpo.indexOf("dm.ev_cavo_collegato");
  const indizio = corpo.indexOf("dm.ev_stato_ricarica");
  assert.ok(primaRiga > 0, "il sensore del cavo si legge");
  assert.ok(primaRiga < indizio, "e si legge PRIMA degli indizi, o non servirebbe a niente");

  /* E la casella c'e' davvero nel modulo: un riferimento che nessuno puo'
   * mappare e' un riferimento che nessuno usera' mai. */
  for (const runtime of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
    const sorgente = await readFile(new URL(`../legacy/${runtime}`, import.meta.url), "utf8");
    assert.match(sorgente, /ref: 'dm\.ev_cavo_collegato'/, runtime);
  }
});
