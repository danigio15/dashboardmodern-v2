/* «Veniva chiesto di inserire coordinate oppure il comune: pensa a un motore
 * per poter scegliere il posto e il radar funziona» (#266).
 *
 * Il motore è aritmetica — Web Mercator, la proiezione di tutte le mappe a
 * tessere — e per questo si prova qui, senza rete: da un punto e da quanti
 * chilometri si vogliono vedere escono lo zoom e i quadratini, e dove vanno
 * messi. L'unica cosa che questa prova non può toccare è l'indirizzo del
 * servizio, che infatti non è cablato da nessuna parte: è un modello di
 * stringa, e nella scheda c'è un tasto che lo prova per davvero.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  LATO_TESSERA,
  ZOOM_MASSIMO,
  ZOOM_MINIMO,
  finestraDiTessere,
  latitudine,
  longitudine,
  luogoDelRadar,
  metriPerPixel,
  puntoDellaTessera,
  tesseraDelPunto,
  urlDellaTessera,
  zoneDisponibili,
  zoomPerRaggio,
} from "../src/core/radar-mappa.js";

/* Roma, che è il punto di riferimento di una segnalazione italiana. */
const ROMA = { lat: 41.9028, lon: 12.4964 };

test("un punto va nel suo quadratino, e dal quadratino si torna al punto", () => {
  /* Il quadratino di Roma a zoom 9, contato a mano con la formula di Web
   * Mercator: x = (lon+180)/360 · 2⁹ = 273,77 e y = 190,25. Se questa
   * aritmetica cambia, cambia dove guarda il radar — ed è il genere di
   * cambiamento che non si vede finché qualcuno non si accorge che la pioggia
   * è sulla città sbagliata. */
  const t = tesseraDelPunto(ROMA.lat, ROMA.lon, 9);
  assert.equal(Math.floor(t.x), 273);
  assert.equal(Math.floor(t.y), 190);
  assert.ok(Math.abs(t.x - 273.7727) < 0.001 && Math.abs(t.y - 190.249) < 0.001);
  /* E l'angolo di quel quadratino sta appena sopra e a sinistra del punto. */
  const angolo = puntoDellaTessera(Math.floor(t.x), Math.floor(t.y), 9);
  assert.ok(angolo.lon <= ROMA.lon && angolo.lat >= ROMA.lat);
  assert.ok(ROMA.lon - angolo.lon < 1 && angolo.lat - ROMA.lat < 1);
});

test("il cerchio chiesto ci sta dentro, e non ci sta il doppio", () => {
  /* La regola: a quello zoom il riquadro deve coprire almeno il diametro
   * voluto — se ne coprisse meno, la pioggia che arriva resterebbe fuori — e
   * a uno zoom più stretto non ci starebbe più. */
  for (const raggio of [10, 30, 60]) {
    const zoom = zoomPerRaggio(ROMA.lat, raggio, 320);
    const coperto = metriPerPixel(ROMA.lat, zoom) * 320;
    assert.ok(coperto >= raggio * 2000, `${raggio} km non ci sta a zoom ${zoom}`);
    const piuStretto = metriPerPixel(ROMA.lat, zoom + 1) * 320;
    assert.ok(piuStretto < raggio * 2000, `a zoom ${zoom + 1} ci starebbe ancora`);
  }
});

test("lo zoom resta fra i suoi estremi, anche con richieste assurde", () => {
  assert.equal(zoomPerRaggio(ROMA.lat, 100000, 320), ZOOM_MINIMO);
  assert.equal(zoomPerRaggio(ROMA.lat, 0.001, 320), ZOOM_MASSIMO);
  /* E senza dati non si inventa niente. */
  assert.equal(zoomPerRaggio(null, 30, 320), ZOOM_MINIMO);
  assert.equal(zoomPerRaggio(ROMA.lat, 0, 320), ZOOM_MINIMO);
});

test("i quadratini coprono tutto il riquadro, e il punto finisce al centro", () => {
  const f = finestraDiTessere(ROMA.lat, ROMA.lon, { latoPx: 400, altoPx: 260, raggioKm: 30 });
  assert.ok(f.tessere.length > 0);
  /* Nessun buco: dal primo all'ultimo pixel del riquadro c'è sempre un
   * quadratino sotto. */
  const sinistra = Math.min(...f.tessere.map((t) => t.sx));
  const alto = Math.min(...f.tessere.map((t) => t.sy));
  const destra = Math.max(...f.tessere.map((t) => t.sx + t.lato));
  const basso = Math.max(...f.tessere.map((t) => t.sy + t.lato));
  assert.ok(sinistra <= 0 && alto <= 0, "il riquadro comincia scoperto");
  assert.ok(destra >= 400 && basso >= 260, "il riquadro finisce scoperto");
  /* Il centro del riquadro è il punto chiesto: si ricava all'indietro da dove
   * è stato messo il quadratino che lo contiene. */
  const centro = tesseraDelPunto(ROMA.lat, ROMA.lon, f.zoom);
  const suo = f.tessere.find((t) => t.x === Math.floor(centro.x) && t.y === Math.floor(centro.y));
  assert.ok(suo, "il quadratino del punto non è fra quelli chiesti");
  const puntoX = suo.sx + (centro.x - Math.floor(centro.x)) * LATO_TESSERA;
  const puntoY = suo.sy + (centro.y - Math.floor(centro.y)) * LATO_TESSERA;
  assert.ok(Math.abs(puntoX - 200) < 1.5, `il punto è a ${puntoX}px invece che a 200`);
  assert.ok(Math.abs(puntoY - 130) < 1.5, `il punto è a ${puntoY}px invece che a 130`);
});

test("il mondo gira in longitudine e si ferma ai poli", () => {
  /* Vicino all'antimeridiano il quadratino a est dell'ultimo è il primo: senza
   * questo, mezza mappa sarebbe vuota per chi vive alle Figi. */
  const f = finestraDiTessere(0, 179.9, { latoPx: 600, altoPx: 300, zoom: 4 });
  const scala = 2 ** 4;
  assert.ok(f.tessere.every((t) => t.x >= 0 && t.x < scala));
  assert.ok(f.tessere.some((t) => t.x === 0) && f.tessere.some((t) => t.x === scala - 1));
  /* Sopra il polo invece non c'è niente da chiedere. */
  const polo = finestraDiTessere(84, 0, { latoPx: 600, altoPx: 600, zoom: 3 });
  assert.ok(polo.tessere.every((t) => t.y >= 0 && t.y < 2 ** 3));
});

test("una coordinata storta non diventa un punto", () => {
  assert.equal(latitudine(""), null, "vuoto non è l'equatore");
  assert.equal(longitudine(""), null);
  assert.equal(latitudine("  "), null);
  assert.equal(latitudine(91), null);
  assert.equal(longitudine(181), null);
  assert.equal(latitudine("ciao"), null);
  assert.equal(latitudine("41.9028"), 41.9028, "un numero scritto resta un numero");
  assert.equal(finestraDiTessere("", "", { raggioKm: 30 }), null);
});

test("l'indirizzo si compone dal modello, e senza segnaposto non è un modello", () => {
  const tessera = { x: 274, y: 187, lato: 256 };
  assert.equal(
    urlDellaTessera("https://esempio/{z}/{x}/{y}.png", tessera, 9),
    "https://esempio/9/274/187.png",
  );
  /* Le due convenzioni degli altri: le righe contate dal basso e i
   * sottodomini. */
  assert.equal(urlDellaTessera("https://e/{z}/{x}/{-y}.png", { x: 3, y: 5 }, 4), "https://e/4/3/10.png");
  assert.match(urlDellaTessera("https://{s}.e/{z}/{x}/{y}.png", tessera, 9), /^https:\/\/[abc]\.e\//);
  /* Un indirizzo fisso chiederebbe sempre lo stesso quadratino: meglio dire
   * che non è un modello. */
  assert.equal(urlDellaTessera("https://esempio/fisso.png", tessera, 9), "");
  assert.equal(urlDellaTessera("", tessera, 9), "");
});

/* ── il posto ─────────────────────────────────────────────────────────── */

const STATI = {
  "zone.home": { attributes: { latitude: 45.07, longitude: 7.69, friendly_name: "Casa" } },
  "zone.nonna": { attributes: { latitude: 44.41, longitude: 8.93, friendly_name: "Da nonna" } },
  "zone.rotta": { attributes: { friendly_name: "Senza coordinate" } },
};

test("le coordinate scritte vincono, poi la zona, poi casa", () => {
  assert.deepEqual(luogoDelRadar({ lat: "41.9", lon: "12.5" }, STATI), {
    lat: 41.9, lon: 12.5, da: "scritte", nome: "",
  });
  assert.equal(luogoDelRadar({ zona: "zone.nonna" }, STATI).nome, "Da nonna");
  assert.equal(luogoDelRadar({}, STATI).da, "casa");
  /* Una zona senza coordinate non è una scelta: si ripiega su casa invece di
   * non mostrare niente. */
  assert.equal(luogoDelRadar({ zona: "zone.rotta" }, STATI).da, "casa");
  /* E le caselle vuote non sono l'equatore. */
  assert.equal(luogoDelRadar({ lat: "", lon: "" }, STATI).da, "casa");
});

test("senza casa e senza zone non si inventa un posto", () => {
  assert.equal(luogoDelRadar({}, {}), null);
  /* Ma la configurazione di Home Assistant vale come casa, quando le zone non
   * sono ancora arrivate. */
  assert.equal(luogoDelRadar({}, {}, { latitude: 45.07, longitude: 7.69 }).da, "casa");
});

test("nella tendina ci sono le zone, e Casa non compare due volte", () => {
  const zone = zoneDisponibili(STATI);
  assert.deepEqual(
    zone.map((z) => z.entity),
    ["zone.nonna"],
  );
  assert.equal(zone[0].nome, "Da nonna");
});
