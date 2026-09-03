/* «Visualizzare il radar meteo… metterlo o con un widget nella home oppure
 * assieme al meteo, affianco al meteo dei 7 giorni. Radar offerto dalla
 * protezione civile, magari si può prendere da lì» (#266).
 *
 * Il radar c'è, e sta dove è stato chiesto: dentro la finestra delle
 * previsioni, sopra i sette giorni. Da dove arriva l'immagine però è una
 * scelta, e questa prova la difende: **dal proprio Home Assistant**, mai da un
 * servizio di terzi chiamato dal browser. Non è pignoleria — una pagina che
 * bussa da sola a un server esterno gli manda l'indirizzo di casa di chi
 * guarda, e nel frattempo la politica di sicurezza di Home Assistant la
 * blocca nella metà delle installazioni.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  RAGGIO_DI_SERIE,
  radarScelto,
  radarVivo,
} from "../src/sections/radar-meteo-section.js";

const sorgente = readFileSync(
  new URL("../src/sections/radar-meteo-section.js", import.meta.url),
  "utf8",
);

test("si sceglie un'entità, e deve essere una che porta un'immagine", () => {
  assert.equal(radarScelto({ entity: "camera.radar_dpc" }).modo, "entita");
  assert.equal(radarScelto({ entity: "image.radar" }).modo, "entita");
  /* Un sensore non ha un fotogramma da dare: non e' un radar. */
  assert.equal(radarScelto({ entity: "sensor.pioggia" }), null);
});

test("l'entità vince sul servizio di tessere: non esce di casa", () => {
  /* Chi ha compilato tutte e due ha il radar dentro Home Assistant, e quella
   * strada non manda niente fuori. */
  const tutte = { entity: "camera.radar", modello: "https://e/{z}/{x}/{y}.png" };
  assert.equal(radarScelto(tutte).modo, "entita");
  assert.equal(radarScelto({ modello: "https://e/{z}/{x}/{y}.png" }).modo, "mappa");
});

test("il raggio di serie è quello della segnalazione, e non si va oltre il ragionevole", () => {
  assert.equal(radarScelto({ entity: "camera.r" }).raggio, RAGGIO_DI_SERIE);
  assert.equal(RAGGIO_DI_SERIE, 30);
  assert.equal(radarScelto({ entity: "camera.r", raggio: 0 }).raggio, 30, "zero non e' un raggio");
  assert.equal(radarScelto({ entity: "camera.r", raggio: 9000 }).raggio, 500);
  assert.equal(radarScelto({ entity: "camera.r", raggio: 60 }).raggio, 60);
});

test("senza scelta, o con una scritta storta, non c'è radar", () => {
  for (const stored of [{}, null, undefined, { entity: "" }, { entity: "nondominio" }])
    assert.equal(radarScelto(stored), null);
  /* Un indirizzo senza segnaposto chiederebbe sempre lo stesso quadratino. */
  assert.equal(radarScelto({ modello: "https://esempio/radar.png" }), null);
});

test("vivo vuol dire che Home Assistant sta dando un fotogramma", () => {
  const scelto = radarScelto({ entity: "camera.radar_dpc" });
  assert.equal(radarVivo(scelto, {}), false);
  assert.equal(radarVivo(scelto, { "camera.radar_dpc": { attributes: {} } }), false);
  assert.equal(
    radarVivo(scelto, {
      "camera.radar_dpc": { attributes: { entity_picture: "/api/camera_proxy/camera.radar_dpc" } },
    }),
    true,
  );
  /* Un'entita' che non porta immagini non e' viva nemmeno se ha una foto
   * addosso: non e' un radar, e `radarScelto` non la sceglie proprio. */
  assert.equal(radarScelto({ entity: "person.tizio" }), null);
  assert.equal(radarVivo(null, {}), false);
});

test("il fotogramma arriva dal proprio Home Assistant, e un servizio solo se scelto", () => {
  /* Il fotogramma passa dal caricatore delle telecamere, che chiede
   * `entity_picture` al proprio Home Assistant col proprio token. */
  assert.match(sorgente, /import \{ loadCameraFrame \} from "\.\/live-ui-section\.js";/);
  /* Nessun indirizzo di servizio cablato qui dentro: quelli che si conoscono
   * stanno nel nucleo come DATI di una tendina, e la sola richiesta che esce
   * di casa parte da `aggiornaFotogramma`, che senza un servizio dichiarato
   * e scelto non fa niente. Chi sceglie un servizio lo sa, e sa cosa quel
   * servizio viene a sapere: sta scritto accanto alla tendina. */
  assert.doesNotMatch(
    sorgente,
    /protezionecivile\.it|radar-api\.|tilecache\.|openstreetmap\.org|cartocdn\.com|rainviewer\.com/i,
  );
  assert.match(sorgente, /const dichiarato = SERVIZI_RADAR\[servizio\];[\s\S]{0,400}root\.fetch\(dichiarato\.elenco/);
  assert.equal((sorgente.match(/root\.fetch\(/g) || []).length, 1, "una richiesta sola esce di casa");
  assert.match(sorgente, /la plancia non bussa a nessuno/);
  assert.match(sorgente, /data-dm-radar-prova/);
  assert.match(sorgente, /export function provaLIndirizzo/);
  /* Senza scelta non c'e' radar; con un servizio scelto c'e'; e l'entita' di
   * casa vince comunque sul servizio. */
  assert.equal(radarScelto({}), null);
  assert.equal(radarScelto({ servizio: "rainviewer" }).modo, "mappa");
  assert.equal(radarScelto({ servizio: "rainviewer", entity: "camera.radar" }).modo, "entita");
});

test("il radar si aggiorna solo mentre la finestra è aperta", () => {
  /* Un radar chiuso in un cassetto non serve a nessuno, e continuerebbe a
   * chiedere immagini tutto il giorno. */
  assert.match(sorgente, /if \(!finestraAperta\(\)\) \{\s*ferma\(\);/);
  assert.match(sorgente, /clearInterval/);
});

test("sta sopra le previsioni, che è dove è stato chiesto", () => {
  assert.match(sorgente, /#weather-forecast-list/);
  assert.match(sorgente, /elenco\.before\(nodo\)/);
});
