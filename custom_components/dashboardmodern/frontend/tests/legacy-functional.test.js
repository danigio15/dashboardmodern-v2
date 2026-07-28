import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import DashboardModernModules from "../legacy/modules-entry.js";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const body = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = body; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

for (const [file, labels] of [
  ["dashboard.html", { overview: "Panoramica", none: "Nessuna stanza" }],
  ["dashboard-en.html", { overview: "Overview", none: "No room" }],
]) {
  const source = readFileSync(new URL(`../legacy/${file}`, import.meta.url), "utf8");

  test(`${file}: shipped renderer never uses OTHER and preserves appliance media`, () => {
    const renderer = functionSource(source, "renderAppliances");
    assert.match(renderer, /cdApplianceDisplayName/);
    assert.match(renderer, /cdApplianceVisual/);
    assert.doesNotMatch(renderer, /a\.name\|\|cdApplianceName/);
    const save = functionSource(source, "edApplSave");
    for (const key of ["image", "image_url", "type", "device_type"])
      assert.match(save, new RegExp(key));
  });

  test(`${file}: shipped climate editor has one boiler value and room editor supports mdi`, () => {
    const editor = functionSource(source, "editorRenderSezioni");
    assert.equal((editor.match(/data-ref="switch\.caldaia"/g) || []).length, 1);
    const roomStart = source.indexOf("function editorRenderStanze(");
    const rooms = source.slice(roomStart, source.indexOf("function editorRenderLuci(", roomStart));
    assert.match(rooms, /ed-room-icon-preview/);
    assert.match(rooms, /dmIconPicker/);
    assert.match(source, /function cdIconMarkup[\s\S]*mdi:/);
    const iconFilter = functionSource(source, "dmIconFilter");
    assert.match(iconFilter, /const rows = q \? DM_ICONS\.filter/);
    assert.doesNotMatch(iconFilter, /visible\.length/);
  });

  test(`${file}: camera has canonical Save and appliance page has no editor CTA`, () => {
    const editor = functionSource(source, "editorRenderSezioni");
    const cameraStart = editor.indexOf("ed-cam-room");
    const camera = editor.slice(cameraStart, cameraStart + 500);
    assert.match(camera, /class="ed-save-btn"/);
    assert.doesNotMatch(source, /<button[^>]+appl-main-config/);
    assert.doesNotMatch(source, /(?:Configura gli|Configure) entity_id/);
  });

  test(`${file}: adding an appliance reveals and synchronizes its section without reload`, () => {
    const save = functionSource(source, "edApplSave");
    const visibility = functionSource(source, "cdEnsureSectionVisible");
    assert.match(save, /cdEnsureSectionVisible\('appliances'\)/);
    assert.match(visibility, /cdMarkDirty\(\);cdSyncPush\(\)/);
    assert.match(visibility, /cdApplyNavVis\(\)/);
    assert.match(visibility, /render\(\)/);
    assert.doesNotMatch(save, /location\.reload/);
  });

  test(`${file}: every entity editor keeps a searchable picker`, () => {
    const entityInput =
      /<input[^>]+(?:placeholder="(?:sensor|switch|light|camera|climate|cover|weather)\.|data-ref=)[^>]*>/gi;
    const matches = [...source.matchAll(entityInput)];
    assert.ok(matches.length >= 25, "expected all configuration sections");
    for (const match of matches) {
      if (match[0].includes("ed-slot-in")) continue; // dynamically enriched by edFilterSez
      const around = source.slice(
        Math.max(0, match.index - 250),
        match.index + match[0].length + 700,
      );
      assert.match(around, /wzPickEntity|data-entity-target/, match[0]);
    }
  });

  test(`${file}: actual appliance renderer creates and moves room tabs`, () => {
    const host = {};
    const tabBar = { innerHTML: "" };
    const rendered = {};
    const rooms = [
      { id: "kitchen", name: "Kitchen" },
      { id: "laundry", name: "Laundry" },
      { id: "empty", name: "Empty" },
    ];
    let appliances = [
      { id: "oven", name: "Oven", room_id: "kitchen" },
      { id: "washer", name: "Washer", room_id: "laundry" },
      { id: "legacy", name: "Legacy" },
    ];
    const context = {
      DashboardModernModules,
      window: { DashboardModernModules, scrollTo() {} },
      document: {
        getElementById: (id) => (id === "appl-kpi-grid" ? host : null),
        querySelector: (selector) =>
          selector.includes("sub-tabs") ? tabBar : { id: "appl-view-overview" },
      },
      getAppliances: () => appliances,
      cdRoomList: () => rooms,
      cdApplStatus: () => ({ cls: "off", w: 0 }),
      cdApplConfiguredEntities: () => [],
      cdApplEntity: () => "",
      cdApplNum: () => 0,
      cdApplCategory: () => "other",
      cdApplMainCard: (appliance) => `<card>${appliance.name}</card>`,
      cdApplianceName: () => "Appliance",
      STATES: {},
      setHtml: (id, html) => {
        rendered[id] = html;
      },
      setTxt() {},
      Math,
    };
    vm.createContext(context);
    vm.runInContext(
      `${functionSource(source, "renderApplianceSection")};this.run=renderApplianceSection`,
      context,
    );
    context.run(true);
    assert.match(tabBar.innerHTML, new RegExp(labels.overview));
    assert.match(tabBar.innerHTML, /Kitchen/);
    assert.match(tabBar.innerHTML, /Laundry/);
    assert.doesNotMatch(tabBar.innerHTML, /Empty/);
    assert.match(tabBar.innerHTML, new RegExp(labels.none));
    context.window._dmApplRoom = "kitchen";
    context.run(true);
    assert.match(rendered["appl-grid-overview"], /Oven/);
    assert.doesNotMatch(rendered["appl-grid-overview"], /Washer/);
    appliances[0].room_id = "laundry";
    context.run(true);
    assert.doesNotMatch(rendered["appl-grid-overview"], /Oven/);
    rooms[1].name = "Utility";
    context.window._dmApplRoom = "laundry";
    context.run(true);
    assert.match(tabBar.innerHTML, /Utility/);
    assert.match(rendered["appl-grid-overview"], /Oven/);
  });

  test(`${file}: actual camera save function refreshes Security without reload`, () => {
    let stored = null;
    const calls = [];
    const grid = { _sig: "old" };
    const context = {
      localStorage: { setItem: (_key, value) => (stored = JSON.parse(value)) },
      document: { getElementById: () => grid },
      cdMarkDirty: () => calls.push("dirty"),
      cdSyncPush: () => calls.push("sync"),
      buildCamCards: () => calls.push("build"),
      refreshCameras: () => calls.push("refresh"),
      render: () => calls.push("render"),
    };
    vm.createContext(context);
    vm.runInContext(`${functionSource(source, "dmSaveCameras")};this.save=dmSaveCameras`, context);
    context.save([{ name: "Front", entity: "camera.front", stream: "front" }]);
    assert.equal(stored[0].stream, "front");
    assert.equal(grid._sig, "");
    assert.deepEqual(calls, ["dirty", "sync", "build", "refresh", "render"]);
  });

  test(`${file}: actual appliance card exposes only a safe, isolated toggle`, () => {
    const context = {
      DashboardModernModules,
      window: { DashboardModernModules },
      STATES: { "switch.oven": { state: "on", attributes: {} } },
      cdApplStatus: () => ({ cls: "on", label: "On", w: 2 }),
      cdApplCategory: () => "other",
      cdApplEntity: (appliance, keys) => keys.map((key) => appliance[key]).find(Boolean) || "",
      cdApplConfiguredEntities: () => ["switch.oven"],
      cdApplVal: () => "2 W",
      cdApplianceName: () => "Appliance",
      cdApplianceIcon: () => "icon",
      cdApplianceVisual: () => "icon",
    };
    vm.createContext(context);
    vm.runInContext(
      `${functionSource(source, "cdApplMainCard")};this.card=cdApplMainCard`,
      context,
    );
    const controlled = context.card({ name: "Oven", switch_entity: "switch.oven" });
    assert.match(controlled, /cdApplEntTog\('switch\.oven',this\)/);
    assert.match(controlled, /event\.stopPropagation\(\)/);
    assert.match(controlled, /class="appl-action-btn on"/);
    const sensorOnly = context.card({ name: "Meter", entities: ["sensor.meter_power"] });
    assert.doesNotMatch(sensorOnly, /cdApplEntTog/);
  });

  test(`${file}: actual camera editor completes add, edit and delete`, () => {
    let cameras = [];
    const fields = Object.fromEntries(
      ["ed-cam-name", "ed-cam-ent", "ed-cam-stream", "ed-cam-room"].map((id) => [
        id,
        { value: "" },
      ]),
    );
    const saved = [];
    const context = {
      document: { getElementById: (id) => fields[id] },
      getCameras: () => cameras,
      dmSaveCameras: (next) => {
        cameras = structuredClone(next);
        saved.push(structuredClone(next));
      },
      editorSwitch() {},
      edToast() {},
      alert(message) {
        throw new Error(message);
      },
      Date,
    };
    vm.createContext(context);
    vm.runInContext(
      `let _dmCameraEditIndex=null;${functionSource(source, "edEditCamera")};${functionSource(source, "edAddCamera")};${functionSource(source, "edDelCamera")};this.add=edAddCamera;this.edit=edEditCamera;this.del=edDelCamera`,
      context,
    );
    Object.assign(fields["ed-cam-name"], { value: "Front" });
    Object.assign(fields["ed-cam-ent"], { value: "camera.front" });
    Object.assign(fields["ed-cam-stream"], { value: "front-stream" });
    Object.assign(fields["ed-cam-room"], { value: "outside" });
    context.add();
    assert.equal(cameras[0].name, "Front");
    assert.equal(cameras[0].stream, "front-stream");
    context.edit(0);
    fields["ed-cam-name"].value = "Gate";
    fields["ed-cam-stream"].value = "gate-stream";
    context.add();
    assert.equal(cameras.length, 1);
    assert.equal(cameras[0].name, "Gate");
    assert.equal(cameras[0].stream, "gate-stream");
    context.del(0);
    assert.equal(cameras.length, 0);
    assert.equal(saved.length, 3);
  });

  test(`${file}: actual energy totals fallback yields daily/monthly and preserves explicit sensors`, () => {
    const context = {
      window: {
        _cdStatMonthly: 10,
        _cdStatDaily: 11,
        _cdStatJobs: [
          {
            real: "sensor.total",
            targets: { day: "sensor.day", month: "sensor.month", year: "sensor.year" },
          },
        ],
      },
      ENTITY_OVERRIDES: {},
      _RAW_STATES: {},
      render() {},
      console,
      Math,
    };
    vm.createContext(context);
    const energyFunctions = source.slice(
      source.indexOf("function cdTotalsInject("),
      source.indexOf("function cdSyncPush("),
    );
    vm.runInContext(`${energyFunctions};this.handle=cdTotalsHandle`, context);
    assert.equal(
      context.handle({
        id: 10,
        result: { "sensor.total": [{ change: 20 }, { change: 7 }] },
      }),
      true,
    );
    assert.equal(context._RAW_STATES["sensor.month"].state, "7");
    assert.equal(context._RAW_STATES["sensor.year"].state, "27");
    assert.equal(
      context.handle({
        id: 11,
        result: { "sensor.total": [{ change: 1.2 }, { change: 2.3 }] },
      }),
      true,
    );
    assert.equal(context._RAW_STATES["sensor.day"].state, "3.5");
    context.ENTITY_OVERRIDES["sensor.day"] = "sensor.explicit_day";
    context._RAW_STATES["sensor.day"].state = "99";
    context.handle({ id: 11, result: { "sensor.total": [{ change: 4 }] } });
    assert.equal(context._RAW_STATES["sensor.day"].state, "99");
  });
}
