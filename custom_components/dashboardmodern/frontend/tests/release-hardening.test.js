import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("legacy third-party scripts are immutable and SRI protected", async () => {
  for (const file of [
    "custom_components/dashboardmodern/frontend/legacy/dashboard.html",
    "custom_components/dashboardmodern/frontend/legacy/dashboard-en.html",
  ]) {
    const source = await read(file);
    assert.match(source, /chart\.js@4\.5\.1\/dist\/chart\.umd\.min\.js/);
    assert.match(source, /panzoom@9\.4\.0\/dist\/panzoom\.min\.js/);
    assert.match(source, /hls\.js@1\.6\.17\/dist\/hls\.min\.js/);
    assert.equal((source.match(/integrity="sha384-/g) || []).length >= 3, true);
    assert.doesNotMatch(source, /hls\.js@latest|npm\/chart\.js"><\/script>/);
  }
});

test("future re-vendoring preserves the CDN integrity contract", async () => {
  const source = await read("scripts/vendor_legacy.py");
  assert.match(source, /_pin_cdn_dependencies/);
  assert.match(source, /CHART_CDN_PINNED/);
  assert.match(source, /HLS_CDN_PINNED/);
  assert.match(source, /integrity=/);
});

test("frontend registration hashes off-loop once and exposes only explicit runtime assets", async () => {
  const source = await read("custom_components/dashboardmodern/frontend.py");
  assert.match(source, /async_add_executor_job\(_frontend_asset_version\)/);
  assert.match(source, /relative_to\(FRONTEND_DIR\)\.as_posix\(\)/);
  assert.match(source, /IGNORED_RUNTIME_FILES/);
  assert.match(source, /add_extra_js_url/);
  assert.doesNotMatch(source, /DATA_EXTRA_MODULE_URL/);
});

test("build provenance is canonical and bridge message types are unique", async () => {
  const energy = await read("custom_components/dashboardmodern/frontend/src/sections/energy-section.js");
  assert.match(energy, /BUILD_INFO/);
  assert.doesNotMatch(energy, /const VERSION = ["']0\.15\.12["']/);
  const { ALLOWED_MESSAGE_TYPES } = await import("../src/legacy/bridge-socket.js");
  assert.equal(ALLOWED_MESSAGE_TYPES.length, new Set(ALLOWED_MESSAGE_TYPES).size);
});

test("Home Assistant strings use English source and installed brand ballast is absent", async () => {
  const strings = JSON.parse(await read("custom_components/dashboardmodern/strings.json"));
  assert.equal(strings.config.step.user.title, "New DashboardModern panel");
  assert.match(strings.options.step.init.data_description.allowed_users, /UI visibility filter/);
  await assert.rejects(access(new URL("custom_components/dashboardmodern/brand/icon.png", root)));
});
