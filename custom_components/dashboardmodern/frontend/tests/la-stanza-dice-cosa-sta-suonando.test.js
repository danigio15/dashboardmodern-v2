/* «I vari player presenti nelle stanze: potrebbe essere utile far vedere cosa
 * stanno riproducendo… Attualmente appare un Playing generico, come in foto,
 * che se cliccato rimanda alla home della dashboard: un'idea potrebbe essere
 * avere la sezione Media Player nelle stanze invece che classificarli come
 * Altro in questa stanza.» (#405)
 *
 * Due cose, e sono lo stesso difetto che le telecamere avevano già avuto e che
 * lì era già stato corretto: un lettore in una stanza ci arrivava solo per
 * assegnazione a mano — nel mucchio dell'«Altro», dove il tocco porta in Home,
 * cioè in nessun posto utile — e la riga diceva lo stato grezzo di Home
 * Assistant invece di dire cosa sta suonando.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { ROOM_BLOCKS, roomOverviewModel } from "../src/core/room-overview.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const STANZE = [{ id: "room_salotto", name: "Salotto", order: 0 }];

const vuoto = {
  climate: [],
  lights: [],
  prese: [],
  covers: [],
  appliances: [],
  cameras: [],
  loads: [],
  robots: [],
  irrigation: {},
  assigned: [],
};

test("un lettore con la sua stanza finisce nel blocco Musica, non nell'«Altro»", () => {
  const modello = roomOverviewModel({
    ...vuoto,
    rooms: STANZE,
    media: [{ id: "mp1", entity: "media_player.sonos_salotto", room_id: "room_salotto" }],
  });
  const salotto = modello.find((pagina) => pagina.name === "Salotto");
  const musica = salotto.blocchi.find((blocco) => blocco.key === "media");
  assert.equal(musica.voci.length, 1);
  assert.equal(musica.voci[0].entity, "media_player.sonos_salotto");
  /* E non è finito anche nell'«Altro»: una cosa sola, in un posto solo. */
  assert.equal(salotto.blocchi.find((blocco) => blocco.key === "altro").voci.length, 0);
  assert.equal(salotto.count, 1);
});

test("un lettore senza stanza resta fra quelli da sistemare, non sparisce", () => {
  const modello = roomOverviewModel({
    ...vuoto,
    rooms: STANZE,
    media: [{ id: "mp1", entity: "media_player.orfano" }],
  });
  const senzaStanza = modello.find((pagina) => pagina.senzaStanza);
  const musica = senzaStanza.blocchi.find((blocco) => blocco.key === "media");
  assert.equal(musica.voci.length, 1);
});

test("il blocco Musica c'è, e sta fra gli elettrodomestici e le telecamere", () => {
  const chiavi = ROOM_BLOCKS.map((blocco) => blocco.key);
  assert.ok(chiavi.includes("media"));
  assert.equal(chiavi.indexOf("media"), chiavi.indexOf("elettrodomestici") + 1);
});

test("il tocco su un lettore porta alla Musica, non in Home", async () => {
  /* È il difetto letterale della segnalazione: «se cliccato rimanda alla home
   * della dashboard». La pagina Musica esiste ed è lì che si comanda. */
  const sezione = await leggi("../src/sections/rooms-page-section.js");
  const mappa = sezione.slice(
    sezione.indexOf("const TAB_DI"),
    sezione.indexOf("export function blockMarkup"),
  );
  assert.match(mappa, /media: "media"/);
  /* E l'«Altro» resta quello che manda in Home, perché per quello non c'è una
   * pagina sola dove andare. */
  assert.match(mappa, /altro: "home"/);
});

test("la riga dice cosa suona, non «playing»", async () => {
  const sezione = await leggi("../src/sections/rooms-page-section.js");
  /* Il titolo e l'artista li porta già l'entità, e sono l'unica cosa che uno
   * vuole leggere passando davanti alla stanza. */
  assert.match(sezione, /function cosaSuona\(item, states\)/);
  assert.match(sezione, /if \(blocco === "media"\) return cosaSuona\(item, states\);/);
  /* Senza titolo si dice comunque qualcosa di vero — la sorgente, l'app — che
   * su un televisore sono la risposta giusta alla stessa domanda. */
  assert.match(sezione, /lettura\.sorgente \|\| lettura\.applicazione/);
});

test("il modello resta puro: le parole della Musica stanno nella sezione", async () => {
  const modello = await leggi("../src/core/room-overview.js");
  assert.doesNotMatch(modello, /"Musica"|"Music"/);
});
