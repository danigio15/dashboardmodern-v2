import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDevice } from "../src/core/device-model.js";

test("EV normalization preserves entity overrides, image, brand and custom icon", () => {
  const profile = normalizeDevice(
    {
      id: "ev-pluto",
      name: "Pluto",
      ov: {
        "dm.ev_batteria_auto": "sensor.pluto_soc",
        "dm.ev_autonomia": "sensor.pluto_range",
      },
      img: "/local/pluto.png",
      brand: "BMW",
      icon: "mdi:car-sports",
      custom_flag: "kept",
    },
    "ev",
    { index: 0, rooms: [] },
  );

  assert.equal(profile.id, "ev-pluto");
  assert.equal(profile.name, "Pluto");
  assert.equal(profile.brand, "BMW");
  assert.equal(profile.icon, "mdi:car-sports");
  assert.equal(profile.img, "/local/pluto.png");
  assert.equal(profile.image, "/local/pluto.png");
  assert.equal(profile.image_url, "/local/pluto.png");
  assert.equal(profile.custom_flag, "kept");
  assert.deepEqual(profile.ov, {
    "dm.ev_batteria_auto": "sensor.pluto_soc",
    "dm.ev_autonomia": "sensor.pluto_range",
  });
  assert.deepEqual(profile.overrides, profile.ov);
});

test("EV normalization also accepts the newer overrides field", () => {
  const profile = normalizeDevice(
    {
      id: "ev-b10",
      name: "B10",
      overrides: { "dm.ev_soc": "sensor.b10_soc" },
      image_url: "/local/b10.webp",
      brand: "Leapmotor",
    },
    "ev",
    { index: 1, rooms: [] },
  );

  assert.deepEqual(profile.ov, { "dm.ev_soc": "sensor.b10_soc" });
  assert.deepEqual(profile.overrides, { "dm.ev_soc": "sensor.b10_soc" });
  assert.equal(profile.img, "/local/b10.webp");
  assert.equal(profile.brand, "Leapmotor");
});

test("il campo del nome non ricarica ne' svuota le caselle delle entita'", async () => {
  /* C'era un guardiano sul campo del nome che, a ogni tasto, ricaricava o
   * svuotava le caselle dm.ev_*: rinominare un'auto era impossibile perche' a
   * meta' digitazione i campi cambiavano padrone. Per non calpestare chi
   * scriveva a mano gli era stato affiancato un segnalibro dei campi toccati
   * — e quando il guardiano e' stato tolto, quel segnalibro ha continuato a
   * riempirsi e a svuotarsi senza che nessuno lo leggesse mai. Sono andati
   * via insieme. */
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const sorgente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "ev-section.js"),
    "utf8",
  );
  assert.doesNotMatch(
    sorgente,
    /ensureCarNameGuard|installSlotTouchTracker|refToccati|evTouchedRefs/,
    "guardiano e segnalibro non esistono piu'",
  );
  /* Di chi sono i campi lo decide la sessione, con i suoi tre stati. */
  assert.match(sorgente, /function editingKey\(\)/);
  /* `carKey` ricavava la chiave dal nome quando non la trovava scritta: due
   * auto chiamate quasi uguale ne ricavavano una sola. Adesso l'uid si legge
   * dove sta scritto, e basta. */
  assert.match(sorgente, /setEditingKey\(uidDi\(/);
});
