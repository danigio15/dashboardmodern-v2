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

import { radarScelto, radarVivo } from "../src/sections/radar-meteo-section.js";

const sorgente = readFileSync(
  new URL("../src/sections/radar-meteo-section.js", import.meta.url),
  "utf8",
);

test("si sceglie un'entità, e deve essere una che porta un'immagine", () => {
  assert.equal(radarScelto({ entity: "camera.radar_dpc" }).servibile, true);
  assert.equal(radarScelto({ entity: "image.radar" }).servibile, true);
  /* Un sensore non ha un fotogramma da dare: dirlo e' meglio che mostrare un
   * rettangolo vuoto per sempre. */
  assert.equal(radarScelto({ entity: "sensor.pioggia" }).servibile, false);
});

test("senza scelta, o con una scritta storta, non c'è radar", () => {
  for (const stored of [{}, null, undefined, { entity: "" }, { entity: "nondominio" }])
    assert.equal(radarScelto(stored), null);
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
   * addosso: non e' un radar. */
  assert.equal(
    radarVivo(radarScelto({ entity: "person.tizio" }), {
      "person.tizio": { attributes: { entity_picture: "/api/image/serve/x" } },
    }),
    false,
  );
});

test("il fotogramma arriva dal proprio Home Assistant, non da un servizio di terzi", () => {
  /* Il fotogramma passa dal caricatore delle telecamere, che chiede
   * `entity_picture` al proprio Home Assistant col proprio token. */
  assert.match(sorgente, /import \{ loadCameraFrame \} from "\.\/live-ui-section\.js";/);
  /* E nessun indirizzo esterno cablato: né la Protezione Civile né altri. */
  assert.doesNotMatch(sorgente, /https?:\/\/(?![^"'\s]*\/\/)[^"'\s]*\.(it|com|org|net)/);
  assert.doesNotMatch(sorgente, /protezionecivile|radar-api|tile\.openstreetmap/i);
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
