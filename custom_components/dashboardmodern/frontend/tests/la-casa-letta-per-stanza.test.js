/* La casa letta per stanza, invece che per tipo.
 *
 * «Sarebbe carino avere una sezione dove vedere le entita' raggruppate per
 * stanze, tipo una sezione divisa a pagine dove ogni pagina e' una stanza con
 * tutte le entita' della stessa.»
 *
 * Il dato c'era gia': ogni sezione scrive a che stanza appartiene cio' che
 * configura. Mancava il verso in cui leggerlo — tutte lo leggono per tipo, e
 * nessuna per stanza. Qui si prova che il giro e' esatto: che niente si perde,
 * che niente viene contato due volte, e che quello che una stanza non ce l'ha
 * finisce dove si puo' vedere invece di sparire.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeDevice } from "../src/core/device-model.js";
import {
  ROOM_BLOCKS,
  belongsToRoom,
  lightItems,
  pickRoomPage,
  roomOverviewModel,
  roomSceneEntities,
  roomSceneSummary,
} from "../src/core/room-overview.js";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

const CASA = {
  rooms: [
    { id: "room-salone", name: "Salone", icon: "🛋️", temp: "sensor.t", hum: "sensor.h" },
    { name: "Cucina" },
    { name: "Cameretta" },
  ],
  lights: { "light.a": "Faretti", "light.b": "Ingresso", "light.c": "Orfana" },
  lightRooms: { "light.a": "Salone", "light.b": "Salone" },
  climate: [{ name: "Split", entity: "climate.x", room_id: "room-salone" }],
  covers: [{ name: "Tapparella", entity: "cover.x", room: "Salone" }],
  cameras: [{ name: "Ingresso", entity: "camera.x", room: "Cucina" }],
};

const pagina = (id) => pickRoomPage(roomOverviewModel(CASA), id);
const blocco = (id, key) => pagina(id).blocchi.find((voce) => voce.key === key).voci;

test("ogni stanza raccoglie quello che le appartiene, comunque sia scritto", () => {
  // Tre modi diversi di dire «Salone»: la mappa delle luci, l'id canonico, il
  // nome sulla riga. Tutti e tre arrivano nella stessa pagina.
  assert.equal(blocco("room-salone", "luci").length, 2);
  assert.equal(blocco("room-salone", "clima").length, 1);
  assert.equal(blocco("room-salone", "coperture").length, 1);
  assert.equal(pagina("room-salone").count, 4);
  assert.equal(pagina("room-cucina").count, 1);
});

test("una stanza vuota resta nell'elenco: e' configurata, non cancellata", () => {
  const cameretta = pagina("room-cameretta");
  assert.equal(cameretta.count, 0);
  assert.equal(cameretta.name, "Cameretta");
});

test("cio' che una stanza non ce l'ha finisce dove si puo' vedere", () => {
  const pagine = roomOverviewModel(CASA);
  const orfane = pagine.at(-1);
  assert.equal(orfane.senzaStanza, true);
  assert.equal(orfane.count, 1);
  assert.deepEqual(
    orfane.blocchi.find((voce) => voce.key === "luci").voci.map((luce) => luce.entity),
    ["light.c"],
  );
});

test("senza orfane il raccoglitore non compare affatto", () => {
  const pagine = roomOverviewModel({ rooms: [{ name: "Salone" }] });
  assert.equal(pagine.length, 1);
  assert.equal(pagine.some((voce) => voce.senzaStanza), false);
});

test("niente viene contato due volte: la prima stanza che lo reclama lo tiene", () => {
  const pagine = roomOverviewModel({
    rooms: [{ name: "Salone" }, { name: "Salone" }],
    covers: [{ entity: "cover.x", room: "Salone" }],
  });
  assert.equal(pagine.reduce((totale, voce) => totale + voce.count, 0), 1);
});

test("la stanza di una luce sta nella mappa a parte, non sulla luce", () => {
  /* Le altre sezioni scrivono la stanza sul dispositivo; le luci no: la scheda
   * Luci tiene le assegnazioni in una mappa entita' → stanza. Guardando solo il
   * dispositivo canonico, ogni luce sembrava senza stanza. */
  const canoniche = [{ id: "lights-1", entity: "light.a", name: "Faretti", room_id: "" }];
  assert.equal(lightItems(canoniche, { "light.a": "Salone" })[0].room, "Salone");
  // Se pero' la luce la stanza ce l'ha addosso, quella vince: e' piu' recente.
  const propria = [{ entity: "light.a", room_id: "room-cucina" }];
  assert.equal(lightItems(propria, { "light.a": "Salone" })[0].room, "room-cucina");
});

test("un riferimento che non risolve a un id non viene buttato via", async () => {
  /* `room_id` nasce dall'id della stanza trovata: una stanza senza id — una
   * configurazione scritta a mano, o un salvataggio piu' vecchio dell'id —
   * lasciava `room_id` vuoto e l'assegnazione spariva in silenzio. */
  const device = normalizeDevice({ entity: "light.a", room: "Salone" }, "lights", {
    rooms: [{ name: "Salone" }],
  });
  assert.equal(device.room_id, "");
  assert.equal(device.room, "Salone");
  assert.equal(belongsToRoom(device, { id: "room-salone", name: "Salone" }), true);
});

test("una stanza si riconosce comunque sia scritta, e mai per sbaglio", () => {
  const salone = { id: "room-salone", name: "Salone" };
  for (const riferimento of ["room-salone", "Salone", "salone", " SALONE "])
    assert.equal(belongsToRoom({ room: riferimento }, salone), true, riferimento);
  for (const riferimento of ["", "Saloncino", "Cucina"])
    assert.equal(belongsToRoom({ room: riferimento }, salone), false, riferimento);
});

test("la scena della stanza tocca le luci, e solo quelle", () => {
  /* «Accendi tutto» in una stanza vuol dire la luce. Non il condizionatore e
   * non la tapparella: quelli hanno un verso loro, e decidere quale sia
   * «acceso» al posto di chi guarda sarebbe inventare un significato. */
  const salone = pagina("room-salone");
  assert.deepEqual(roomSceneEntities(salone), ["light.a", "light.b"]);
  const states = { "light.a": { state: "on" }, "light.b": { state: "off" } };
  assert.deepEqual(roomSceneSummary(salone, states), { totale: 2, accese: 1 });
  // Una stanza senza luci non offre la scena: sarebbe un tasto che non fa niente.
  assert.deepEqual(roomSceneEntities(pagina("room-cucina")), []);
});

test("i blocchi sono quelli, nell'ordine con cui si guarda una stanza entrandoci", async () => {
  assert.deepEqual(
    ROOM_BLOCKS.map((blocco) => blocco.key),
    ["clima", "luci", "coperture", "elettrodomestici", "telecamere", "carichi", "robot", "irrigazione"],
  );
  /* Il modulo e' puro: non sa che lingua si parla e non deve saperlo. Le parole
   * e le icone stanno nella sezione, come per ogni altra tabella bilingue. */
  const modello = await leggi("../src/core/room-overview.js");
  assert.doesNotMatch(modello, /\bdocument\.|\blocalStorage\.|getContext|createElement/);
  assert.doesNotMatch(modello, /nome: \[/);
});

test("la sezione riusa la card della pagina Luci invece di rifarne una", async () => {
  const sezione = await leggi("../src/sections/rooms-page-section.js");
  assert.match(sezione, /import \{ pageCardMarkup \} from "\.\/lights-page-section\.js"/);
  assert.match(sezione, /pageCardMarkup\(/);
  /* E il foglio di quella card non e' piu' incatenato alla sua pagina, o qui
   * arriverebbe nuda. */
  const luci = await leggi("../src/sections/lights-page-section.js");
  assert.match(luci, /:is\(#page-luci,#page-stanze\) \.dm-lucip-card\{/);
});

test("la sezione e' installata dal runtime e ha la sua voce nella barra", async () => {
  const runtime = await leggi("../src/sections/section-runtime.js");
  assert.match(runtime, /installRoomsPageSection\(\)/);
  const sezione = await leggi("../src/sections/rooms-page-section.js");
  // La voce si nasconde come tutte: la mappa di cdApplyNavVis la deve sapere.
  assert.match(sezione, /cdNavVisMap/);
});
