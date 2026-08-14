from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"expected snippet not found in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


# ---- Temperature: canonical model keeps optional display labels. ----
migrations = "custom_components/dashboardmodern/frontend/src/core/migrations.js"
replace_once(
    migrations,
    '      temp: String(room.temp || room.temperature_entity || ""),\n      hum: String(room.hum || room.humidity_entity || ""),\n      rgb: room.rgb || "",',
    '      temp: String(room.temp || room.temperature_entity || ""),\n      hum: String(room.hum || room.humidity_entity || ""),\n      temp_name: String(room.temp_name || room.temperature_name || ""),\n      hum_name: String(room.hum_name || room.humidity_name || ""),\n      rgb: room.rgb || "",',
)

temperature = "custom_components/dashboardmodern/frontend/src/sections/temperature-section.js"
replace_once(
    temperature,
    '        clean(room.temp),\n        roomHumidity(room),\n      ].join("|"),',
    '        clean(room.temp),\n        roomHumidity(room),\n        clean(room.temp_name || room.temperature_name),\n        clean(room.hum_name || room.humidity_name),\n      ].join("|"),',
)
replace_once(
    temperature,
    '''  const name = doc.createElement("div");
  name.className = "cp-name temp-room-name";
  name.textContent = clean(room.name) || (english() ? "Room" : "Stanza");
  title.append(icon, name);''',
    '''  const roomCopy = doc.createElement("div");
  roomCopy.className = "dm-temperature-room-copy";
  const name = doc.createElement("div");
  name.className = "cp-name temp-room-name";
  name.textContent = clean(room.name) || (english() ? "Room" : "Stanza");
  const entityName = doc.createElement("small");
  entityName.className = "temp-room-entity-name";
  roomCopy.append(name, entityName);
  title.append(icon, roomCopy);''',
)
replace_once(
    temperature,
    '  const name = card.querySelector(".cp-name,.temp-room-name");\n',
    '  const name = card.querySelector(".cp-name,.temp-room-name");\n  const entityName = card.querySelector(".temp-room-entity-name");\n',
)
replace_once(
    temperature,
    '  if (name) name.textContent = clean(room.name) || (english() ? "Room" : "Stanza");\n}',
    '''  if (name) name.textContent = clean(room.name) || (english() ? "Room" : "Stanza");
  if (entityName) {
    const labels = [
      clean(room.temp_name || room.temperature_name),
      clean(room.hum_name || room.humidity_name),
    ].filter(Boolean);
    entityName.textContent = labels.join(" · ");
    entityName.hidden = labels.length === 0;
    entityName.title = labels.join(" · ");
  }
}''',
)

text = read(temperature)
old_function = '''function normalizeTemperatureConfiguredRows() {
  const values = rooms();
  let normalized = false;
  doc
    ?.querySelectorAll?.("#editor-modal [data-temperature-room][data-room-id]")
    .forEach((row) => {
      const room = values.find((item) => clean(item?.id) === clean(row.dataset.roomId));
      const name =
        clean(room?.name) || clean(row.dataset.roomId) || (english() ? "Room" : "Stanza");
      const primary = row.querySelector(".ed-row-new");
      const secondary = row.querySelector(".ed-row-old");
      if (primary) {
        primary.textContent = name;
        primary.title = name;
        normalized = true;
      }
      if (secondary && room) {
        const sensors = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
        if (sensors) {
          secondary.textContent = sensors;
          secondary.title = sensors;
        }
      }
      row.dataset.dmTemperatureNameVisible = "true";
    });
  return normalized;
}'''
new_function = '''function normalizeTemperatureConfiguredRows() {
  const values = rooms();
  let normalized = false;
  doc
    ?.querySelectorAll?.("#editor-modal [data-temperature-room][data-room-id]")
    .forEach((row) => {
      const room = values.find((item) => clean(item?.id) === clean(row.dataset.roomId));
      if (!room) return;
      const icon = row.querySelector(":scope > .dm-temperature-card-icon");
      let main = row.querySelector(":scope > .ed-row-main");
      if (!main) {
        main = doc.createElement("div");
        main.className = "ed-row-main";
        if (icon?.parentElement === row) icon.after(main);
        else row.prepend(main);
      }
      let primary = main.querySelector(":scope > .ed-row-new");
      if (!primary) {
        primary = doc.createElement("div");
        primary.className = "ed-row-new";
        main.prepend(primary);
      }
      let secondary = main.querySelector(":scope > .ed-row-old");
      if (!secondary) {
        secondary = doc.createElement("div");
        secondary.className = "ed-row-old";
        main.append(secondary);
      }
      const name =
        clean(room.name) || clean(row.dataset.roomId) || (english() ? "Room" : "Stanza");
      const labels = [];
      if (clean(room.temp))
        labels.push(clean(room.temp_name || room.temperature_name) || clean(room.temp));
      if (clean(room.hum))
        labels.push(clean(room.hum_name || room.humidity_name) || clean(room.hum));
      primary.textContent = name;
      primary.title = name;
      secondary.textContent = labels.join(" · ");
      secondary.title = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
      row.dataset.dmTemperatureNameVisible = "true";
      normalized = true;
    });
  return normalized;
}'''
if old_function not in text:
    raise SystemExit("canonical Temperature row normalizer snippet not found")
text = text.replace(old_function, new_function, 1)
old_css = '#page-temp .cp-name,#temp-grid .cp-name{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:900!important;line-height:1.15!important;color:var(--primary-text-color,var(--text,#0f172a))!important}'
new_css = old_css + '\n    #page-temp .dm-temperature-room-copy,#temp-grid .dm-temperature-room-copy{display:grid!important;gap:2px!important;min-width:0!important;flex:1 1 auto!important}\n    #page-temp .temp-room-entity-name,#temp-grid .temp-room-entity-name{display:block!important;min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;font-size:9px!important;font-weight:800!important;line-height:1.2!important;text-transform:none!important;letter-spacing:0!important}'
if old_css not in text:
    raise SystemExit("Temperature room-name CSS snippet not found")
text = text.replace(old_css, new_css, 1)
old_row_css = '#editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main{display:block!important;visibility:visible!important;opacity:1!important;min-width:0!important;align-self:center!important;overflow:hidden!important}'
new_row_css = '#editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main{display:block!important;visibility:visible!important;opacity:1!important;width:auto!important;min-width:0!important;max-width:none!important;flex:1 1 auto!important;align-self:center!important;overflow:hidden!important}'
if old_row_css not in text:
    raise SystemExit("Temperature editor row CSS snippet not found")
text = text.replace(old_row_css, new_row_css, 1)
insert_css = '    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main>.ed-row-old{display:block!important;visibility:visible!important;opacity:1!important;margin-top:3px!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}\n'
if insert_css not in text:
    raise SystemExit("Temperature secondary row CSS snippet not found")
text = text.replace(
    insert_css,
    insert_css
    + '    #editor-modal #ed-body [data-temperature-room][data-room-id]{display:grid!important;grid-template-columns:56px minmax(0,1fr) 48px 48px!important;align-items:center!important;gap:10px!important}\n',
    1,
)
write(temperature, text)

# ---- Temperature editor companion: deterministic fields + persistence. ----
layout = "custom_components/dashboardmodern/frontend/src/sections/temperature-layout-section.js"
write(
    layout,
    r'''// DM-FIX-20260814D
// Targeted Temperature editor companion. The canonical card/row renderer stays
// in temperature-section.js; this module only owns optional display-name fields
// and their persistence lifecycle.
import {
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_LABEL_EDITOR__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  storeUnsubscribe: null,
  pendingLabels: new Map(),
  flushing: false,
  clearing: false,
});

function rooms() {
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function roomById(id) {
  const token = clean(id);
  return rooms().find((room) => clean(room?.id) === token) || null;
}

function createNameField(id, label) {
  const field = doc.createElement("label");
  field.className = "ed-slot dm-temperature-name-field";
  field.dataset.temperatureNameField = id;
  const title = doc.createElement("span");
  title.className = "ed-slot-lbl";
  title.textContent = label;
  const input = doc.createElement("input");
  input.id = id;
  input.type = "text";
  input.autocomplete = "off";
  input.className = "ed-input ed-slot-in";
  input.placeholder = english() ? "Optional display name" : "Nome visualizzato facoltativo";
  field.append(title, input);
  return field;
}

function formMode(form) {
  if (clean(form?.dataset?.dmOriginalRoom)) return "edit";
  if (form?.dataset?.dmTemperatureMode) return form.dataset.dmTemperatureMode;
  const title = clean(form?.querySelector("[data-temperature-form-title]")?.textContent);
  return /^(modifica|edit)\b/i.test(title) ? "edit" : "add";
}

export function ensureTemperatureNameFields(
  form = doc?.querySelector?.("#editor-modal [data-temperature-form]"),
) {
  if (!form) return false;
  let temp = form.querySelector("#dm-temperature-name");
  if (!temp) {
    const field = createNameField(
      "dm-temperature-name",
      english() ? "Temperature display name" : "Nome visualizzato temperatura",
    );
    const anchor = form.querySelector("#ed-pl-temp")?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    temp = field.querySelector("input");
  }
  let hum = form.querySelector("#dm-humidity-name");
  if (!hum) {
    const field = createNameField(
      "dm-humidity-name",
      english() ? "Humidity display name" : "Nome visualizzato umidità",
    );
    const anchor = form
      .querySelector("#dm-humidity-new")
      ?.closest("[data-entity-field],label.ed-slot");
    if (anchor) anchor.before(field);
    else form.append(field);
    hum = field.querySelector("input");
  }

  const roomId = clean(form.querySelector("#dm-temperature-room")?.value);
  const context = `${formMode(form)}|${roomId}`;
  if (form.dataset.dmTemperatureLabelContext !== context) {
    const room = roomById(roomId);
    temp.value = room ? clean(room.temp_name || room.temperature_name) : "";
    hum.value = room ? clean(room.hum_name || room.humidity_name) : "";
    form.dataset.dmTemperatureLabelContext = context;
  }
  form.dataset.dmTemperatureDisplayNames = "true";
  return true;
}

function captureSubmit(event) {
  const form = event.target?.closest?.("[data-temperature-form]");
  if (!form) return;
  const id = clean(form.querySelector("#dm-temperature-room")?.value);
  if (!id) return;
  state.pendingLabels.set(id, {
    temp_name: clean(form.querySelector("#dm-temperature-name")?.value),
    hum_name: clean(form.querySelector("#dm-humidity-name")?.value),
  });
  root.queueMicrotask?.(flushPendingLabels);
  root.setTimeout?.(flushPendingLabels, 0);
}

async function flushPendingLabels() {
  if (state.flushing || !state.pendingLabels.size) return;
  const store = dashboardStore();
  if (!store?.updateItem) return;
  state.flushing = true;
  try {
    for (const [id, labels] of [...state.pendingLabels.entries()]) {
      const room = roomById(id);
      if (!room || (!clean(room.temp) && !clean(room.hum))) continue;
      state.pendingLabels.delete(id);
      const patch = {
        temp_name: clean(labels.temp_name),
        hum_name: clean(labels.hum_name),
      };
      if (
        clean(room.temp_name) === patch.temp_name &&
        clean(room.hum_name) === patch.hum_name
      ) {
        continue;
      }
      await store.updateItem("rooms", id, patch);
    }
  } catch (error) {
    root.console?.error?.("[DashboardModern] Temperature display names", error);
  } finally {
    state.flushing = false;
  }
}

async function clearOrphanLabels() {
  if (state.clearing) return;
  const store = dashboardStore();
  if (!store?.updateItem) return;
  const orphan = rooms().find(
    (room) =>
      !clean(room.temp) &&
      !clean(room.hum) &&
      (clean(room.temp_name) || clean(room.hum_name)),
  );
  if (!orphan) return;
  state.clearing = true;
  try {
    await store.updateItem("rooms", orphan.id, { temp_name: "", hum_name: "" });
  } catch (error) {
    root.console?.error?.("[DashboardModern] clear Temperature display names", error);
  } finally {
    state.clearing = false;
  }
}

function run() {
  state.frame = 0;
  ensureTemperatureNameFields();
  flushPendingLabels();
  clearOrphanLabels();
}

function schedule() {
  if (state.frame) return;
  const execute = () => {
    run();
    root.requestAnimationFrame?.(() => ensureTemperatureNameFields());
  };
  state.frame = root.requestAnimationFrame?.(execute) || root.setTimeout?.(execute, 0) || 0;
}

function installOwners() {
  wrapFunction("editorSwitch", "__dmTemperatureDisplayNamesEditor", schedule);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section !== "rooms" && change?.section !== "snapshot") return;
    flushPendingLabels();
    clearOrphanLabels();
    schedule();
  });
}

function installStyles() {
  installStyle(
    "dm-temperature-display-name-fields",
    `
      #editor-modal [data-temperature-form] .dm-temperature-name-field{
        display:grid!important;gap:6px!important;min-width:0!important
      }
      #editor-modal [data-temperature-form] .dm-temperature-name-field>.ed-input{
        box-sizing:border-box!important;width:100%!important;min-width:0!important
      }
    `,
  );
}

export function installTemperatureLayoutSection() {
  installOwners();
  subscribeStore();
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("submit", captureSubmit, true);
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(
          "[data-temperature-edit],.ed-tab[data-tab='sez7'],[data-tab='temp'],[data-tab='temperature']",
        )
      ) {
        root.queueMicrotask?.(schedule);
      }
    },
    true,
  );
  doc.addEventListener(
    "change",
    (event) => {
      if (event.target?.closest?.("[data-temperature-form]")) schedule();
    },
    true,
  );
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
  ]) {
    root.addEventListener?.(eventName, () => {
      installOwners();
      subscribeStore();
      schedule();
    });
  }
  schedule();
  return true;
}
''',
)

# Beta17 must not repurpose the metric labels; custom names belong under the room.
beta17 = "custom_components/dashboardmodern/frontend/src/sections/beta17-final-icon-polish-section.js"
text = read(beta17)
pattern = re.compile(
    r"function repairTemperatureDashboardLabels\(\) \{.*?\n\}\n\nfunction runTemperatureRepair",
    re.S,
)
replacement = '''function repairTemperatureDashboardLabels() {
  // The canonical Temperature card owns metric labels. Optional sensor display
  // names are rendered as a subtitle beneath the room by temperature-section.
  return false;
}

function runTemperatureRepair'''
text2, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("beta17 Temperature label projection block not found")
write(beta17, text2)

# ---- Tests: real-device row visibility, persistence and subtitle. ----
write(
    "custom_components/dashboardmodern/frontend/tests/temperature-labels-regression.test.js",
    r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const temperatureUrl = new URL("../src/sections/temperature-section.js", import.meta.url);
const layoutUrl = new URL("../src/sections/temperature-layout-section.js", import.meta.url);
const migrationsUrl = new URL("../src/core/migrations.js", import.meta.url);

test("Temperature configured rows keep a visible room name beside the icon", async () => {
  const source = await readFile(temperatureUrl, "utf8");
  assert.match(source, /function normalizeTemperatureConfiguredRows\(\)/);
  assert.match(source, /primary\.textContent = name/);
  assert.match(source, /width:auto!important/);
  assert.match(source, /grid-template-columns:56px minmax\(0,1fr\) 48px 48px/);
});

test("Temperature optional entity names are canonical room fields", async () => {
  const source = await readFile(migrationsUrl, "utf8");
  assert.match(source, /temp_name: String\(room\.temp_name \|\| room\.temperature_name \|\| ""\)/);
  assert.match(source, /hum_name: String\(room\.hum_name \|\| room\.humidity_name \|\| ""\)/);
});

test("Temperature editor exposes and persists both optional display names", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.match(source, /dm-temperature-name/);
  assert.match(source, /dm-humidity-name/);
  assert.match(source, /pendingLabels/);
  assert.match(source, /store\.updateItem\("rooms", id, patch\)/);
  assert.doesNotMatch(source, /MutationObserver|setInterval\s*\(/);
});

test("Temperature card renders optional entity names below the room and preserves generic metric labels", async () => {
  const source = await readFile(temperatureUrl, "utf8");
  assert.match(source, /temp-room-entity-name/);
  assert.match(source, /roomCopy\.append\(name, entityName\)/);
  assert.match(source, /entityName\.textContent = labels\.join\(" · "\)/);
  assert.match(source, /cp-temp-current-lbl/);
  assert.match(source, /cp-temp-target/);
});
''',
)

write(
    "custom_components/dashboardmodern/frontend/e2e/temperature-labels-real-device.spec.js",
    r'''import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-cameretta",
        name: "Cameretta",
        icon: "mdi:bed",
        temp: "sensor.temperatura_cameretta_temperature",
        hum: "sensor.temperatura_cameretta_humidity",
        temp_name: "Temperatura cameretta",
        hum_name: "Umidità cameretta",
      },
    ],
  },
  visibility: {},
};

const states = [
  {
    entity_id: "sensor.temperatura_cameretta_temperature",
    state: "22.4",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.temperatura_cameretta_humidity",
    state: "51",
    attributes: { unit_of_measurement: "%", device_class: "humidity" },
  },
];

for (const variant of ["dashboard.html", "dashboard-en.html"]) {
  test(`${variant}: Temperature shows room and entity display names on a real-device layout`, async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await page.addInitScript((haStates) => {
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          super();
          queueMicrotask(() =>
            this.onmessage?.({ data: JSON.stringify({ type: "auth_required" }) }),
          );
        }
        send(raw) {
          const message = JSON.parse(raw);
          if (message.type === "auth") {
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          } else {
            this.onmessage?.({
              data: JSON.stringify({
                id: message.id,
                type: "result",
                success: true,
                result: message.type === "get_states" ? haStates : [],
              }),
            });
          }
        }
        close() {}
      };
    }, states);

    await bootNamespacedDashboard(page, variant, testInfo, seed);
    await page
      .locator("#setup-wizard")
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await page.evaluate((haStates) => {
      haStates.forEach((state) => {
        _RAW_STATES[state.entity_id] = state;
        STATES[state.entity_id] = state;
      });
      apriConfigEntita();
      editorSwitch("sez7");
    }, states);

    const row = page.locator(
      '[data-temperature-room][data-room-id="room-cameretta"]',
    );
    await expect(row).toBeVisible();
    const rowName = row.locator(":scope > .ed-row-main > .ed-row-new");
    await expect(rowName).toBeVisible();
    await expect(rowName).toHaveText("Cameretta");
    await expect(row.locator(":scope > .ed-row-main > .ed-row-old")).toContainText(
      "Temperatura cameretta",
    );
    await expect(row.locator(":scope > .ed-row-main > .ed-row-old")).toContainText(
      "Umidità cameretta",
    );
    expect((await rowName.boundingBox())?.width || 0).toBeGreaterThan(20);

    await row.locator("[data-temperature-edit]").click();
    const tempName = page.locator("#dm-temperature-name");
    const humName = page.locator("#dm-humidity-name");
    await expect(tempName).toBeVisible();
    await expect(humName).toBeVisible();
    await expect(tempName).toHaveValue("Temperatura cameretta");
    await expect(humName).toHaveValue("Umidità cameretta");
    await tempName.fill("Temperatura Camera");
    await humName.fill("Umidità Camera");
    await page.locator("[data-temperature-submit]").click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          DashboardModernModules.store
            .getSection("rooms")
            .find((room) => room.id === "room-cameretta"),
        ),
      )
      .toMatchObject({
        temp_name: "Temperatura Camera",
        hum_name: "Umidità Camera",
      });

    await page.locator("#editor-modal .ed-head-close").last().click();
    await clickBottomTab(page, "temp", testInfo);
    const card = page.locator(
      '#temp-grid .temp-card[data-room-id="room-cameretta"]',
    );
    await expect(card.locator(".temp-room-name")).toHaveText("Cameretta");
    await expect(card.locator(".temp-room-entity-name")).toHaveText(
      "Temperatura Camera · Umidità Camera",
    );
    await expect(card.locator(".cp-temp-current-lbl")).toHaveText(
      variant === "dashboard-en.html" ? "Temperature" : "Temperatura",
    );
    await expect(card.locator(".cp-temp-target .lbl")).toContainText(
      variant === "dashboard-en.html" ? "Humidity" : "Umidità",
    );
  });
}
''',
)

ui_reg = "custom_components/dashboardmodern/frontend/tests/ui-regressions-01514.test.js"
replace_once(
    ui_reg,
    '''  // Temporary import compatibility only: it must not render, style or observe.
  assert.match(legacyLayout, /return false/);
  assert.doesNotMatch(legacyLayout, /installStyle|setInterval|MutationObserver|querySelector|innerHTML/);''',
    '''  // The companion may own the two optional editor-name fields, but never
  // the Temperature card renderer or a global polling/observer loop.
  assert.match(legacyLayout, /ensureTemperatureNameFields/);
  assert.doesNotMatch(legacyLayout, /renderTemperatureCards|replaceChildren/);
  assert.doesNotMatch(legacyLayout, /setInterval|MutationObserver/);''',
)

store_test = "custom_components/dashboardmodern/frontend/tests/dashboard-store.test.js"
replace_once(
    store_test,
    '''    temp: "",
    hum: "",
  };''',
    '''    temp: "",
    hum: "",
    temp_name: "Sonda cucina",
    hum_name: "Umidità cucina",
  };''',
)
marker = 'test("cover legacy room references resolve stable room ids", () => {'
addition = '''test("room migration preserves optional Temperature display names", () => {
  const [room] = migrateRooms([
    {
      id: "room-kitchen",
      name: "Kitchen",
      temp: "sensor.kitchen_temperature",
      hum: "sensor.kitchen_humidity",
      temp_name: "Kitchen probe",
      hum_name: "Kitchen humidity",
    },
  ]);
  assert.equal(room.temp_name, "Kitchen probe");
  assert.equal(room.hum_name, "Kitchen humidity");
});

'''
text = read(store_test)
if marker not in text:
    raise SystemExit("dashboard-store insertion marker not found")
write(store_test, text.replace(marker, addition + marker, 1))

# ---- Release metadata/hardening. ----
manifest = "custom_components/dashboardmodern/manifest.json"
replace_once(manifest, '"version": "1.0.0-beta.20"', '"version": "1.0.0-beta.21"')

build_info = "custom_components/dashboardmodern/frontend/legacy/build-info.js"
text = read(build_info)
text = text.replace(
    '"integrationVersion":"1.0.0-beta.17"',
    '"integrationVersion":"1.0.0-beta.21"',
)
text = text.replace(
    '"dashboardVersion":"1.0.0-beta.17"',
    '"dashboardVersion":"1.0.0-beta.21"',
)
if (
    '"integrationVersion":"1.0.0-beta.21"' not in text
    or '"dashboardVersion":"1.0.0-beta.21"' not in text
):
    raise SystemExit("build-info version update failed")
write(build_info, text)

write(
    "custom_components/dashboardmodern/frontend/tests/build-info.test.js",
    r'''import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const manifest = JSON.parse(
  readFileSync("custom_components/dashboardmodern/manifest.json", "utf8"),
);
const committedBuildInfoPath =
  "custom_components/dashboardmodern/frontend/legacy/build-info.js";

test("committed build info cannot lag behind the manifest version", () => {
  const source = execFileSync("git", ["show", `HEAD:${committedBuildInfoPath}`], {
    encoding: "utf8",
  });
  assert.match(source, new RegExp(`"integrationVersion":"${manifest.version}"`));
  assert.match(source, new RegExp(`"dashboardVersion":"${manifest.version}"`));
});

test("build info is generated from HEAD and exposes one canonical release version", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const output = join(mkdtempSync(join(tmpdir(), "dm-build-")), "build-info.js");
  execFileSync("python", [
    "scripts/generate_build_info.py",
    "--expected-commit",
    head,
    "--output",
    output,
  ]);
  const source = readFileSync(output, "utf8");
  assert.match(source, new RegExp(head));
  assert.match(source, new RegExp(`"integrationVersion":"${manifest.version}"`));
  assert.match(source, new RegExp(`"dashboardVersion":"${manifest.version}"`));
  assert.doesNotMatch(source, /"dashboardVersion":"0\.14\.0"/);
  assert.match(source, /"moduleVersion":14/);
  assert.match(source, /"schemaVersion":4/);
  assert.match(source, /"assetHash":"[a-f0-9]{16}"/);
});

test("build generation rejects a different expected commit", () => {
  const result = spawnSync(
    "python",
    ["scripts/generate_build_info.py", "--expected-commit", "0".repeat(40)],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /build commit mismatch/);
});
''',
)

frontend_py = "custom_components/dashboardmodern/frontend.py"
replace_once(
    frontend_py,
    'IGNORED_RUNTIME_FILES = frozenset({"legacy/VENDOR.json"})',
    'IGNORED_RUNTIME_FILES = frozenset({"legacy/build-info.js", "legacy/VENDOR.json"})',
)

generator = "scripts/generate_build_info.py"
text = read(generator)
text = text.replace(
    'IGNORED_RUNTIME_PARTS = frozenset({"e2e", "tests", "__pycache__"})\n',
    'IGNORED_RUNTIME_PARTS = frozenset({"e2e", "tests", "__pycache__"})\nIGNORED_RUNTIME_FILES = frozenset({"legacy/build-info.js", "legacy/VENDOR.json"})\n',
    1,
)
text = text.replace(
    '''        for path in sorted(directory.rglob("*")):
            if (
                path.is_file()
                and path != DEFAULT_OUT
                and path.suffix in ASSET_SUFFIXES
                and not IGNORED_RUNTIME_PARTS.intersection(path.parts)
            ):
                yield path''',
    '''        for path in sorted(directory.rglob("*")):
            relative = path.relative_to(FRONTEND).as_posix()
            if (
                path.is_file()
                and path.suffix in ASSET_SUFFIXES
                and relative not in IGNORED_RUNTIME_FILES
                and not IGNORED_RUNTIME_PARTS.intersection(path.parts)
            ):
                yield path''',
    1,
)
if "IGNORED_RUNTIME_FILES" not in text or "relative not in IGNORED_RUNTIME_FILES" not in text:
    raise SystemExit("build-info generator asset list patch failed")
write(generator, text)

# ---- Changelog beta.18 -> beta.21. ----
changelog = "CHANGELOG.md"
text = read(changelog)
changelog_marker = "## 1.0.0-beta.17 — 2026-08-13\n"
changelog_insert = '''## 1.0.0-beta.21 — 2026-08-14

### Corretto

- Resi sempre visibili nell'editor Temperatura il nome della stanza e i nomi visualizzati dei sensori accanto all'icona, anche sul layout mobile reale.
- Aggiunti i campi persistenti **Nome visualizzato temperatura** e **Nome visualizzato umidità** e mantenuti durante migrazioni, salvataggi e sincronizzazione.
- Mostrati i nomi personalizzati dei sensori sotto il nome della stanza nelle card Temperatura, lasciando **Temperatura** e **Umidità** come etichette KPI stabili.
- Allineati metadata di build, hash asset, documentazione HACS e controlli di release per evitare versioni committate obsolete.

### Manutenzione

- Uniformato il nome pubblico in **Dashboard Modern V2**, aggiunti template bug e policy di sicurezza.
- Il validator HACS non ignora più la LICENSE; resta temporaneamente ignorato solo il controllo `topics` finché i topic repository non vengono configurati nelle impostazioni GitHub.

## 1.0.0-beta.20 — 2026-08-14

### Corretto

- Prima iterazione dei nomi visualizzati Temperatura e delle correzioni real-device delle righe configurate.

## 1.0.0-beta.19 — 2026-08-14

### Corretto

- Consolidato il renderer canonico Temperatura e stabilizzato il gate Browser E2E/WebKit per il rilascio.

## 1.0.0-beta.18 — 2026-08-14

### Modificato

- Introdotto il motore icone single-owner per Stanze e Azioni rapide, eliminando renderer concorrenti e sfarfallii residui.

'''
if changelog_marker not in text:
    raise SystemExit("CHANGELOG beta.17 marker not found")
write(changelog, text.replace(changelog_marker, changelog_insert + changelog_marker, 1))

# ---- README: current badge, beta install path, Temperature names. ----
readme = "README.md"
text = read(readme)
text = text.replace(
    '<h1 align="center">DashboardModern v2</h1>',
    '<h1 align="center">Dashboard Modern V2</h1>',
    1,
)
text = text.replace(
    '<img src="https://img.shields.io/badge/version-1.0.0--beta.19-0ea5e9" alt="Versione 1.0.0-beta.19">',
    '<img src="https://img.shields.io/github/v/release/danigio15/dashboardmodern-v2?include_prereleases&sort=semver&display_name=tag&label=version" alt="Ultima versione Dashboard Modern V2">',
    1,
)
old_steps = '''5. Tipo repository: **Integrazione**.
6. Cerca **Dashboard Modern V2** e installa la release desiderata.
7. Riavvia Home Assistant.
8. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**.
9. Cerca **Dashboard Modern V2**.
10. Assegna un nome alla plancia e completa la configurazione.'''
new_steps = '''5. Tipo repository: **Integrazione**.
6. Apri il repository **Dashboard Modern V2** in HACS, entra nel menu del repository e abilita **Mostra versioni beta** / **Show beta versions**: la serie `1.0.0-beta.x` è pubblicata come prerelease.
7. Installa la release beta desiderata.
8. Riavvia Home Assistant.
9. Vai in **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**.
10. Cerca **Dashboard Modern V2**.
11. Assegna un nome alla plancia e completa la configurazione.'''
if old_steps not in text:
    raise SystemExit("README HACS steps snippet not found")
text = text.replace(old_steps, new_steps, 1)
old_temp = '''Campi principali:

- **Stanza** — obbligatoria;
- **Entità temperatura** — per esempio `sensor.camera_temperature`;
- **Entità umidità** — facoltativa, per esempio `sensor.camera_humidity`.

Nome e icona si modificano dalla sezione **Stanze**. Durante la modifica è possibile spostare i sensori da una stanza a un'altra, purché la stanza di destinazione non abbia già un'associazione Temperatura.

La dashboard mostra il **nome della stanza accanto all'icona**, la temperatura corrente, l'umidità e un'indicazione sintetica di comfort.'''
new_temp = '''Campi principali:

- **Stanza** — obbligatoria;
- **Nome visualizzato temperatura** — facoltativo, mostrato sotto il nome della stanza;
- **Entità temperatura** — per esempio `sensor.camera_temperature`;
- **Nome visualizzato umidità** — facoltativo, mostrato sotto il nome della stanza;
- **Entità umidità** — facoltativa, per esempio `sensor.camera_humidity`.

Nome e icona della stanza si modificano dalla sezione **Stanze**; i due nomi visualizzati dei sensori si modificano invece direttamente in **Temperatura**. Durante la modifica è possibile spostare i sensori da una stanza a un'altra, purché la stanza di destinazione non abbia già un'associazione Temperatura.

La dashboard mostra il **nome della stanza accanto all'icona**, gli eventuali nomi personalizzati dei sensori subito sotto la stanza, la temperatura corrente, l'umidità e un'indicazione sintetica di comfort.'''
if old_temp not in text:
    raise SystemExit("README Temperature documentation snippet not found")
text = text.replace(old_temp, new_temp, 1)
write(readme, text)

hacs = "hacs.json"
replace_once(hacs, '"name": "DashboardModern v2"', '"name": "Dashboard Modern V2"')

validate = ".github/workflows/validate.yml"
text = read(validate)
text = text.replace(
    '''permissions:
  contents: read
  pull-requests: write
  issues: write''',
    '''permissions:
  contents: read''',
    1,
)
text = text.replace(
    '''          # HACS reads repository-level metadata for these checks. During this
          # pull request GitHub does not expose the new LICENSE file as the
          # repository license until it is merged into the default branch.
          # Topics are optional for installation as a custom HACS repository.
          ignore: topics license''',
    '''          # Repository topics are still empty. Keep only this temporary
          # metadata ignore until topics are configured in GitHub settings.
          ignore: topics''',
    1,
)
if "issues: write" in text or "pull-requests: write" in text or "topics license" in text:
    raise SystemExit("validate workflow cleanup failed")
write(validate, text)

# ---- Public project hygiene. ----
write(
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    '''name: Bug report
description: Segnala un problema riproducibile di Dashboard Modern V2
title: "[Bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Grazie per la segnalazione. Non inserire token, password, URL Nabu Casa, IP pubblici o altri segreti.
  - type: input
    id: dashboard_version
    attributes:
      label: Versione Dashboard Modern V2
      placeholder: 1.0.0-beta.21
    validations:
      required: true
  - type: input
    id: home_assistant_version
    attributes:
      label: Versione Home Assistant
      placeholder: 2026.x.x
    validations:
      required: true
  - type: input
    id: device
    attributes:
      label: Dispositivo / browser / app
      placeholder: Android Companion, iPhone kiosk, Chrome desktop...
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Passaggi per riprodurre
      description: Indica cosa fai, cosa ti aspetti e cosa accade invece.
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Log o screenshot
      description: Rimuovi dati personali e segreti prima di allegarli.
''',
)
write(
    "SECURITY.md",
    '''# Security Policy

## Segnalare una vulnerabilità

Per problemi di sicurezza **non aprire una issue pubblica con dettagli sfruttabili**.
Usa, quando disponibile, la funzione **Report a vulnerability / Private vulnerability reporting** nella scheda Security del repository GitHub.

Indica la versione interessata, i passaggi minimi per riprodurre e l'impatto osservato. Non includere token Home Assistant, credenziali, URL Nabu Casa, cookie di sessione o altri segreti nei log e negli screenshot.

Le normali regressioni UI o funzionali possono invece essere segnalate tramite il template Bug report.
''',
)

# Basic sanity checks before committing.
assert "1.0.0-beta.21" in read(manifest)
assert "temp-room-entity-name" in read(temperature)
assert "temp_name: String" in read(migrations)
assert "Mostra versioni beta" in read(readme)
assert "ignore: topics\n" in read(validate)
