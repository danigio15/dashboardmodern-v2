// DM-FIX-20260817D
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/sections/climate-thermal-section.js", import.meta.url),
  "utf8",
);

async function loadSection() {
  return import(`../src/sections/climate-thermal-section.js?fix=${Date.now()}`);
}

test("a unit lands in the heating zone only when its type says so", async () => {
  const { climateZone } = await loadSection();
  assert.equal(climateZone({ type: "clima" }), "freddo");
  assert.equal(climateZone({ type: "termo" }), "caldo");
  assert.equal(climateZone({ type: "Termostato" }), "caldo");
  assert.equal(climateZone({ type: "heat" }), "caldo");
  assert.equal(climateZone({}), "freddo");
});

test("a heat pump lives in both zones, everything else in exactly one", async () => {
  const { climateZones } = await loadSection();
  assert.deepEqual(climateZones({ type: "clima" }), ["freddo"]);
  assert.deepEqual(climateZones({ type: "termo" }), ["caldo"]);
  assert.deepEqual(climateZones({ type: "pompa" }), ["freddo", "caldo"]);
  assert.deepEqual(climateZones({ type: "heat_pump" }), ["freddo", "caldo"]);
});

test("a heat pump gets one card per zone without duplicating the legacy id", async () => {
  const { climateUnits } = await loadSection();
  const previous = globalThis.getClimaUnits;
  try {
    globalThis.getClimaUnits = () => [
      { entity: "climate.studio", name: "Studio", type: "pompa" },
    ];
    const units = climateUnits();
    assert.equal(units.length, 2);
    // The legacy id stays on the first card: cdAutoHide() looks it up by name.
    assert.equal(units[0].cardId, "card-climate-studio");
    assert.equal(units[0].zone, "freddo");
    assert.equal(units[1].cardId, "card-climate-studio--caldo");
    assert.equal(units[1].zone, "caldo");
    assert.equal(units[0].entity, units[1].entity);
  } finally {
    if (previous === undefined) delete globalThis.getClimaUnits;
    else globalThis.getClimaUnits = previous;
  }
});

test("configured units are read through the legacy list and keep the legacy card ids", async () => {
  const { climateUnits } = await loadSection();
  const previous = globalThis.getClimaUnits;
  try {
    globalThis.getClimaUnits = () => [
      { entity: "climate.salone", name: "Salone", room: "Salone", type: "clima" },
      { entity: "climate.bagno", name: "Bagno", type: "termo" },
      { name: "senza entità" },
    ];
    const units = climateUnits();
    assert.equal(units.length, 2);
    // The legacy runtime and every caller look the card up by this id.
    assert.equal(units[0].cardId, "card-climate-salone");
    assert.equal(units[0].zone, "freddo");
    assert.equal(units[1].cardId, "card-climate-bagno");
    assert.equal(units[1].zone, "caldo");
  } finally {
    if (previous === undefined) delete globalThis.getClimaUnits;
    else globalThis.getClimaUnits = previous;
  }
});

test("a unit counts as running unless Home Assistant reports it off or unreachable", async () => {
  const { climateReading } = await loadSection();
  const states = {
    "climate.a": { state: "cool", attributes: { temperature: 24, current_temperature: 26.4 } },
    "climate.b": { state: "off", attributes: { temperature: 25 } },
    "climate.c": { state: "unavailable", attributes: {} },
    "climate.d": { state: "fan_only", attributes: { fan_mode: "medium" } },
  };
  assert.equal(climateReading("climate.a", states).on, true);
  assert.equal(climateReading("climate.a", states).target, 24);
  assert.equal(climateReading("climate.a", states).ambient, 26.4);
  assert.equal(climateReading("climate.b", states).on, false);
  assert.equal(climateReading("climate.c", states).on, false);
  assert.equal(climateReading("climate.d", states).fan, "medium");
  // An entity Home Assistant never sent is not "off", it is unknown: the bulk
  // switch must skip it instead of firing a service call into the void.
  assert.equal(climateReading("climate.missing", states).known, false);
});

test("a missing temperature never becomes a number on the rail", async () => {
  const { climateReading } = await loadSection();
  const reading = climateReading("climate.x", {
    "climate.x": { state: "heat", attributes: { current_temperature: "n/a" } },
  });
  assert.equal(reading.target, null);
  assert.equal(reading.ambient, null);
});

test("the sparkline needs real history before it draws anything", async () => {
  const { filoFraMinimoEMassimo: sparklinePath } = await loadSection();
  assert.equal(sparklinePath([]), null);
  assert.equal(sparklinePath([21.4, 21.5]), null);
  const path = sparklinePath([21, 21.6, 22.2, 22]);
  assert.ok(path.line.startsWith("M"));
  assert.ok(path.area.endsWith("Z"));
  // A flat series must not divide by a zero span.
  const flat = sparklinePath([20, 20, 20, 20]);
  assert.ok(Number.isFinite(flat.end[1]));
});

test("the page keeps every hook the legacy climate runtime writes into", () => {
  for (const hook of [
    'id="clima-grid-freddo"',
    'id="clima-grid-caldo"',
    'id="clima-page-mode-${cold ? "freddo" : "caldo"}"',
    "clima-page-mode-switch",
    "clima-page-mode-btn",
    "clima-zone clima-zone-freddo show",
    "clima-zone clima-zone-caldo",
    "card-${entity.replaceAll",
  ])
    assert.ok(source.includes(hook), hook);
  // Zone switching, the service calls and the HVAC/fan popup stay legacy.
  assert.match(source, /setClimaPageMode\('\$\{zone\}'\)/);
  assert.match(source, /setTemp\('\$\{entity\}', 'down'\)/);
  assert.match(source, /setTemp\('\$\{entity\}', 'up'\)/);
  // The card also says which tab it lives in, so a heat pump switched on from
  // the Caldo tab starts heating instead of resuming its last mode.
  assert.match(source, /toggleClima\('\$\{entity\}', '\$\{unit\.zone\}'\)/);
  // The card itself keeps an onclick carrying the entity, which is what
  // cdAutoHide() reads to hide units the user never mapped.
  assert.match(source, /onclick="apriClimaPopup\('\$\{entity\}', event\)"/);
});

test("HVAC and fan modes are one click away from the card", () => {
  // The request that drove this redesign: a visible control that opens the
  // HVAC/fan panel instead of hiding it behind a tap on the card body.
  assert.match(source, /class="dm-cl-modes"/);
  assert.match(source, /event\.stopPropagation\(\); apriClimaPopup\('\$\{entity\}'\)/);
  // The button reads the active mode, so it says "Freddo · Auto" and not just "Modalità".
  assert.match(source, /data-dm-cl-mode-cap/);
  assert.match(source, /function modeCaption/);
});

test("plus and minus move by a whole degree, in the popup too", async () => {
  const { wholeDegreeDelta } = await loadSection();
  // The card already steps by one through setTemp(); the legacy popup markup
  // still asks for half a degree, so the delta is corrected on the way in.
  assert.equal(24 + wholeDegreeDelta(24, 0.5), 25);
  assert.equal(24 + wholeDegreeDelta(24, -0.5), 23);
  // A unit parked on a half degree walks to the next whole one, not past it.
  assert.equal(23.5 + wholeDegreeDelta(23.5, 0.5), 24);
  assert.equal(23.5 + wholeDegreeDelta(23.5, -0.5), 23);
  // Nothing readable on screen still moves by one.
  assert.equal(wholeDegreeDelta(NaN, -0.5), -1);
  assert.equal(wholeDegreeDelta(undefined, 0.5), 1);
  assert.match(source, /root\.cpSetTemp = cpSetTempThermal/);
});

test("the redesigned card drops the legacy class names the old layers fight over", () => {
  // Beta 4, Beta 7, Beta 16 and personalization all ship !important corrections
  // for these names. The new markup must not carry them, otherwise the page is
  // back to five stylesheets arguing about one card.
  const markup = source.slice(source.indexOf("function cardMarkup"), source.indexOf("function floorOf"));
  for (const legacy of ["cp-card", "cp-header", "cp-body", "cp-controls", "cp-btn", "clima-premium-grid"])
    assert.ok(!markup.includes(legacy), legacy);
});

test("the back arrow stays at the top of the page after a rebuild", () => {
  assert.match(source, /:scope > \.back-home-btn/);
  assert.match(source, /host\.insertBefore\(backButton, host\.firstChild\)/);
});

test("the section owns presentation only and adds no polling", () => {
  const body = source.slice(source.indexOf("import {"));
  assert.doesNotMatch(body, /setInterval\s*\(/);
  assert.doesNotMatch(body, /MutationObserver/);
  // No service call is rebuilt here: the websocket stays behind the legacy API.
  assert.doesNotMatch(body, /call_service/);
  assert.doesNotMatch(body, /new\s+WebSocket/);
});

test("bulk power acts on the visible zone only and skips units already in that state", () => {
  assert.match(source, /function bulkSwitch/);
  assert.match(source, /if \(unit\.zone !== zone\) continue;/);
  assert.match(source, /if \(!reading\.known \|\| reading\.on === wantsOn\) continue;/);
  assert.match(source, /root\.toggleClima\(unit\.entity, zone\)/);
});

/* ── le stanze, quando distinguono qualcosa (#261) ─────────────────────────
 *
 * «Ho sette termosifoni con valvola smart, ognuna con una o piu' entita'
 * VTherm: almeno si raddoppiano, quattordici o piu' da mostrare. Poterle
 * raggruppare per stanza aiuta a organizzare il contenuto.» */

test("le stanze si intitolano quando almeno una tiene piu' di un'unità", async () => {
  const { stanzeDaIntitolare } = await loadSection();
  /* Il caso della segnalazione: valvola e VTherm nella stessa stanza. */
  assert.equal(
    stanzeDaIntitolare([
      { room: "Salone" },
      { room: "Salone" },
      { room: "Cucina" },
    ]),
    true,
  );
  /* Un'unita' per stanza no: il titolo direbbe quello che la carta dice gia',
   * e raddoppierebbe l'altezza dell'elenco senza aggiungere niente. */
  assert.equal(stanzeDaIntitolare([{ room: "Salone" }, { room: "Cucina" }]), false);
  // Le unita' senza stanza non fanno gruppo, e non contano fra loro.
  assert.equal(stanzeDaIntitolare([{ room: "" }, { room: "" }, { room: "Salone" }]), false);
  assert.equal(stanzeDaIntitolare([]), false);
  assert.equal(stanzeDaIntitolare(null), false);
});

test("il titolo della stanza sta dentro il piano, sotto il suo", () => {
  /* Il piano apre il capitolo, la stanza dice dove finisce una e comincia
   * l'altra: due gradini, non due titoli uguali. */
  assert.match(source, /<div class="dm-cl-room">/);
  assert.match(source, /\.dm-cl-room\{/);
  // E la stanza non stampa il filo del piano: separa i piani, non le stanze.
  assert.doesNotMatch(source, /\.dm-cl-room::after\{content:""/);
});
