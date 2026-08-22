import assert from "node:assert/strict";
import test from "node:test";
import { applianceArtwork, canonicalArtworkType } from "../src/core/appliance-artwork.js";
import { CAR_BRANDS, ROOM_CATALOG, brandMatch, carBrandVisual, roomCatalogMatch, roomVisual } from "../src/core/personalization-catalog.js";

test("apartment room catalog covers the common room families", () => {
  assert.ok(ROOM_CATALOG.length >= 20);
  assert.equal(roomCatalogMatch("Cucina")?.id, "kitchen");
  assert.equal(roomCatalogMatch("mdi:bed-king-outline")?.id, "bedroom");
  assert.equal(roomCatalogMatch("Cameretta")?.id, "kids");
  assert.match(roomVisual("Bagno", 40), /dm-room-art/);
});

test("vehicle brand selector offers a broad local catalog", () => {
  assert.ok(CAR_BRANDS.length >= 30);
  assert.equal(brandMatch("Leapmotor")?.name, "Leapmotor");
  assert.equal(brandMatch("Mercedes-Benz")?.name, "Mercedes-Benz");
  assert.match(carBrandVisual("BMW", 40), /dm-car-brand/);
  /* Una marca che non conosciamo non e' una marca che conosciamo.
   *
   * Il ripiego era Leapmotor: chi scriveva una marca fuori dal catalogo si
   * ritrovava addosso il marchio di un'altra casa, senza che niente glielo
   * dicesse — la plancia affermava una cosa falsa sulla macchina di qualcuno.
   * Adesso dice le iniziali di quello che e' stato scritto. */
  const sconosciuta = carBrandVisual("Marca Inventata", 40);
  assert.match(sconosciuta, /data-brand-source="unknown"/);
  assert.doesNotMatch(sconosciuta, /leapmotor/i, "il marchio di un'altra casa");
  assert.match(sconosciuta, />MA</, "le iniziali di quello che e' stato scritto");
  // E una marca conosciuta resta la sua.
  assert.match(carBrandVisual("Leapmotor", 40), /leapmotor/i);
});

test("every legacy appliance family has custom SVG artwork", () => {
  const legacy = [
    "lavatrice", "lavastoviglie", "asciugatrice", "forno", "microonde", "frigo",
    "congelatore", "piano_cottura", "cappa", "ferro", "aspirapolvere", "robot aspirapolvere",
    "condizionatore", "ventilatore", "scaldabagno", "tv", "caffe", "tostapane", "bollitore", "generico",
  ];
  for (const type of legacy) {
    assert.ok(canonicalArtworkType(type), `missing canonical artwork type for ${type}`);
    assert.match(applianceArtwork(type, 48), /dm-appliance-art/);
  }
});
