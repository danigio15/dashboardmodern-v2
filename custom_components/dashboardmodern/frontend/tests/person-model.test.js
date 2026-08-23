/* Le persone come le mette in ordine il modello puro: id stabili, ritratto
 * deciso, batteria presa da dove ha senso, zona letta come la scrive Home
 * Assistant. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  AVATAR_COLORS,
  activityKey,
  detectCompanionSensors,
  directionKey,
  distanceParts,
  elapsedParts,
  isCharging,
  isPersonEntity,
  normalizePeople,
  personInitials,
  personViewModel,
  suggestPeople,
  travelMinutes,
} from "../src/core/person-model.js";

test("normalizePeople scarta il vuoto e inventa id stabili e unici", () => {
  const people = normalizePeople([
    { name: "Giovanni", entity: "person.giovanni" },
    { name: "Giovanni" },
    {},
    null,
    { entity: "person.anna" },
  ]);
  assert.equal(people.length, 3);
  assert.equal(people[0].id, "person-giovanni");
  assert.equal(people[1].id, "person-giovanni-2", "stesso seme, id diverso");
  assert.equal(people[2].id, "person-anna", "senza nome, il seme viene dall'entità");
  assert.ok(people.every((person) => AVATAR_COLORS.includes(person.avatar.color)));
});

test("l'id scritto sopravvive alla normalizzazione", () => {
  const [person] = normalizePeople([{ id: "person-mio", name: "Mia" }]);
  assert.equal(person.id, "person-mio");
});

test("un colore fuori tavolozza torna a uno della tavolozza", () => {
  const [person] = normalizePeople([{ name: "Mia", avatar: { color: "#000000" } }]);
  assert.ok(AVATAR_COLORS.includes(person.avatar.color));
});

test("le iniziali sono al massimo due lettere", () => {
  assert.equal(personInitials("Giovanni Daniello"), "GD");
  assert.equal(personInitials("anna"), "A");
  assert.equal(personInitials("Maria Rosa Bianchi"), "MR");
  assert.equal(personInitials(""), "?");
});

test("solo person.* e device_tracker.* raccontano dove sta una persona", () => {
  assert.ok(isPersonEntity("person.giovanni"));
  assert.ok(isPersonEntity("device_tracker.telefono"));
  assert.equal(isPersonEntity("sensor.telefono_battery"), false);
});

test("il tempo trascorso usa l'unità più grande che abbia valore 1", () => {
  const now = Date.parse("2026-08-22T12:00:00Z");
  assert.deepEqual(elapsedParts(now - 30 * 1000, now), { unit: "now", value: 0 });
  assert.deepEqual(elapsedParts(now - 5 * 60 * 1000, now), { unit: "minute", value: 5 });
  assert.deepEqual(elapsedParts(now - 16 * 60 * 60 * 1000, now), { unit: "hour", value: 16 });
  assert.deepEqual(elapsedParts(now - 49 * 60 * 60 * 1000, now), { unit: "day", value: 2 });
  assert.equal(elapsedParts(Number.NaN, now), null);
});

const NOW = Date.parse("2026-08-22T12:00:00Z");

function stati() {
  return {
    "person.giovanni": {
      state: "home",
      last_changed: "2026-08-21T20:00:00Z",
      attributes: {
        friendly_name: "Giovanni",
        entity_picture: "/api/image/serve/abc/512x512",
        source: "device_tracker.iphone",
      },
    },
    "device_tracker.iphone": { state: "home", attributes: { battery_level: 47 } },
    "sensor.iphone_batt": { state: "82" },
  };
}

test("a casa: zona, anello e «da quanto» vengono dallo stato della persona", () => {
  const [person] = normalizePeople([{ name: "Giovanni", entity: "person.giovanni" }]);
  const view = personViewModel(person, stati(), NOW);
  assert.equal(view.presence, "home");
  assert.equal(view.known, true);
  assert.deepEqual(view.elapsed, { unit: "hour", value: 16 });
});

test("una zona con un nome è informazione, non un modo di dire fuori", () => {
  const states = stati();
  states["person.giovanni"].state = "Ufficio";
  const [person] = normalizePeople([{ name: "Giovanni", entity: "person.giovanni" }]);
  const view = personViewModel(person, states, NOW);
  assert.equal(view.presence, "zone");
  assert.equal(view.zone, "Ufficio");
});

test("not_home e unavailable sono fuori, ma unavailable non è conosciuto", () => {
  const states = stati();
  states["person.giovanni"].state = "not_home";
  const [person] = normalizePeople([{ name: "Giovanni", entity: "person.giovanni" }]);
  assert.equal(personViewModel(person, states, NOW).presence, "away");
  assert.equal(personViewModel(person, states, NOW).known, true);
  states["person.giovanni"].state = "unavailable";
  const ignoto = personViewModel(person, states, NOW);
  assert.equal(ignoto.known, false);
  assert.equal(ignoto.elapsed, null, "di un ignoto non si racconta il tempo");
});

test("la batteria: il sensore dichiarato vince, poi l'entità, poi il telefono che la traccia", () => {
  const states = stati();
  const [dichiarata] = normalizePeople([
    { name: "G", entity: "person.giovanni", battery: "sensor.iphone_batt" },
  ]);
  assert.equal(personViewModel(dichiarata, states, NOW).battery, 82);

  const [implicita] = normalizePeople([{ name: "G", entity: "person.giovanni" }]);
  assert.equal(personViewModel(implicita, states, NOW).battery, 47, "dal device_tracker sorgente");

  states["person.giovanni"].attributes.battery_level = 12;
  const view = personViewModel(implicita, states, NOW);
  assert.equal(view.battery, 12, "l'attributo dell'entità viene prima della sorgente");
  assert.equal(view.batteryLow, true);
});

test("un sensore dichiarato ma muto non fa ripiegare su altro", () => {
  const states = stati();
  delete states["sensor.iphone_batt"];
  const [person] = normalizePeople([
    { name: "G", entity: "person.giovanni", battery: "sensor.iphone_batt" },
  ]);
  assert.equal(personViewModel(person, states, NOW).battery, null);
});

test("la foto configurata vince sulla foto del profilo Home Assistant", () => {
  const states = stati();
  const [conFoto] = normalizePeople([
    { name: "G", entity: "person.giovanni", photo: "/local/giovanni.png" },
  ]);
  assert.equal(personViewModel(conFoto, states, NOW).photo, "/local/giovanni.png");
  const [senzaFoto] = normalizePeople([{ name: "G", entity: "person.giovanni" }]);
  assert.equal(personViewModel(senzaFoto, states, NOW).photo, "/api/image/serve/abc/512x512");
});

test("«in carica» capisce le parole di Android e di iOS", () => {
  for (const stato of ["charging", "Charging", "full", "ac", "usb", "wireless"])
    assert.equal(isCharging(stato), true, stato);
  for (const stato of ["discharging", "not_charging", "Not Charging", "unknown", ""])
    assert.equal(isCharging(stato), false, stato);
});

test("la distanza si scrive corta, e i metri diventano chilometri quando serve", () => {
  assert.deepEqual(distanceParts({ state: "3.44", attributes: { unit_of_measurement: "km" } }), { value: 3.4, unit: "km" });
  assert.deepEqual(distanceParts({ state: "850", attributes: { unit_of_measurement: "m" } }), { value: 850, unit: "m" });
  assert.deepEqual(distanceParts({ state: "12400", attributes: { unit_of_measurement: "m" } }), { value: 12.4, unit: "km" });
  assert.equal(distanceParts({ state: "not set" }), null);
  assert.equal(distanceParts({ state: "unknown" }), null);
});

test("il tempo di rientro sono minuti tondi, o niente", () => {
  assert.equal(travelMinutes({ state: "12.4" }), 12);
  assert.equal(travelMinutes({ state: "unavailable" }), null);
  assert.equal(travelMinutes(undefined), null);
});

test("la direzione racconta solo un movimento vero", () => {
  assert.equal(directionKey({ state: "towards" }), "towards");
  assert.equal(directionKey({ state: "away_from" }), "away");
  assert.equal(directionKey({ state: "stationary" }), "");
  assert.equal(directionKey({ state: "arrived" }), "");
});

test("l'attivita' si riduce alle cinque disegnabili", () => {
  assert.equal(activityKey({ state: "Automotive" }), "automotive");
  assert.equal(activityKey({ state: "in_vehicle" }), "automotive");
  assert.equal(activityKey({ state: "Walking" }), "walking");
  assert.equal(activityKey({ state: "Stationary" }), "still");
  assert.equal(activityKey({ state: "boh" }), "");
});

test("il rilevamento trova i sensori della Companion App dal tracker della persona", () => {
  const states = {
    "person.anna": {
      state: "home",
      attributes: { source: "device_tracker.iphone_di_anna" },
    },
    "sensor.iphone_di_anna_battery_level": { state: "80" },
    "sensor.iphone_di_anna_battery_state": { state: "charging" },
    "sensor.iphone_di_anna_geocoded_location": { state: "Via Roma 1" },
    "sensor.iphone_di_anna_activity": { state: "walking" },
    "sensor.iphone_di_anna_wifi_connection": { state: "CasaNet" },
    "sensor.waze_iphone_di_anna_travel_time": { state: "12" },
    "sensor.home_iphone_di_anna_distance": { state: "3200" },
    "sensor.home_iphone_di_anna_direction_of_travel": { state: "towards" },
    "sensor.watch_di_anna_battery": { state: "60" },
    "sensor.altro_battery_level": { state: "10" },
  };
  const found = detectCompanionSensors(states, "person.anna");
  assert.equal(found.battery, "sensor.iphone_di_anna_battery_level");
  assert.equal(found.batteryState, "sensor.iphone_di_anna_battery_state");
  assert.equal(found.address, "sensor.iphone_di_anna_geocoded_location");
  assert.equal(found.activity, "sensor.iphone_di_anna_activity");
  assert.equal(found.wifi, "sensor.iphone_di_anna_wifi_connection");
  assert.equal(found.travel, "sensor.waze_iphone_di_anna_travel_time");
  assert.equal(found.distance, "sensor.home_iphone_di_anna_distance");
  assert.equal(found.direction, "sensor.home_iphone_di_anna_direction_of_travel");
});

test("il viaggio si racconta solo di chi e' fuori", () => {
  const base = {
    "person.g": {
      state: "Lavoro",
      last_changed: "2026-08-22T11:00:00Z",
      attributes: { friendly_name: "G" },
    },
    "sensor.dist": { state: "5.5", attributes: { unit_of_measurement: "km" } },
    "sensor.waze": { state: "18" },
    "sensor.dir": { state: "towards" },
    "sensor.geo": { state: "Via Milano 4" },
    "sensor.act": { state: "automotive" },
    "sensor.batt_state": { state: "charging" },
    "sensor.watch": { state: "64" },
    "sensor.wifi": { state: "<not connected>" },
  };
  const [person] = normalizePeople([
    {
      name: "G",
      entity: "person.g",
      batteryState: "sensor.batt_state",
      watch: "sensor.watch",
      distance: "sensor.dist",
      travel: "sensor.waze",
      direction: "sensor.dir",
      address: "sensor.geo",
      activity: "sensor.act",
      wifi: "sensor.wifi",
    },
  ]);
  const fuori = personViewModel(person, base, NOW);
  assert.deepEqual(fuori.distance, { value: 5.5, unit: "km" });
  assert.equal(fuori.travel, 18);
  assert.equal(fuori.direction, "towards");
  assert.equal(fuori.address, "Via Milano 4");
  assert.equal(fuori.activity, "automotive");
  assert.equal(fuori.charging, true);
  assert.equal(fuori.watch, 64);
  assert.equal(fuori.wifi, "", "un WiFi non collegato non si scrive");

  const aCasa = personViewModel(
    person,
    { ...base, "person.g": { ...base["person.g"], state: "home" } },
    NOW,
  );
  assert.equal(aCasa.distance, null);
  assert.equal(aCasa.travel, null);
  assert.equal(aCasa.address, "");
  assert.equal(aCasa.activity, "");
  assert.equal(aCasa.charging, true, "la carica si mostra anche a casa");
});

test("l'importazione propone solo le person.* non ancora in elenco", () => {
  const states = stati();
  states["person.anna"] = {
    state: "home",
    attributes: { friendly_name: "Anna", entity_picture: "/api/image/serve/anna/512x512" },
  };
  const existing = normalizePeople([{ name: "Giovanni", entity: "person.giovanni" }]);
  const nuove = suggestPeople(states, existing);
  assert.deepEqual(nuove, [
    { entity: "person.anna", name: "Anna", photo: "/api/image/serve/anna/512x512" },
  ]);
});
