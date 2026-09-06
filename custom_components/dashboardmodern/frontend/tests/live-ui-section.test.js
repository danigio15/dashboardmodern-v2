import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/live-ui-section.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const {
  activeLightIds,
  configuredLightIds,
  lightIsOn,
  liveUiEventTargets,
} = await import(sourceUrl.href);

function withRuntime({ storage = {}, states = {} }, callback) {
  const previousStorage = globalThis.localStorage;
  const previousStates = globalThis.STATES;
  const previousRawStates = globalThis._RAW_STATES;
  const values = new Map(Object.entries(storage));
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
  globalThis.STATES = states;
  globalThis._RAW_STATES = states;
  try {
    return callback();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousStates === undefined) delete globalThis.STATES;
    else globalThis.STATES = previousStates;
    if (previousRawStates === undefined) delete globalThis._RAW_STATES;
    else globalThis._RAW_STATES = previousRawStates;
  }
}

test("configured lights use the same persisted registry as the editor and honor removals", () => {
  withRuntime(
    {
      storage: {
        cd_luci: JSON.stringify({
          "light.salone": "Salone",
          "switch.camera": "Camera",
        }),
        cd_gruppi_extra: JSON.stringify({ luci: ["light.corridoio", "light.salone"] }),
        cd_gruppi_removed: JSON.stringify({ luci: ["switch.camera"] }),
      },
    },
    () => {
      assert.deepEqual(configuredLightIds().sort(), ["light.corridoio", "light.salone"]);
    },
  );
});

test("light alert state reacts immediately to the ingested Home Assistant state", () => {
  withRuntime(
    {
      storage: {
        cd_luci: JSON.stringify({
          "light.salone": "Salone",
          "light.camera": "Camera",
        }),
      },
      states: {
        "light.salone": { state: "on", attributes: {} },
        "light.camera": { state: "off", attributes: {} },
      },
    },
    () => {
      assert.equal(lightIsOn("light.salone"), true);
      assert.equal(lightIsOn("light.camera"), false);
      assert.deepEqual(activeLightIds(), ["light.salone"]);
    },
  );
});

test("live UI filters unrelated Home Assistant events", () => {
  withRuntime(
    {
      storage: {
        cd_luci: JSON.stringify({ "light.salone": "Salone" }),
        cd_cameras: JSON.stringify([{ entity: "camera.salone", name: "Salone" }]),
      },
    },
    () => {
      assert.deepEqual(liveUiEventTargets({ detail: { entity_id: "sensor.unrelated" } }), {
        lights: false,
      });
      assert.deepEqual(liveUiEventTargets({ detail: { entity_id: "light.salone" } }), {
        lights: true,
      });
      /* Le telecamere non sono piu' fra le risposte: dal loro stato non si
       * disegna niente — un movimento rilevato non porta un fotogramma nuovo —
       * e leggerne la configurazione a ogni mazzetto era lavoro per una
       * risposta che nessuno usava. Il muro lo aggiorna il cronometro. */
      assert.deepEqual(liveUiEventTargets({ detail: { entity_id: "camera.salone" } }), {
        lights: false,
      });
    },
  );
});

test("canonical live UI owns camera refresh without introducing another polling loop", () => {
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.match(source, /root\.clearInterval\?\.\(root\.camInterval\)/);
  assert.match(source, /root\.refreshCameras = refreshCamerasCanonical/);
  assert.match(source, /dashboardmodern:state-changed/);
});

/* I fotogrammi li chiede il cronometro, e nessun altro.
 *
 * Un cambio di stato di una telecamera — il movimento, un attributo — non porta
 * nessun fotogramma nuovo, ma faceva chiedere a Home Assistant un'immagine dal
 * flusso: su una telecamera che vede passare qualcuno erano decine di
 * richieste al minuto al server di casa, in piu' del cronometro che il muro lo
 * aggiorna comunque ogni quattro secondi. */
test("i cambi di stato non chiedono piu' fotogrammi alle telecamere", () => {
  const ascolto = source.slice(source.indexOf('addEventListener?.("dashboardmodern:state-changed"'));
  const fine = ascolto.indexOf("doc.addEventListener");
  const dentro = ascolto.slice(0, fine > 0 ? fine : undefined);
  assert.doesNotMatch(dentro, /refreshCameraThumbnails/);
  assert.match(dentro, /liveUiEventTargets\(event\)\.lights/);
});

test("il cronometro delle telecamere si ferma anche a plancia parcheggiata", () => {
  /* La plancia messa da parte da chi la ospita non la guarda nessuno, ma la
   * sua pagina Sicurezza resta «attiva» e il documento resta «visible»: senza
   * l'aiutante condiviso avrebbe continuato a far tirare fotogrammi al server
   * di casa per sempre. */
  assert.match(source, /const wanted = securityVisible\(\) && planciaVisibile\(\)/);
  assert.match(source, /if \(!securityVisible\(\) \|\| !planciaVisibile\(\)\)/);
  assert.doesNotMatch(source, /doc\?\.visibilityState !== "hidden"/);
  /* E il passo resta quello del guscio storico, con scritto perche'. */
  assert.match(source, /const CAMERA_REFRESH_MS = 4000;/);
  assert.match(source, /lavoro del server di casa/);
});
