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
