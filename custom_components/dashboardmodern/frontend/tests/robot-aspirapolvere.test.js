import assert from "node:assert/strict";
import test from "node:test";

import {
  drawableRobots,
  normalizeRobots,
  ROBOT_ACTIONS,
  robotActions,
  robotCommand,
  robotFanCommand,
  robotMapPicture,
  robotStateLabel,
  robotView,
  VACUUM_FEATURES,
} from "../src/core/robot-model.js";

const stato = (state, attributes = {}) => ({ state, attributes });

test("mettere in ordine non e' scegliere", () => {
  // Un robot appena aggiunto non ha ancora un'entita': buttarlo via qui
  // vorrebbe dire che premere "Aggiungi" non fa niente.
  const elenco = normalizeRobots([{ name: "Nuovo" }, { entity: "vacuum.a" }]);
  assert.equal(elenco.length, 2);
  assert.equal(elenco[0].entity, "");
  // Chi disegna invece mostra solo quelli che hanno un'entita'.
  assert.deepEqual(
    drawableRobots(elenco).map((robot) => robot.entity),
    ["vacuum.a"],
  );
});

test("lo stesso robot due volte e' sempre un errore", () => {
  const elenco = normalizeRobots([
    { entity: "vacuum.a", name: "Primo" },
    { entity: "vacuum.a", name: "Di nuovo" },
  ]);
  assert.equal(elenco.length, 1);
  assert.equal(elenco[0].name, "Primo");
});

test("un robot solo, scritto senza elenco, vale come elenco di uno", () => {
  assert.deepEqual(
    normalizeRobots({ entity: "vacuum.a" }).map((robot) => robot.entity),
    ["vacuum.a"],
  );
});

test("un robot che non risponde non e' un robot in attesa", () => {
  const spento = robotView({ entity: "vacuum.a" }, {});
  assert.equal(spento.available, false);
  assert.equal(spento.state, "unavailable");
  assert.equal(robotStateLabel(spento.state), "Non raggiungibile");

  const acceso = robotView({ entity: "vacuum.a" }, { "vacuum.a": stato("idle") });
  assert.equal(acceso.available, true);
  assert.equal(acceso.state, "idle");
});

test("uno stato che non conosciamo si dice sconosciuto, non si inventa", () => {
  const view = robotView({ entity: "vacuum.a" }, { "vacuum.a": stato("mopping") });
  assert.equal(view.state, "unknown");
  assert.equal(robotStateLabel(view.state), "Sconosciuto");
  assert.equal(robotStateLabel(view.state, true), "Unknown");
});

test("la batteria si legge, e alla base che si carica si vede", () => {
  const alla = robotView({ entity: "vacuum.a" }, { "vacuum.a": stato("docked", { battery_level: 40 }) });
  assert.equal(alla.battery, 40);
  assert.equal(alla.charging, true);
  const piena = robotView({ entity: "vacuum.a" }, { "vacuum.a": stato("docked", { battery_level: 100 }) });
  assert.equal(piena.charging, false);
  const senza = robotView({ entity: "vacuum.a" }, { "vacuum.a": stato("idle") });
  assert.equal(senza.battery, null);
});

test("i pulsanti sono quelli che il robot dichiara di saper fare", () => {
  const view = robotView(
    { entity: "vacuum.a" },
    {
      "vacuum.a": stato("idle", {
        supported_features: VACUUM_FEATURES.START | VACUUM_FEATURES.RETURN_HOME,
      }),
    },
  );
  assert.deepEqual(
    robotActions(view).map((action) => action.act),
    ["start", "return"],
  );
});

test("un robot che non dichiara niente li ha tutti", () => {
  // Capita con le integrazioni fatte in casa: negarglieli sulla base di un
  // silenzio sarebbe peggio che offrirglieli.
  const view = robotView({ entity: "vacuum.a" }, { "vacuum.a": stato("idle") });
  assert.deepEqual(robotActions(view), ROBOT_ACTIONS);
});

test("un robot vecchio si avvia col nome di prima", () => {
  const nuovo = { entity: "vacuum.a", features: VACUUM_FEATURES.START };
  assert.deepEqual(robotCommand("start", nuovo), {
    domain: "vacuum",
    service: "start",
    data: { entity_id: "vacuum.a" },
  });
  const vecchio = { entity: "vacuum.a", features: VACUUM_FEATURES.TURN_ON | VACUUM_FEATURES.TURN_OFF };
  assert.deepEqual(robotCommand("start", vecchio), {
    domain: "vacuum",
    service: "turn_on",
    data: { entity_id: "vacuum.a" },
  });
  assert.deepEqual(robotCommand("stop", vecchio), {
    domain: "vacuum",
    service: "turn_off",
    data: { entity_id: "vacuum.a" },
  });
});

test("un pulsante che non esiste non chiama niente", () => {
  assert.equal(robotCommand("balla", { entity: "vacuum.a" }), null);
  assert.equal(robotFanCommand({ entity: "vacuum.a" }, ""), null);
});

test("la potenza di aspirazione si cambia sul robot giusto", () => {
  assert.deepEqual(robotFanCommand({ entity: "vacuum.a" }, "Turbo"), {
    domain: "vacuum",
    service: "set_fan_speed",
    data: { entity_id: "vacuum.a", fan_speed: "Turbo" },
  });
});

test("la mappa arriva da una telecamera o da un'immagine, non da un'entita' mappa", () => {
  const states = {
    "camera.mappa": stato("idle", { entity_picture: "/api/camera_proxy/camera.mappa?token=1" }),
    "image.mappa": stato("2026-08-21", { entity_picture: "/api/image_proxy/image.mappa" }),
  };
  assert.equal(robotMapPicture(states, "camera.mappa"), "/api/camera_proxy/camera.mappa?token=1");
  assert.equal(robotMapPicture(states, "image.mappa"), "/api/image_proxy/image.mappa");
  assert.equal(robotMapPicture(states, "camera.assente"), "");
  assert.equal(robotMapPicture(states, ""), "");
});

test("il nome viene dalla configurazione, poi da Home Assistant, poi dall'entita'", () => {
  const states = { "vacuum.a": stato("idle", { friendly_name: "Robottino" }) };
  assert.equal(robotView({ entity: "vacuum.a", name: "Piano terra" }, states).name, "Piano terra");
  assert.equal(robotView({ entity: "vacuum.a" }, states).name, "Robottino");
  assert.equal(robotView({ entity: "vacuum.a" }, {}).name, "vacuum.a");
});
