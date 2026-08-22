/* Le persone come le mette in ordine il modello puro: id stabili, ritratto
 * deciso, batteria presa da dove ha senso, zona letta come la scrive Home
 * Assistant. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  AVATAR_COLORS,
  elapsedParts,
  isPersonEntity,
  normalizePeople,
  personInitials,
  personViewModel,
  suggestPeople,
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
