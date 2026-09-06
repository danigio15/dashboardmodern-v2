/* La scheda del televisore dice quello che dice il suo lettore (#354).
 *
 * «La TV e' accesa e risulta dall'integrazione sotto in basso allo
 * screenshot, ma risulta spenta nella scheda. E' possibile associare le due
 * cose in modo che lo stato sia coerente?» L'integrazione di una TV LG porta
 * un `media_player` e un `remote`: nessun sensore di stato, nessun
 * interruttore. Il collegamento non riempiva niente, e la card — che legge lo
 * stato con il vocabolario delle lavatrici — diceva SPENTO a televisore
 * acceso. Qui si tiene fermo che il lettore E' lo stato del dispositivo, che
 * la card lo traduce nella lingua dei lettori, e che il tasto della card lo
 * accende e lo spegne.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { modoDelLettore } from "../src/core/media-player.js";
import { createApplianceViewModel } from "../src/core/appliance-view-model.js";
import { bindApplianceToDevice, proposeRoles } from "../src/core/appliance-device-binding.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  name,
  device_id: "tv-1",
  platform: "webostv",
  translation_key: "",
  device_class: "",
  unit: "",
  state_class: "",
  category: "",
  disabled: false,
  ...extra,
});

/* Quello che l'integrazione LG webOS porta davvero. */
const LG = [ent("media_player.tv_salotto", "TV Salotto"), ent("remote.tv_salotto", "TV Salotto")];

const stati = (statoDelLettore) => ({
  "media_player.tv_salotto": {
    state: statoDelLettore,
    attributes: { friendly_name: "TV Salotto", supported_features: 152461 },
  },
  "remote.tv_salotto": { state: statoDelLettore === "off" ? "off" : "on", attributes: {} },
});

test("lo stato di un lettore, nelle tre parole della card", () => {
  for (const acceso of ["on", "playing", "paused", "idle", "buffering", "ON", " playing "])
    assert.equal(modoDelLettore(acceso), "running", acceso);
  assert.equal(modoDelLettore("standby"), "standby");
  assert.equal(modoDelLettore("off"), "off");
  /* Chi non risponde non decide: restano i watt, se ci sono. */
  assert.equal(modoDelLettore("unavailable"), "");
  assert.equal(modoDelLettore("unknown"), "");
  assert.equal(modoDelLettore(""), "");
  assert.equal(modoDelLettore(null), "");
});

test("il collegamento prende il lettore come stato, e come tasto", () => {
  const proposta = proposeRoles(LG, stati("on"), { type: "tv", deviceName: "TV Salotto" });
  assert.equal(proposta.state_entity, "media_player.tv_salotto");
  /* Non c'e' un interruttore: il lettore fa anche quello, perche'
   * `media_player.turn_on` e `turn_off` esistono e non c'e' altro da premere. */
  assert.equal(proposta.control_entity, "media_player.tv_salotto");
  /* Un interruttore vero, se c'e', resta il tasto: il lettore resta lo stato. */
  const conPresa = proposeRoles(
    [...LG, ent("switch.presa_tv", "TV Salotto")],
    { ...stati("on"), "switch.presa_tv": { state: "on", attributes: {} } },
    { type: "tv", deviceName: "TV Salotto" },
  );
  assert.equal(conPresa.state_entity, "media_player.tv_salotto");
  assert.equal(conPresa.control_entity, "switch.presa_tv");
});

test("dal dispositivo LG nasce una TV che sa dire se e' accesa", () => {
  const { appliance, filled } = bindApplianceToDevice(
    {},
    {
      device: { id: "tv-1", name: "TV Salotto", manufacturer: "LG", model: "OLED55C4" },
      entities: LG,
      integration: { domain: "webostv", name: "LG webOS TV" },
      states: stati("on"),
    },
  );
  assert.equal(appliance.visual_key, "tv");
  assert.equal(appliance.state_entity, "media_player.tv_salotto");
  assert.equal(appliance.control_entity, "media_player.tv_salotto");
  assert.ok(filled.includes("state_entity"));
  assert.ok(appliance.entities.includes("media_player.tv_salotto"));
});

test("la card dice IN FUNZIONE quando il lettore e' acceso, SPENTO quando e' spento", () => {
  const tv = {
    id: "tv-1",
    name: "TV Salotto",
    visual_key: "tv",
    state_entity: "media_player.tv_salotto",
    control_entity: "media_player.tv_salotto",
    entities: ["media_player.tv_salotto"],
  };
  const acceso = createApplianceViewModel(tv, stati("on"));
  assert.equal(acceso.mode, "running");
  assert.equal(acceso.label, "IN FUNZIONE");
  const suona = createApplianceViewModel(tv, stati("playing"));
  assert.equal(suona.mode, "running");
  const inPausa = createApplianceViewModel(tv, stati("paused"));
  assert.equal(inPausa.mode, "running");
  const aRiposo = createApplianceViewModel(tv, stati("standby"));
  assert.equal(aRiposo.mode, "standby");
  const spento = createApplianceViewModel(tv, stati("off"));
  assert.equal(spento.mode, "off");
  assert.equal(spento.label, "SPENTO");
  const muto = createApplianceViewModel(tv, stati("unavailable"));
  assert.equal(muto.mode, "unavailable");
});

test("il tasto della card accende e spegne il lettore col servizio giusto", () => {
  const tv = {
    id: "tv-1",
    name: "TV Salotto",
    state_entity: "media_player.tv_salotto",
    control_entity: "media_player.tv_salotto",
    entities: ["media_player.tv_salotto"],
  };
  const acceso = createApplianceViewModel(tv, stati("playing"));
  assert.equal(acceso.controlEntity, "media_player.tv_salotto");
  assert.equal(acceso.action.visible, true);
  assert.equal(acceso.action.pressed, true);
  assert.equal(acceso.action.service, "turn_off");
  const spento = createApplianceViewModel(tv, stati("off"));
  assert.equal(spento.action.pressed, false);
  assert.equal(spento.action.service, "turn_on");
});

test("una lavatrice non cambia lettura: le parole dei programmi restano le sue", () => {
  const lavatrice = {
    id: "wm-1",
    name: "Lavatrice",
    state_entity: "sensor.lavatrice_machine_status",
    control_entity: "switch.lavatrice_wash",
    entities: ["sensor.lavatrice_machine_status", "switch.lavatrice_wash"],
  };
  const lava = createApplianceViewModel(lavatrice, {
    "sensor.lavatrice_machine_status": { state: "washing", attributes: {} },
    "switch.lavatrice_wash": { state: "on", attributes: {} },
  });
  assert.equal(lava.mode, "running");
  /* «idle» per una lavatrice e' ferma, per un lettore e' acceso: due lingue. */
  const ferma = createApplianceViewModel(lavatrice, {
    "sensor.lavatrice_machine_status": { state: "idle", attributes: {} },
    "switch.lavatrice_wash": { state: "off", attributes: {} },
  });
  assert.equal(ferma.mode, "off");
});
