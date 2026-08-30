import assert from "node:assert/strict";
import test from "node:test";

import {
  drawableRobots,
  MOWER_ACTIONS,
  MOWER_FEATURES,
  normalizeRobots,
  ROBOT_ACTIONS,
  robotActions,
  robotCommand,
  robotFanCommand,
  robotMapPicture,
  robotSpecies,
  robotStateLabel,
  robotView,
  SPECIES_LABELS,
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

/* Task #220: il tagliaerba e' un robot, non un aspirapolvere travestito.
 *
 * La specie la dice il prefisso dell'entita', e con lei cambiano il dialetto
 * dei servizi, gli stati, i pulsanti — e sparisce la potenza di aspirazione,
 * che un tagliaerba non ha mai avuto. */

test("la specie la dice il prefisso dell'entita'", () => {
  assert.equal(robotSpecies("vacuum.robottino"), "vacuum");
  assert.equal(robotSpecies("lawn_mower.rasaerba"), "lawn_mower");
  // Un robot senza entita' — appena aggiunto — resta la specie di sempre.
  assert.equal(robotSpecies(""), "vacuum");
  assert.ok(SPECIES_LABELS.lawn_mower[0] && SPECIES_LABELS.lawn_mower[1]);
});

test("il tagliaerba che taglia si dice, in tutte e due le lingue", () => {
  const view = robotView(
    { entity: "lawn_mower.rasaerba" },
    { "lawn_mower.rasaerba": stato("mowing") },
  );
  assert.equal(view.species, "lawn_mower");
  assert.equal(view.state, "mowing");
  assert.equal(view.mowing, true);
  assert.equal(view.cleaning, false);
  assert.equal(robotStateLabel(view.state), "Sta tagliando");
  assert.equal(robotStateLabel(view.state, true), "Mowing");
  // Gli stati comuni restano comuni: alla base e' alla base anche sul prato.
  const base = robotView(
    { entity: "lawn_mower.rasaerba" },
    { "lawn_mower.rasaerba": stato("docked", { battery_level: 50 }) },
  );
  assert.equal(base.state, "docked");
  assert.equal(base.charging, true);
});

test("i pulsanti del tagliaerba sono i suoi, coi suoi numeri", () => {
  // Senza dichiarazioni li ha tutti e tre — e mai stop, spot o locate.
  const muto = robotView(
    { entity: "lawn_mower.rasaerba" },
    { "lawn_mower.rasaerba": stato("docked") },
  );
  assert.deepEqual(robotActions(muto), MOWER_ACTIONS);
  assert.deepEqual(
    MOWER_ACTIONS.map((action) => action.act),
    ["start", "pause", "return"],
  );
  // I numeri delle capacita' sono quelli di lawn_mower, non quelli dei vacuum:
  // DOCK vale 4, che per un vacuum sarebbe PAUSE.
  const parziale = robotView(
    { entity: "lawn_mower.rasaerba" },
    {
      "lawn_mower.rasaerba": stato("docked", {
        supported_features: MOWER_FEATURES.START_MOWING | MOWER_FEATURES.DOCK,
      }),
    },
  );
  assert.deepEqual(
    robotActions(parziale).map((action) => action.act),
    ["start", "return"],
  );
});

test("i comandi del tagliaerba parlano il dominio lawn_mower", () => {
  const view = { entity: "lawn_mower.rasaerba" };
  assert.deepEqual(robotCommand("start", view), {
    domain: "lawn_mower",
    service: "start_mowing",
    data: { entity_id: "lawn_mower.rasaerba" },
  });
  assert.deepEqual(robotCommand("pause", view), {
    domain: "lawn_mower",
    service: "pause",
    data: { entity_id: "lawn_mower.rasaerba" },
  });
  assert.deepEqual(robotCommand("return", view), {
    domain: "lawn_mower",
    service: "dock",
    data: { entity_id: "lawn_mower.rasaerba" },
  });
  // Niente ripiego turn_on/turn_off: un tagliaerba non ha mai avuto quei
  // servizi, e uno «stop» non esiste proprio.
  const vecchio = { entity: "lawn_mower.rasaerba", features: MOWER_FEATURES.PAUSE };
  assert.equal(robotCommand("start", vecchio).service, "start_mowing");
  assert.equal(robotCommand("stop", view), null);
});

test("un tagliaerba non ha potenza di aspirazione, qualunque cosa dichiari", () => {
  const view = robotView(
    { entity: "lawn_mower.rasaerba" },
    {
      "lawn_mower.rasaerba": stato("mowing", { fan_speed: "Alta", fan_speed_list: ["Alta", "Bassa"] }),
    },
  );
  assert.deepEqual(view.fanSpeeds, []);
  assert.equal(view.fanSpeed, "");
  assert.equal(robotFanCommand(view, "Alta"), null);
});

test("la batteria configurata a parte vince su quella dell'attributo", () => {
  // Molti tagliaerba la pubblicano come sensore separato: il campo e'
  // facoltativo e deve sopravvivere alla normalizzazione, o sparirebbe a ogni
  // salvataggio.
  const [robot] = normalizeRobots([
    { entity: "lawn_mower.rasaerba", battery: "sensor.rasaerba_batteria" },
  ]);
  assert.equal(robot.battery, "sensor.rasaerba_batteria");

  const states = {
    "lawn_mower.rasaerba": stato("mowing", { battery_level: 15 }),
    "sensor.rasaerba_batteria": stato("76"),
  };
  const view = robotView(robot, states);
  assert.equal(view.battery, 76);
  assert.equal(view.batteryEntity, "sensor.rasaerba_batteria");
  // Il sensore che tace non lascia la scheda senza carica: si torna
  // all'attributo, che e' meglio di niente.
  const muto = robotView(robot, {
    "lawn_mower.rasaerba": stato("mowing", { battery_level: 15 }),
    "sensor.rasaerba_batteria": stato("unavailable"),
  });
  assert.equal(muto.battery, 15);
  // E per i vacuum senza sensore a parte non cambia niente.
  const vac = robotView(
    { entity: "vacuum.a" },
    { "vacuum.a": stato("cleaning", { battery_level: 40 }) },
  );
  assert.equal(vac.battery, 40);
});

test("l'editor accetta anche i tagliaerba, e offre il campo batteria", async () => {
  // La regola di validazione non e' esportata — e' un dettaglio della scheda —
  // quindi si legge dal sorgente e si prova per quello che e': la porta che
  // decide chi e' un robot.
  const { readFileSync } = await import("node:fs");
  const testo = readFileSync(
    new URL("../src/sections/robot-editor-section.js", import.meta.url),
    "utf8",
  );
  const regola = testo.match(/if \(!(\/\^[^\n]+?\/i)\.test\(next\[index\]\.entity\)\)/);
  assert.ok(regola, "la validazione dell'entita' non c'e' piu'");
  const porta = new Function(`return ${regola[1]}`)();
  assert.ok(porta.test("vacuum.robottino"));
  assert.ok(porta.test("lawn_mower.rasaerba"));
  assert.ok(!porta.test("sensor.batteria"));
  assert.ok(!porta.test("lawn_mower."));
  // Il campo facoltativo della batteria salva `battery` nella riga del robot.
  assert.match(testo, /-battery`/);
  assert.match(testo, /lawn_mower/);
});

test("l'intestazione della pagina robot non nomina una specie sola", async () => {
  const { readFileSync } = await import("node:fs");
  const testo = readFileSync(
    new URL("../src/sections/page-masthead-section.js", import.meta.url),
    "utf8",
  );
  const blocco = testo.slice(testo.indexOf('id: "page-robot"'), testo.indexOf('id: "page-stanze"'));
  assert.ok(blocco.length > 0, "la pagina robot non e' piu' nell'elenco delle intestazioni");
  assert.doesNotMatch(blocco, /aspirapolvere|vacuum|tagliaerba|mower/i);
});

/* Task #24: una sola larghezza per tutte le sezioni, in un posto solo.
 * La pagina del robot era nata con 1040 scritto a mano — la vecchia misura
 * della piscina — e si apriva quattrocento pixel piu' stretta delle altre. */
test("la pagina del robot non si sceglie una larghezza sua", async () => {
  const { readFileSync } = await import("node:fs");
  const testo = readFileSync(
    new URL("../src/sections/robot-section.js", import.meta.url),
    "utf8",
  );
  const riga = testo
    .split("\n")
    .find((linea) => linea.includes("#page-robot .dm-robot-wrap{"));
  assert.ok(riga, "la regola della cornice del robot non c'e' piu'");
  assert.match(riga, /max-width:var\(--dm-page-room/);
  // Il minimo delle colonne resta suo; il tetto della pagina no.
  const larghezze = riga.match(/(?:^|[;{])(?:min-|max-)?width:[^;}]*/g) || [];
  for (const dichiarazione of larghezze) {
    assert.doesNotMatch(dichiarazione, /\d{3,4}px/, `larghezza scritta a mano: ${dichiarazione}`);
  }
});
