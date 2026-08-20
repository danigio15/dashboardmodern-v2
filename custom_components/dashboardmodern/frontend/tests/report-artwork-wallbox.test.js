import assert from "node:assert/strict";
import test from "node:test";

import { applianceArtwork, canonicalArtworkType } from "../src/core/appliance-artwork.js";
import { applianceArtworkType } from "../src/core/appliance-card-view-model.js";

test("la wallbox ha un disegno suo, e il clima il suo", () => {
  // Nel Report si vedevano due schede con la stessa identica icona: nessuno dei
  // due nomi era nel catalogo, e cadevano tutt'e due sul disegno generico.
  assert.equal(canonicalArtworkType("Wallbox"), "wallbox");
  assert.equal(canonicalArtworkType("colonnina di ricarica"), "wallbox");
  assert.equal(canonicalArtworkType("EV charger"), "wallbox");
  assert.equal(canonicalArtworkType("Clima"), "air-conditioner");
  assert.notEqual(canonicalArtworkType("Wallbox"), canonicalArtworkType("Clima"));

  // Il nome canonico deve poter rientrare da solo: e' quello che viene salvato.
  assert.equal(canonicalArtworkType("wallbox"), "wallbox");
  assert.equal(canonicalArtworkType("air-conditioner"), "air-conditioner");
});

test("il disegno della wallbox esiste e ha la stessa impaginazione degli altri", () => {
  const wallbox = applianceArtwork("wallbox", 56);
  assert.ok(wallbox.includes('data-dm-art="wallbox"'));
  // Stessa cornice e stessa griglia di tutte le altre: e' questo che le fa
  // sembrare disegnate dalla stessa mano.
  assert.ok(wallbox.includes('data-dm-art-style="panel"'));
  assert.ok(wallbox.includes('viewBox="0 0 96 96"'));
  assert.ok(wallbox.includes('class="dm-art-panel"'));
  assert.notEqual(applianceArtwork("wallbox", 56), applianceArtwork("generic", 56));
});

test("un'icona scritta a mano non nasconde piu' il nome del dispositivo", () => {
  // Bastava un'icona impostata nell'editor perche' il nome non venisse mai
  // guardato: e l'icona, per il catalogo dei disegni, non vuol dire niente.
  assert.equal(applianceArtworkType({ name: "Wallbox", icon: "🔌" }), "wallbox");
  assert.equal(applianceArtworkType({ name: "Clima", icon: "mdi:snowflake" }), "air-conditioner");
  assert.equal(applianceArtworkType({ name: "Boiler", icon: "mdi:water-boiler" }), "boiler");
  // Chi ha un tipo dichiarato continua a vincere sul nome.
  assert.equal(applianceArtworkType({ device_type: "dryer", name: "Lavatrice" }), "dryer");
  // E cio' che nessuno riconosce resta generico, non vuoto.
  assert.equal(applianceArtworkType({ name: "Cosa strana", icon: "❓" }), "generic");
});
