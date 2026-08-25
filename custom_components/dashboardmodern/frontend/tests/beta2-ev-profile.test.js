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

test("il segnalibro dei campi toccati si installa al montaggio, non al primo giro", async () => {
  /* Su un dispositivo lento l'editor e' visibile prima del primo giro
   * differito: un'entita' digitata in quella finestra non veniva marcata, e
   * il guardiano del nome la svuotava come residuo dell'auto precedente. */
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const sorgente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "ev-section.js"),
    "utf8",
  );
  const montaggio = sorgente.slice(sorgente.indexOf("export function installEvSection"));
  assert.match(montaggio.slice(0, 400), /installSlotTouchTracker\(\)/);
  const guardia = sorgente.slice(sorgente.indexOf("function ensureCarNameGuard"));
  assert.match(guardia.slice(0, 120), /installSlotTouchTracker\(\)/);
  /* Il nome e' un dato, non un timone: digitare nel campo del nome non deve
   * piu' ricaricare ne' svuotare le caselle delle entita'. Di chi sono i
   * campi lo decide la sessione (matita, ＋, applica). */
  const corpoGuardia = guardia.slice(0, guardia.indexOf("\n}") + 2);
  assert.doesNotMatch(corpoGuardia, /addEventListener\("input"/);
  assert.doesNotMatch(corpoGuardia, /input\.value = valore/);
  /* E la sessione esiste davvero, con i tre stati raccontati. */
  assert.match(sorgente, /function editingKey\(\)/);
  assert.match(sorgente, /setEditingKey\(carKey\(/);
});
