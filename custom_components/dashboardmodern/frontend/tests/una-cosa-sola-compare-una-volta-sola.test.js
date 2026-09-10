/* Il lettore in due posti, i carichi tutti «Senza stanza», le batterie col
 * puntatore (#426).
 *
 * «Dopo l'aggiornamento che ha identificato i vari speaker nelle stanze,
 *  questi vengono duplicati: se si clicca quello sotto la sezione musica si va
 *  nella sezione corretta, se si seleziona quello sotto la voce altro in
 *  questa stanza si torna alla home della dashboard.»
 *
 * Lo stesso lettore arrivava da due parti: dalla sua scheda — la stanza la
 * chiede da quando c'è il blocco Musica (#405) — e dall'assegnazione a mano,
 * che era il modo di metterlo in stanza PRIMA che quel blocco esistesse. Due
 * oggetti diversi che parlano della stessa entità: il confronto guardava
 * l'oggetto, e l'oggetto era diverso, quindi passavano tutti e due. Il secondo
 * finiva nel raccoglitore «Altro», dove il tocco non porta da nessuna parte —
 * ed è la metà della segnalazione che si vede.
 *
 * «Inoltre in senza stanza appaiono tutti i vari carichi di stanze ed
 *  elettrodomestici, anche se questi sono correttamente assegnati alle stanze
 *  di riferimento: se è un comportamento voluto, come posso toglierli?»
 *
 * Non era voluto. Il blocco «Carichi» prometteva una stanza che nessun carico
 * poteva avere — la scheda dei Carichi non la chiedeva — così il blocco
 * restava vuoto in ogni stanza e OGNI carico finiva nel raccoglitore, che
 * serve ad accorgersi di una dimenticanza e con dentro tutto non serve a
 * niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  entityOf,
  loadItems,
  pickRoomPage,
  roomOverviewModel,
} from "../src/core/room-overview.js";
import { emptyLoad, loadsConfigModel, loadsConfigToSections } from "../src/core/energy-loads-config.js";
import { glifoDellaVoce, iconaVoce } from "../src/sections/rooms-page-section.js";

const CASA = {
  rooms: [{ id: "room-salone", name: "Salone" }, { id: "room-cucina", name: "Cucina" }],
  media: [{ id: "mp1", entity: "media_player.sonos", name: "Sonos", room_id: "room-salone" }],
  /* La stessa entità, assegnata a mano quando il blocco Musica non c'era. */
  assigned: [{ entity: "media_player.sonos", name: "Sonos", room_id: "room-salone" }],
};

const voci = (pagine, id, key) =>
  pickRoomPage(pagine, id).blocchi.find((blocco) => blocco.key === key).voci;

test("il lettore sta in Musica, e non una seconda volta in «Altro»", () => {
  const pagine = roomOverviewModel(CASA);
  assert.equal(voci(pagine, "room-salone", "media").length, 1);
  assert.equal(voci(pagine, "room-salone", "altro").length, 0);
  assert.equal(pickRoomPage(pagine, "room-salone").count, 1);
});

test("e nemmeno in un'altra stanza: la stessa cosa in due posti è una bugia detta due volte", () => {
  const pagine = roomOverviewModel({
    ...CASA,
    assigned: [{ entity: "media_player.sonos", name: "Sonos", room_id: "room-cucina" }],
  });
  assert.equal(voci(pagine, "room-salone", "media").length, 1);
  assert.equal(pickRoomPage(pagine, "room-cucina").count, 0);
  /* E non ricompare nemmeno nel raccoglitore. */
  assert.equal(
    pagine.some((pagina) => pagina.senzaStanza),
    false,
  );
});

test("un'assegnazione a mano che non ripete nessuno resta dov'è", () => {
  const pagine = roomOverviewModel({
    rooms: [{ id: "room-salone", name: "Salone" }],
    assigned: [{ entity: "sensor.batteria_telecomando", name: "Batteria", room_id: "room-salone" }],
  });
  assert.equal(voci(pagine, "room-salone", "altro").length, 1);
});

test("un carico con la sua stanza sta nella stanza, non nel raccoglitore", () => {
  const pagine = roomOverviewModel({
    rooms: [{ id: "room-cucina", name: "Cucina" }],
    loads: [{ id: "c1", name: "Cucina", power_entity: "sensor.p", room_id: "room-cucina" }],
  });
  assert.equal(voci(pagine, "room-cucina", "carichi").length, 1);
  assert.equal(
    pagine.some((pagina) => pagina.senzaStanza),
    false,
  );
});

test("«cerchio = stanza» è già la risposta: non si deve ridire", () => {
  /* Chi aveva scelto la stanza del cerchio l'ha già detto una volta. */
  const pagine = roomOverviewModel({
    rooms: [{ id: "room-cucina", name: "Cucina" }],
    loads: [{ id: "c1", name: "Cucina", metadata: { flow_room: "room-cucina" } }],
  });
  assert.equal(voci(pagine, "room-cucina", "carichi").length, 1);
});

test("una stanza scelta a mano vince su quella del cerchio", () => {
  const [normalizzato] = loadItems([
    { id: "c1", room_id: "room-salone", metadata: { flow_room: "room-cucina" } },
  ]);
  assert.equal(normalizzato.room_id, "room-salone");
});

test("un carico senza stanza resta nel raccoglitore: è una dimenticanza vera", () => {
  const pagine = roomOverviewModel({
    rooms: [{ id: "room-cucina", name: "Cucina" }],
    loads: [{ id: "c1", name: "Linea garage", power_entity: "sensor.garage" }],
  });
  const orfane = pagine.at(-1);
  assert.equal(orfane.senzaStanza, true);
  assert.equal(orfane.blocchi.find((blocco) => blocco.key === "carichi").voci.length, 1);
});

test("l'entità che identifica una voce si riconosce comunque sia scritta", () => {
  assert.equal(entityOf({ entity: "light.a" }), "light.a");
  assert.equal(entityOf({ entities: ["switch.b"] }), "switch.b");
  assert.equal(entityOf({ contact: "binary_sensor.c" }), "binary_sensor.c");
  assert.equal(entityOf({ power: "sensor.d" }), "sensor.d");
  assert.equal(entityOf({ power_entity: "sensor.e" }), "sensor.e");
  assert.equal(entityOf({}), "");
  assert.equal(entityOf(), "");
});

test("la stanza del carico sopravvive al giro di salvataggio", () => {
  /* Scelta nella scheda, riletta dalla scheda: se si perdesse per strada, la
   * casella sarebbe una promessa e basta. */
  const scritti = loadsConfigToSections(
    [{ ...emptyLoad([], "it"), name: "Cucina", room_id: "room-cucina" }],
    [],
    null,
  );
  const carico = scritti.loads.find((riga) => riga.name === "Cucina");
  assert.equal(carico.room_id, "room-cucina");
  const [riletto] = loadsConfigModel({ loads: scritti.loads });
  assert.equal(riletto.room_id, "room-cucina");
});

/* «Se fosse possibile far visualizzare l'icona corretta delle batterie nelle
 *  stanze: attualmente è il puntatore generico.»
 *
 * Il puntatore è l'icona del BLOCCO, e per il blocco va bene: «Altro in questa
 * stanza» è un raccoglitore, e il puntatore dice «sta qui». Sopra la singola
 * riga ripete che quella cosa è stata assegnata a mano — l'unica cosa che a
 * chi guarda non serve — e sette righe diverse diventano sette puntatori
 * uguali. */
const ALTRO = { key: "altro" };

test("una batteria assegnata a mano porta la faccia di una batteria", () => {
  assert.equal(
    iconaVoce({ entity: "sensor.telecomando_battery", device_class: "battery" }, ALTRO),
    "🔋",
  );
});

test("senza classe resta il dominio, che almeno distingue una serratura da un termometro", () => {
  assert.equal(glifoDellaVoce({ entity: "lock.porta" }), "🔒");
  assert.equal(glifoDellaVoce({ entity: "media_player.sonos" }), "🎵");
  assert.equal(glifoDellaVoce({ entity: "binary_sensor.qualcosa" }), "🔔");
});

test("quando non si sa niente resta il puntatore del blocco, non un vuoto", () => {
  assert.equal(glifoDellaVoce({ entity: "cosa.strana" }), "");
  assert.equal(iconaVoce({ entity: "cosa.strana" }, ALTRO), "📍");
});

test("un'icona scritta a mano vince comunque, come dappertutto", () => {
  assert.equal(iconaVoce({ entity: "sensor.x", device_class: "battery", icon: "🎯" }, ALTRO), "🎯");
});
