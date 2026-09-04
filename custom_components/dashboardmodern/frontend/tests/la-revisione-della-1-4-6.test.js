/* Le nove cose viste dal revisore sulla 1.4.6, una prova per ognuna.
 *
 * Una sottoscrizione WebRTC che si chiude solo di qua; il serbatoio che
 * cede alla batteria di quando l'auto era elettrica; il fondo della mappa
 * che passa per radar; l'icona della plastica su una riga diventata carta;
 * le miglia lette come chilometri; il calendario che non concorre al
 * prossimo ritiro; un corridoio vuoto preso per un flusso morto; un sensore
 * spento letto come «data non trovata»; e «tutto tranquillo» sopra un
 * sensore staccato.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { inChilometri, letturaAllerte } from "../src/core/allerte-model.js";
import { letturaRifiuti } from "../src/core/rifiuti-model.js";
import { PAZIENZA_MASSIMA, creaSorveglianza } from "../src/core/flusso-fermo.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("una sottoscrizione WebRTC si chiude anche di la', non solo di qua", () => {
  const webrtc = leggi("sections/telecamera-webrtc-section.js");
  const chiudi = /chiudi\(\) \{([\s\S]*?)\n    \},/.exec(webrtc)?.[1] || "";
  assert.match(chiudi, /delete pending\[id\];/);
  assert.match(chiudi, /type: "unsubscribe_events", subscription: id/);
  assert.match(chiudi, /socket\.readyState === 1/, "un socket gia' chiuso non si usa");
});

test("una vettura dichiarata a benzina mostra il serbatoio anche se ha ancora una batteria mappata", () => {
  const home = leggi("sections/home-widgets-section.js");
  const lettura = home.slice(home.indexOf("function letturaVettura"), home.indexOf("function rigaDaEntita"));
  assert.match(lettura, /const aBenzina = clean\(auto\?\.tipo\) === "termica";/);
  assert.match(lettura, /if \(aBenzina\) \{\s*serbatoio = misura\("dm\.ev_carburante"\);\s*carica = serbatoio;/);
  /* La batteria resta il ripiego, e il serbatoio il ripiego del ripiego. */
  assert.match(lettura, /if \(!carica\) \{\s*for \(const riferimento of RIF_BATTERIA_EV\)/);
  assert.match(lettura, /carburante: Boolean\(serbatoio\)/);
});

test("il radar e' vivo solo se arriva la pioggia: il fondo della mappa non conta", () => {
  const radar = leggi("sections/radar-meteo-section.js");
  assert.match(radar, /const segnala = \(immagine, riuscito, dellaPioggia\) => \{\s*if \(!riuscito\) immagine\.remove\(\);\s*if \(!dellaPioggia\) return;/);
  assert.match(radar, /const dellaPioggia = strato === modello;/);
  assert.match(radar, /if \(dellaPioggia\) attesiPioggia \+= 1;/);
  assert.match(radar, /attesi = attesiPioggia;/);
  assert.doesNotMatch(radar, /attesi = pezzi\.length;/);
});

test("cambiato il materiale di una riga, icona e colore si ricalcolano", () => {
  const editor = leggi("sections/rifiuti-editor-section.js");
  assert.match(editor, /materiale === prima\.materiale\s*\?\s*prima\s*:/);
  assert.match(editor, /campo !== "icona" && campo !== "colore"/);
});

test("le distanze si leggono in chilometri, qualunque unita' porti il sensore", () => {
  assert.equal(inChilometri("20", "km"), 20);
  assert.equal(inChilometri(20, "mi"), 32.18688);
  assert.equal(inChilometri("12.5", "miles"), 12.5 * 1.609344);
  assert.equal(inChilometri("1500", "m"), 1.5);
  assert.equal(inChilometri("boh", "km"), null);
  assert.equal(inChilometri("", "mi"), null);
  /* Venti miglia da casa non sono venti chilometri: un terremoto di 2.8 a
   * venti miglia (32 km) resta una nota, non un'attenzione. */
  const config = { terremoti: { entity: "sensor.quake", magnitudo: "sensor.mag", distanza: "sensor.dist" } };
  const stati = {
    "sensor.quake": { state: "1", attributes: {} },
    "sensor.mag": { state: "2.8", attributes: {} },
    "sensor.dist": { state: "20", attributes: { unit_of_measurement: "mi" } },
  };
  const [terremoti] = letturaAllerte(config, stati);
  assert.equal(terremoti.livello, "quiete");
  assert.equal(Math.round(terremoti.distanza), 32);
  stati["sensor.dist"].attributes.unit_of_measurement = "km";
  assert.equal(letturaAllerte(config, stati)[0].livello, "attenzione");
});

test("il calendario concorre al prossimo ritiro, e un evento uguale a una riga non si conta due volte", () => {
  const adesso = Date.parse("2026-09-04T10:00:00");
  const domani = "2026-09-05";
  const fraSette = "2026-09-11";
  const config = {
    righe: [{ id: "r1", materiale: "carta", entity: "sensor.carta" }],
    calendario: "calendar.rifiuti",
  };
  const stati = {
    "sensor.carta": { state: fraSette, attributes: {} },
    "calendar.rifiuti": { state: "off", attributes: { message: "Umido", start_time: `${domani} 06:00:00` } },
  };
  const lettura = letturaRifiuti(config, stati, (v) => v, adesso);
  assert.deepEqual(lettura.prossimi.map((r) => [r.materiale, r.giorni, Boolean(r.dalCalendario)]), [["organico", 1, true]]);
  assert.equal(lettura.domani.length, 1);
  /* Stesso materiale, stesso giorno: una volta sola. */
  stati["sensor.carta"].state = domani;
  stati["calendar.rifiuti"].attributes.message = "Carta";
  const doppia = letturaRifiuti(config, stati, (v) => v, adesso);
  assert.deepEqual(doppia.prossimi.map((r) => r.id), ["r1"]);
});

test("un sensore dei rifiuti che dice unknown o unavailable non risponde", () => {
  const config = { righe: [{ id: "r1", materiale: "carta", entity: "sensor.carta" }], calendario: "calendar.x" };
  const stati = {
    "sensor.carta": { state: "unavailable", attributes: {} },
    "calendar.x": { state: "unknown", attributes: {} },
  };
  const lettura = letturaRifiuti(config, stati, (v) => v, Date.now());
  assert.equal(lettura.righe[0].muto, true);
  assert.equal(lettura.calendario.muto, true);
  stati["sensor.carta"].state = "2099-01-01";
  assert.equal(letturaRifiuti(config, stati, (v) => v, Date.now()).righe[0].muto, false);
});

test("una scena ferma non si condanna ogni mezzo minuto: la pazienza raddoppia finche' non si muove", () => {
  const guardia = creaSorveglianza(30_000);
  assert.equal(PAZIENZA_MASSIMA, 8);
  assert.equal(guardia.osserva("cam", "aaa", 0), "vivo");
  assert.equal(guardia.osserva("cam", "aaa", 29_000), "vivo");
  assert.equal(guardia.osserva("cam", "aaa", 30_000), "fermo", "la prima volta, come prima");
  /* Riavviata, la stessa scena: adesso ci vuole un minuto. */
  guardia.dimentica("cam");
  assert.equal(guardia.osserva("cam", "aaa", 31_000), "vivo");
  assert.equal(guardia.osserva("cam", "aaa", 61_000), "vivo");
  assert.equal(guardia.osserva("cam", "aaa", 91_000), "fermo");
  assert.equal(guardia.pazienza("cam"), 120_000);
  /* Un fotogramma diverso azzera tutto. */
  assert.equal(guardia.osserva("cam", "bbb", 92_000), "vivo");
  assert.equal(guardia.pazienza("cam"), 30_000);
  /* E la pazienza non cresce all'infinito. */
  const lunga = creaSorveglianza(30_000);
  let ora = 0;
  for (let giro = 0; giro < 6; giro += 1) {
    lunga.osserva("x", "s", ora);
    ora += 30_000 * PAZIENZA_MASSIMA;
    assert.equal(lunga.osserva("x", "s", ora), "fermo");
  }
  assert.equal(lunga.pazienza("x"), 30_000 * PAZIENZA_MASSIMA);
});

test("la tessera delle allerte non dice tutto tranquillo sopra una fonte che non risponde", () => {
  const home = leggi("sections/home-widgets-section.js");
  const modello = home.slice(home.indexOf("function allerteModel"), home.indexOf("function rifiutiModel"));
  assert.match(modello, /const mute = letture\.filter\(\(lettura\) => lettura\.livello === IGNOTO\);/);
  assert.match(modello, /value: attive\.length \? String\(attive\.length\) : mute\.length \? "—" : "OK",/);
  assert.match(modello, /: mute\.length\s*\? paroleDelleFontiMute\(mute\.length\)\s*: t\("Tutto tranquillo", "All quiet"\)/);
});
