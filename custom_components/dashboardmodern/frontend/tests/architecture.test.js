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
