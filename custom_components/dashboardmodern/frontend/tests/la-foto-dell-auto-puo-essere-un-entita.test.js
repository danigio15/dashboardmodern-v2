/* «Sarebbe utile avere anche la possibilità di specificare l'immagine dell'auto
 * come entità immagine da selezionare al posto del path del file locale. Alcune
 * integrazioni come UConnect mettono a disposizione questa entità.» (#369)
 *
 * Finora la foto era un indirizzo scritto a mano. Ma certe integrazioni la foto
 * ce l'hanno gia' — l'auto vera — e la pubblicano come entita': copiarla in
 * `www` vuol dire tenerla aggiornata a mano.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { eUnaFotoDaEntita, fotoDallEntita } from "../src/core/foto-da-entita.js";

const CASA = {
  "image.uconnect_auto": {
    state: "2026-09-07T10:00:00+00:00",
    attributes: { entity_picture: "/api/image_proxy/image.uconnect_auto?token=abc" },
  },
  "camera.tesla_vista": { state: "idle", attributes: {} },
  "sensor.batteria_auto": { state: "72", attributes: { unit_of_measurement: "%" } },
};

test("un'entita' immagine si riconosce, un file no", () => {
  assert.equal(eUnaFotoDaEntita("image.uconnect_auto"), true);
  assert.equal(eUnaFotoDaEntita("camera.tesla_vista"), true);
  /* Un percorso ha una barra o uno spazio: non e' un'entita' per quanto ci
   * somigli. */
  assert.equal(eUnaFotoDaEntita("/local/mia_auto.png"), false);
  assert.equal(eUnaFotoDaEntita("mia_auto.png"), false, "un file col punto resta un file");
  assert.equal(eUnaFotoDaEntita("https://esempio.it/auto.png"), false);
  assert.equal(eUnaFotoDaEntita(""), false);
});

test("una persona non e' una foto di una cosa", () => {
  /* Ha un ritratto, ma scrivendola per sbaglio in una casella dell'auto
   * uscirebbe la sua faccia sull'eroe. */
  assert.equal(eUnaFotoDaEntita("person.giovanni"), false);
  assert.equal(eUnaFotoDaEntita("sensor.batteria_auto"), false);
});

test("l'indirizzo arriva da Home Assistant, col suo gettone", () => {
  /* Il gettone cambia quando l'immagine cambia: e' quello che fa aggiornare la
   * foto da se' invece di restare in cache. */
  assert.equal(
    fotoDallEntita("image.uconnect_auto", CASA),
    "/api/image_proxy/image.uconnect_auto?token=abc",
  );
});

test("una telecamera senza entity_picture passa dal fermo immagine", () => {
  assert.equal(fotoDallEntita("camera.tesla_vista", CASA), "/api/camera_proxy/camera.tesla_vista");
});

test("un'entita' che non c'e' non inventa un indirizzo", () => {
  /* Vuoto vuol dire «nessuna foto», e chi disegna sa cosa farne. Inventare un
   * indirizzo vorrebbe dire un riquadro rotto al posto di niente. */
  assert.equal(fotoDallEntita("image.non_esiste", CASA), "");
  assert.equal(fotoDallEntita("/local/mia_auto.png", CASA), "");
});

/* ── e chi disegna non deve sapere che e' un'entita' ───────────────────────── */

test("ogni foto dell'auto passa dallo stesso imbuto, file o entita' che sia", async () => {
  /* `resolveVehicleAsset` e' l'unico posto da cui esce l'indirizzo di una foto
   * dell'auto — l'eroe, la vetrina, il profilo, l'anteprima in configurazione.
   * Se l'entita' non la capisse qui, ognuno di quei quattro dovrebbe capirla
   * per conto suo: quattro verita' invece di una. */
  const { resolveVehicleAsset } = await import("../src/sections/ev-section.js");
  const base = "http://casa.local/dashboard";
  assert.equal(
    resolveVehicleAsset("image.uconnect_auto", base, CASA),
    "/api/image_proxy/image.uconnect_auto?token=abc",
  );
  assert.equal(
    resolveVehicleAsset("camera.tesla_vista", base, CASA),
    "/api/camera_proxy/camera.tesla_vista",
  );
  // Il file continua a comportarsi da file.
  assert.equal(resolveVehicleAsset("/config/www/auto/b10.png", base, CASA), "/local/auto/b10.png");
});

test("la lente cerca le entita' immagine, non solo le telecamere", async () => {
  /* Il campo della foto si porta scritto `data-domain="image camera"`, e la
   * ricerca ne tiene conto solo per i domini che conosce: senza `image` il
   * campo chiedeva una cosa che il catalogo non sapeva filtrare. */
  const { fieldHints } = await import("../src/core/entity-search-index.js");
  const attesi = [...fieldHints({ domain: "image camera", label: "Cavo staccato" }).domains];
  assert.ok(attesi.includes("image"), "il dominio image deve arrivare alla ricerca");
  assert.ok(attesi.includes("camera"));
});
