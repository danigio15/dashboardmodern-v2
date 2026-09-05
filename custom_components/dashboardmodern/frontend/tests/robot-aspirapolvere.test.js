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
  const alla = robotView(
    { entity: "vacuum.a" },
    { "vacuum.a": stato("docked", { battery_level: 40 }) },
  );
  assert.equal(alla.battery, 40);
  assert.equal(alla.charging, true);
  const piena = robotView(
    { entity: "vacuum.a" },
    { "vacuum.a": stato("docked", { battery_level: 100 }) },
  );
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
  const vecchio = {
    entity: "vacuum.a",
    features: VACUUM_FEATURES.TURN_ON | VACUUM_FEATURES.TURN_OFF,
  };
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
      "lawn_mower.rasaerba": stato("mowing", {
        fan_speed: "Alta",
        fan_speed_list: ["Alta", "Bassa"],
      }),
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
  const testo = readFileSync(new URL("../src/sections/robot-section.js", import.meta.url), "utf8");
  const riga = testo.split("\n").find((linea) => linea.includes("#page-robot .dm-robot-wrap{"));
  assert.ok(riga, "la regola della cornice del robot non c'e' piu'");
  assert.match(riga, /max-width:var\(--dm-page-room/);
  // Il minimo delle colonne resta suo; il tetto della pagina no.
  const larghezze = riga.match(/(?:^|[;{])(?:min-|max-)?width:[^;}]*/g) || [];
  for (const dichiarazione of larghezze) {
    assert.doesNotMatch(dichiarazione, /\d{3,4}px/, `larghezza scritta a mano: ${dichiarazione}`);
  }
});

/* ── i comandi a parte del robot (#306) ────────────────────────────────── */

import {
  COMANDI_MASSIMI,
  comandiDelRobot,
  comandiSuggeriti,
  comandoDelRobot,
  DOMINI_COMANDO,
  elencoComandi,
  genereDelComando,
  nomeDelComando,
} from "../src/core/robot-model.js";
import { readFile } from "node:fs/promises";

const ROBOROCK = "vacuum.roborock_qrevo_edge_series";
const casaRoborock = {
  [ROBOROCK]: stato("docked", { friendly_name: "Roborock Qrevo Edge Series", battery_level: 100 }),
  "button.roborock_qrevo_edge_series_asp_e_lav": stato("unknown", {
    friendly_name: "Roborock Qrevo Edge Series Asp e lav",
  }),
  "button.roborock_qrevo_edge_series_pulizia_completa": stato("2026-09-03T10:00:00+00:00", {
    friendly_name: "Roborock Qrevo Edge Series Pulizia completa",
  }),
  "button.roborock_qrevo_edge_series_solo_aspirazione": stato("unknown", {
    friendly_name: "Roborock Qrevo Edge Series Solo aspirazione",
  }),
  "button.roborock_qrevo_edge_series_solo_lavaggio": stato("unavailable", {
    friendly_name: "Roborock Qrevo Edge Series Solo lavaggio",
  }),
  "select.roborock_qrevo_edge_series_mop_mode": stato("standard", {
    friendly_name: "Roborock Qrevo Edge Series Mop mode",
    options: ["standard", "deep", "deep_plus"],
  }),
  "switch.roborock_qrevo_edge_series_child_lock": stato("off", {
    friendly_name: "Roborock Qrevo Edge Series Child lock",
  }),
  "button.roborock_qrevo_edge_series_reset_sensor_consumable": stato("unknown", {
    friendly_name: "Roborock Qrevo Edge Series Reset sensor consumable",
  }),
  /* Un'altra casa: non c'entra, e non si propone. */
  "button.cancello_apri": stato("unknown", { friendly_name: "Cancello apri" }),
  "sensor.roborock_qrevo_edge_series_battery": stato("100", {
    friendly_name: "Roborock Qrevo Edge Series Battery",
  }),
};

test("i comandi a parte sono tasti, tendine e interruttori, e restano dopo la normalizzazione (#306)", () => {
  /* «Le varie entita' del robot continuano a non essere visibili: da solo la
   * modalita' aspirazione.» I programmi del Roborock sono `button.*` a parte:
   * la configurazione li tiene, nell'ordine scritto, una volta sola, e scarta
   * cio' che non si puo' comandare. */
  assert.equal(genereDelComando("button.a"), "tasto");
  assert.equal(genereDelComando("input_button.a"), "tasto");
  assert.equal(genereDelComando("script.a"), "tasto");
  assert.equal(genereDelComando("scene.a"), "tasto");
  // Chi il robot lo comanda a automazioni ha un cruscotto come tutti gli altri.
  assert.equal(genereDelComando("automation.a"), "tasto");
  assert.equal(genereDelComando("select.a"), "tendina");
  assert.equal(genereDelComando("input_select.a"), "tendina");
  assert.equal(genereDelComando("switch.a"), "interruttore");
  assert.equal(genereDelComando("input_boolean.a"), "interruttore");
  assert.equal(genereDelComando("sensor.a"), "");
  assert.equal(genereDelComando(""), "");
  assert.equal(Object.keys(DOMINI_COMANDO).length, 9);

  assert.deepEqual(
    elencoComandi([
      "button.b",
      " select.c ",
      "sensor.no",
      "button.b",
      "",
      null,
      { entity: "switch.d" },
    ]),
    ["button.b", "select.c", "switch.d"],
  );
  /* Anche scritto come testo, com'e' quando passa da una casella nascosta. */
  assert.deepEqual(elencoComandi("button.b, select.c;switch.d\nsensor.no"), [
    "button.b",
    "select.c",
    "switch.d",
  ]);
  assert.deepEqual(elencoComandi(undefined), []);
  /* Non piu' di dodici: una scheda e' una scheda. */
  const tanti = Array.from({ length: 20 }, (_v, i) => `button.t${i}`);
  assert.equal(elencoComandi(tanti).length, COMANDI_MASSIMI);

  const [robot] = normalizeRobots([
    { entity: ROBOROCK, comandi: ["button.roborock_qrevo_edge_series_asp_e_lav", "sensor.no"] },
  ]);
  assert.deepEqual(robot.comandi, ["button.roborock_qrevo_edge_series_asp_e_lav"]);
  /* E chi salva col nome inglese non perde niente. */
  assert.deepEqual(normalizeRobots([{ entity: "vacuum.a", commands: "button.x" }])[0].comandi, [
    "button.x",
  ]);
  assert.deepEqual(normalizeRobots([{ entity: "vacuum.a" }])[0].comandi, []);
});

test("il nome del comando non ripete il nome del robot (#306)", () => {
  const robot = { entity: ROBOROCK };
  assert.equal(
    nomeDelComando("button.roborock_qrevo_edge_series_asp_e_lav", robot, casaRoborock),
    "Asp e lav",
  );
  assert.equal(
    nomeDelComando("select.roborock_qrevo_edge_series_mop_mode", robot, casaRoborock),
    "Mop mode",
  );
  /* Senza friendly_name si legge la coda dell'id, resa leggibile. */
  assert.equal(
    nomeDelComando("button.roborock_qrevo_edge_series_solo_lavaggio", robot, {}),
    "Solo lavaggio",
  );
  /* Un nome che non comincia col robot resta com'e'. */
  assert.equal(nomeDelComando("button.cancello_apri", robot, casaRoborock), "Cancello apri");
  /* E il nome che e' solo il nome del robot non diventa vuoto. */
  assert.equal(
    nomeDelComando("switch.x", robot, {
      "switch.x": stato("on", { friendly_name: "Roborock Qrevo Edge Series" }),
    }),
    "Roborock Qrevo Edge Series",
  );
});

test("i comandi come stanno adesso, e il servizio dietro ognuno (#306)", () => {
  const robot = {
    entity: ROBOROCK,
    comandi: [
      "button.roborock_qrevo_edge_series_asp_e_lav",
      "button.roborock_qrevo_edge_series_solo_lavaggio",
      "select.roborock_qrevo_edge_series_mop_mode",
      "switch.roborock_qrevo_edge_series_child_lock",
      "input_select.mancante",
    ],
  };
  const voci = comandiDelRobot(robot, casaRoborock);
  assert.deepEqual(
    voci.map((voce) => [voce.entity.split(".")[0], voce.genere, voce.name, voce.available]),
    [
      /* Un tasto mai premuto sta su «unknown», ed e' un tasto che funziona. */
      ["button", "tasto", "Asp e lav", true],
      ["button", "tasto", "Solo lavaggio", false],
      ["select", "tendina", "Mop mode", true],
      ["switch", "interruttore", "Child lock", true],
      ["input_select", "tendina", "Mancante", false],
    ],
  );
  assert.deepEqual(voci[2].opzioni, ["standard", "deep", "deep_plus"]);
  assert.equal(voci[2].scelta, "standard");
  assert.equal(voci[3].acceso, false);
  assert.equal(voci[0].acceso, null);
  /* E la vista del robot li porta con se'. */
  assert.equal(robotView(robot, casaRoborock).comandi.length, 5);

  assert.deepEqual(comandoDelRobot(voci[0]), {
    domain: "button",
    service: "press",
    data: { entity_id: "button.roborock_qrevo_edge_series_asp_e_lav" },
  });
  assert.deepEqual(comandoDelRobot(voci[2], "deep"), {
    domain: "select",
    service: "select_option",
    data: { entity_id: "select.roborock_qrevo_edge_series_mop_mode", option: "deep" },
  });
  assert.equal(comandoDelRobot(voci[2], ""), null);
  assert.deepEqual(comandoDelRobot(voci[3]), {
    domain: "switch",
    service: "toggle",
    data: { entity_id: "switch.roborock_qrevo_edge_series_child_lock" },
  });
  assert.deepEqual(comandoDelRobot({ entity: "script.pulizia" }), {
    domain: "script",
    service: "turn_on",
    data: { entity_id: "script.pulizia" },
  });
  assert.deepEqual(comandoDelRobot({ entity: "input_button.x" }), {
    domain: "input_button",
    service: "press",
    data: { entity_id: "input_button.x" },
  });
  assert.equal(comandoDelRobot({ entity: "sensor.x" }), null);
});

test("i comandi accanto al robot si propongono, quelli gia' scelti no (#306)", () => {
  const proposte = comandiSuggeriti(
    { entity: ROBOROCK, comandi: ["button.roborock_qrevo_edge_series_asp_e_lav"] },
    casaRoborock,
  );
  /* Prima i tasti, poi le tendine, poi gli interruttori; il gia' scelto non
   * c'e'; il cancello di un'altra casa e il sensore della batteria nemmeno. */
  assert.deepEqual(proposte, [
    "button.roborock_qrevo_edge_series_pulizia_completa",
    "button.roborock_qrevo_edge_series_reset_sensor_consumable",
    "button.roborock_qrevo_edge_series_solo_aspirazione",
    "button.roborock_qrevo_edge_series_solo_lavaggio",
    "select.roborock_qrevo_edge_series_mop_mode",
    "switch.roborock_qrevo_edge_series_child_lock",
  ]);
  /* Anche quando l'id non coincide, il nome basta: e' cosi' che Home
   * Assistant chiama le entita' di uno stesso dispositivo. */
  const perNome = comandiSuggeriti(
    { entity: "vacuum.robottino" },
    {
      "vacuum.robottino": stato("docked", { friendly_name: "Piano terra" }),
      "button.qualcosa_altro": stato("unknown", { friendly_name: "Piano terra Pulizia completa" }),
      "button.pianoterra": stato("unknown", { friendly_name: "Piano terrazzo" }),
    },
  );
  assert.deepEqual(perNome, ["button.qualcosa_altro"]);
  assert.deepEqual(comandiSuggeriti({ entity: "" }, casaRoborock), []);
});

test("la scheda e la configurazione portano i comandi a parte (#306)", async () => {
  const scheda = await readFile(
    new URL("../src/sections/robot-section.js", import.meta.url),
    "utf8",
  );
  /* I tasti e gli interruttori sotto i comandi di sempre, le tendine accanto
   * all'aspirazione; l'interruttore dice se e' acceso, e chi non risponde e'
   * spento. */
  assert.match(scheda, /data-dm-robot-cmd="\$\{esc\(voce\.entity\)\}"/);
  assert.match(scheda, /aria-pressed="\$\{voce\.acceso === true\}"/);
  assert.match(scheda, /data-dm-robot-tendina="\$\{esc\(voce\.entity\)\}"/);
  assert.match(scheda, /\$\{comandiTendineMarkup\(view\)\}/);
  assert.match(scheda, /class="dm-robot-actions dm-robot-comandi" data-dm-robot-comandi/);
  /* Il tocco chiama il servizio giusto, e la tendina la sua entita'. */
  assert.match(scheda, /callService\(comandoDelRobot\(voce\)\)/);
  assert.match(scheda, /callService\(comandoDelRobot\(voce, tendina\.value\)\)/);
  /* La firma li conosce: un comando aggiunto rifa' la scheda. */
  assert.match(
    scheda,
    /\(view\.comandi \|\| \[\]\)\s*\.map\(\(voce\) => `\$\{voce\.entity\}:\$\{voce\.name\}:\$\{voce\.available\}/,
  );

  const scheda2 = await readFile(
    new URL("../src/sections/robot-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(scheda2, /data-robot-field="comandi"/);
  /* Le pastiglie: proposte col piu', scelte con la croce, e il piu' della casella. */
  assert.match(scheda2, /chipMarkup\(entity, "robot-cmd-sug", "＋", robot, states\)/);
  assert.match(scheda2, /chipMarkup\(entity, "robot-cmd-del", "✕", robot, states\)/);
  assert.match(scheda2, /data-robot-cmd-add/);
  assert.match(scheda2, /event\.target\.closest\("\[data-robot-cmd-sug\]"\)/);
  assert.match(scheda2, /event\.target\.closest\("\[data-robot-cmd-del\]"\)/);
  assert.match(scheda2, /comandiSuggeriti\(robot, states\)/);
  /* La scelta si salva subito, con quello che c'e' scritto nelle altre caselle. */
  assert.match(scheda2, /const letta = leggiRiga\(riga, robots\[index\]\);/);
  assert.match(scheda2, /next\[index\] = \{ \.\.\.letta, comandi \};/);
});

/* Il robot preso da un'integrazione.
 *
 * «Questa cosa sviluppata su elettrodomestici di gestire integrazioni presenti
 * le devi implementare anche per la sezione robot.» Un robot pero' e' fatto di
 * meno pezzi di un elettrodomestico — l'entita' che lo comanda, la mappa, la
 * batteria e i suoi programmi — e sono tutti riconoscibili da quello che
 * l'integrazione dichiara accanto: il dominio dell'entita', `device_class` per
 * la carica, la categoria per distinguere un programma da un'impostazione.
 */
import { bindRobotToDevice as legaRobot } from "../src/core/robot-model.js";

const voce = (entity_id, extra = {}) => ({
  entity_id,
  name: entity_id,
  device_class: "",
  category: "",
  disabled: false,
  ...extra,
});

test("dal dispositivo nascono l'entita', la mappa, la batteria e i programmi", () => {
  const robot = legaRobot({
    device: { id: "rb-1", name: "Roborock Qrevo Edge" },
    entities: [
      voce("vacuum.roborock_qrevo_edge"),
      voce("camera.roborock_qrevo_edge_mappa"),
      voce("sensor.roborock_qrevo_edge_batteria", { device_class: "battery" }),
      voce("button.roborock_qrevo_edge_pulizia_completa"),
      voce("select.roborock_qrevo_edge_mocio"),
      voce("switch.roborock_qrevo_edge_blocco_bambini"),
    ],
  });
  assert.equal(robot.name, "Roborock Qrevo Edge");
  assert.equal(robot.entity, "vacuum.roborock_qrevo_edge");
  assert.equal(robot.mapEntity, "camera.roborock_qrevo_edge_mappa");
  assert.equal(robot.battery, "sensor.roborock_qrevo_edge_batteria");
  /* I tasti prima delle tendine, le tendine prima degli interruttori: e'
   * l'ordine in cui si guardano su una scheda. */
  assert.deepEqual(robot.comandi, [
    "button.roborock_qrevo_edge_pulizia_completa",
    "select.roborock_qrevo_edge_mocio",
    "switch.roborock_qrevo_edge_blocco_bambini",
  ]);
});

test("le impostazioni del dispositivo non sono programmi", () => {
  /* Su un Roborock le entita' marcate `config` e `diagnostic` sono la
   * maggioranza — il volume, la soglia del wifi, l'ora del «non disturbare» —
   * e sulla scheda del robot non ci vanno: sono le impostazioni del
   * dispositivo, non i tasti che uno vuole sotto mano. */
  const robot = legaRobot({
    device: { id: "rb-1", name: "Robot" },
    entities: [
      voce("vacuum.robot"),
      voce("button.robot_pulizia_completa"),
      voce("select.robot_volume", { category: "config" }),
      voce("switch.robot_registro", { category: "diagnostic" }),
      voce("button.robot_spento", { disabled: true }),
    ],
  });
  assert.deepEqual(robot.comandi, ["button.robot_pulizia_completa"]);
});

test("un tagliaerba con la batteria a parte e senza mappa", () => {
  /* I tagliaerba pubblicano spesso la carica come sensore a parte, e la mappa
   * non ce l'hanno: le caselle che restano vuote restano vuote, e chi
   * configura le riempie a mano se vuole. */
  const robot = legaRobot({
    device: { id: "mw-1", name: "Automower 305" },
    entities: [
      voce("lawn_mower.automower_305"),
      voce("sensor.automower_305_carica", { device_class: "battery" }),
      voce("sensor.automower_305_ore", { device_class: "duration" }),
    ],
    index: 2,
  });
  assert.equal(robot.id, "robot-3");
  assert.equal(robot.entity, "lawn_mower.automower_305");
  assert.equal(robot.battery, "sensor.automower_305_carica");
  assert.equal(robot.mapEntity, "");
  assert.deepEqual(robot.comandi, []);
});

test("quello che c'era gia' non si perde", () => {
  /* «Cambia dispositivo» su un robot gia' configurato: il nome che chi
   * configura ha scritto a mano resta il suo, e la stanza pure. */
  const robot = legaRobot({
    device: { id: "rb-2", name: "Roborock S8" },
    entities: [voce("vacuum.roborock_s8")],
    precedente: { id: "robot-1", name: "Il robot di sotto", room: "room-salone" },
  });
  assert.equal(robot.id, "robot-1");
  assert.equal(robot.name, "Il robot di sotto");
  assert.equal(robot.room, "room-salone");
  assert.equal(robot.entity, "vacuum.roborock_s8");
});

/* Un robot comandato a automazioni — il caso vero di chi ha «automation.piper_*»
 * al posto dei «button» che il suo aspirapolvere non pubblica. */
test("un'automazione e' un tasto, e si fa partire invece di accendersi", () => {
  assert.equal(genereDelComando("automation.piper_pulizia"), "tasto");
  /* Il verbo e' quello che conta: «turn_on» riabilita l'automazione e lascia
   * il robot fermo, e per giunta cambia di nascosto un'impostazione di Home
   * Assistant. Chi tocca «Pulizia» vuole che parta. */
  assert.deepEqual(comandoDelRobot({ entity: "automation.piper_pulizia" }), {
    domain: "automation",
    service: "trigger",
    data: { entity_id: "automation.piper_pulizia" },
  });
  // Gli altri verbi restano quelli di prima.
  assert.equal(comandoDelRobot({ entity: "script.piper_dock" }).service, "turn_on");
  assert.equal(comandoDelRobot({ entity: "button.piper_dock" }).service, "press");
});

test("le automazioni del robot entrano nell'elenco dei comandi", () => {
  const comandi = elencoComandi([
    "automation.piper_pulizia",
    "automation.piper_pausa",
    "automation.piper_dock",
  ]);
  assert.deepEqual(comandi, [
    "automation.piper_pulizia",
    "automation.piper_pausa",
    "automation.piper_dock",
  ]);
});
