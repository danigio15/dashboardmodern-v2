import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const modules = ["dashboard-renderer.js", "view-renderer.js", "section-renderer.js", "card-renderer.js"];

test("renderer modules make no raw websocket, Lovelace, YAML, REST, or Store access", async () => {
  for (const module of modules) {
    const source = await readFile(join("custom_components/dashboardmodern/frontend/src/render", module), "utf8");
    assert.doesNotMatch(source, /sendMessagePromise|WebSocket|fetch\(|lovelace|yaml|store\b/i, module);
  }
});
