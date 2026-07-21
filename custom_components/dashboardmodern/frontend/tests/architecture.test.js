import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const renderModules = ["dashboard-renderer.js", "view-renderer.js", "section-renderer.js", "card-renderer.js"];

test("renderer modules make no raw websocket, Store, Lovelace, YAML, or REST access", async () => {
  for (const module of renderModules) {
    const source = await readFile(join("custom_components/dashboardmodern/frontend/src/render", module), "utf8");
    assert.doesNotMatch(source, /sendMessagePromise|new WebSocket|fetch\(|lovelace|yaml|home assistant store|json store/i, module);
  }
});

test("frontend does not present open card config as authoritative typed card contracts", async () => {
  const source = await readFile("custom_components/dashboardmodern/frontend/src/render/card-renderer.js", "utf8");
  assert.doesNotMatch(source, /config\.(text|message|entity|entity_id)|registerCardRenderer\(["'](text|markdown|info|entity|entity_state)/);
});

test("state depends only on pure presentation selectors, not render modules", async () => {
  const source = await readFile("custom_components/dashboardmodern/frontend/src/state.js", "utf8");
  assert.doesNotMatch(source, /\.\/render\//);
  assert.match(source, /\.\/presentation\/view-selection\.js/);
});


test("editor modules make no raw websocket, Lovelace, YAML, Store, or DOM dependency", async () => {
  for (const module of ["commands.js", "editor-state.js", "editor-controller.js"]) {
    const source = await readFile(join("custom_components/dashboardmodern/frontend/src/editor", module), "utf8");
    assert.doesNotMatch(source, /sendMessagePromise|new WebSocket|fetch\(|lovelace|yaml|home assistant store|json store|querySelector|innerHTML/i, module);
  }
});

test("visual editor uses dedicated selected-node form modules", async () => {
  const source = await readFile("custom_components/dashboardmodern/frontend/src/app.js", "utf8");
  assert.match(source, /renderDashboardForm/);
  assert.match(source, /renderViewForm/);
  assert.match(source, /renderSectionForm/);
  assert.match(source, /renderCardForm/);
  for (const forbidden of [/View title.*updateView/s, /Section title.*updateSection/s, /Card title.*updateCard/s, /Card config JSON.*updateCardConfig/s]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test("Phase 9 frontend avoids legacy iframe and arbitrary persisted HTML execution shortcuts", async () => {
  for (const file of ["custom_components/dashboardmodern/frontend/src/app.js", "custom_components/dashboardmodern/frontend/src/render/card-renderer.js", "custom_components/dashboardmodern/frontend/src/cards/legacy-panel.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /iframe|srcdoc|innerHTML\s*=.*card|eval\(|new Function|insertAdjacentHTML/i, file);
  }
});

test("card plugins receive runtime context without importing websocket client or store directly", async () => {
  for (const file of ["custom_components/dashboardmodern/frontend/src/cards/legacy-panel.js", "custom_components/dashboardmodern/frontend/src/cards/registry.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /ws-client|DashboardModernStore|sendMessagePromise|new WebSocket|fetch\(/, file);
  }
  const renderer = await readFile("custom_components/dashboardmodern/frontend/src/render/dashboard-renderer.js", "utf8");
  assert.match(renderer, /createCardRuntimeContext/);
});

test("card plugins use narrow runtime capabilities and never runtime.hass", async () => {
  for (const file of ["custom_components/dashboardmodern/frontend/src/cards/legacy-panel.js", "custom_components/dashboardmodern/frontend/src/cards/registry.js"]) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /runtime\.hass|context\.hass|\.hass\b|ws-client|DashboardModernStore|sendMessagePromise|new WebSocket/, file);
  }
  const runtime = await readFile("custom_components/dashboardmodern/frontend/src/runtime/context.js", "utf8");
  assert.doesNotMatch(runtime, /return Object\.freeze\(\{\s*hass/s);
});


test("Phase 10 card plugins keep frontend boundaries", async () => {
  for (const file of ["home-summary.js", "weather.js"]) {
    const source = await readFile(join("custom_components/dashboardmodern/frontend/src/cards", file), "utf8");
    assert.doesNotMatch(source, /ws-client|store|backend|persistence|application|runtime\.hass|iframe|innerHTML|outerHTML/);
    assert.doesNotMatch(source, /<script|onerror=|onclick=/);
  }
});
