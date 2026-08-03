/* DashboardModern 0.15.0 — bounded residual ownership for legacy DOM contracts. */
import { PERIOD_SOURCES, sourcePlans } from "../src/core/period-service.js";
import { applianceArtwork, canonicalArtworkType } from "../src/core/appliance-artwork.js";

(function installResidualFixes0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RUNTIME_RESIDUAL_0150__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    listeners: false,
    subscribed: false,
    energyGeneration: 0,
    lightEditEntity: "",
    coverEditId: "",
  });

  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const store = () => root.DashboardModernModules?.store || null;
  const runtime = () => root.DashboardModernRuntime0150 || null;
  const allStates = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");

  const MONTH_SLOTS = Object.freeze(
    Object.fromEntries(PERIOD_SOURCES.map((definition) => [definition.slots.month, definition.key])),
  );

  function globalEval(code) {
    try {
      return root.eval?.(code);
    } catch (_error) {
      return undefined;
    }
  }

  function selectedDate() {
    const now = new Date();
    const month = Number(doc.getElementById("ed-sel-month")?.value);
    const year = Number(doc.getElementById("ed-sel-year")?.value);
    return new Date(
      Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
      Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : now.getMonth(),
      1,
    );
  }

  function currentMonth(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function legacyOverrides() {
    const canonical = store()?.getSection?.("entityOverrides");
    if (canonical && !Array.isArray(canonical)) return canonical;
    try {
      return JSON.parse(root.localStorage?.getItem("cd_entity_overrides") || "{}") || {};
    } catch (_error) {
      return {};
    }
  }

  function writeLegacyPeriod(slot, raw) {
    const value = finite(raw);
    if (!slot || value == null) return false;
    const normalized = Math.max(0, value);

    root.CD_PERIOD ||= {};
    const ownerEntry = root.__DASHBOARDMODERN_FINAL_OWNER_0150__?.registry?.[slot];
    if (ownerEntry) {
      ownerEntry.value = normalized;
      ownerEntry.owned = true;
    }
    try {
      root.CD_PERIOD[slot] = normalized;
    } catch (_error) {}

    const slotKey = "__DASHBOARDMODERN_RESIDUAL_SLOT__";
    const valueKey = "__DASHBOARDMODERN_RESIDUAL_VALUE__";
    root[slotKey] = slot;
    root[valueKey] = normalized;
    globalEval(`
      try {
        if (typeof CD_PERIOD !== "undefined") {
          CD_PERIOD[globalThis.${slotKey}] = globalThis.${valueKey};
        }
      } catch (_error) {}
    `);
    delete root[slotKey];
    delete root[valueKey];
    return true;
  }

  function publishDerivedState(slot, raw, source, kind, selected) {
    const value = finite(raw);
    if (!slot || value == null) return false;
    const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
    const stamp = new Date().toISOString();
    const item = {
      entity_id: slot,
      state: String(rounded),
      attributes: {
        unit_of_measurement: "kWh",
        device_class: "energy",
        state_class: "measurement",
        dashboardmodern_derived: true,
        dashboardmodern_source: source,
        dashboardmodern_period: kind,
        dashboardmodern_selected: selected.toISOString(),
        dashboardmodern_version: "0.15.0",
      },
      last_changed: stamp,
      last_updated: stamp,
    };

    try {
      runtime()?.broker?.ingestState?.(item);
    } catch (_error) {}
    root._RAW_STATES ||= {};
    root.STATES ||= {};
    root._RAW_STATES[slot] = item;
    root.STATES[slot] = item;

    const stateKey = "__DASHBOARDMODERN_RESIDUAL_STATE__";
    const slotKey = "__DASHBOARDMODERN_RESIDUAL_STATE_SLOT__";
    root[stateKey] = item;
    root[slotKey] = slot;
    globalEval(`
      try {
        if (typeof _RAW_STATES !== "undefined") {
          _RAW_STATES[globalThis.${slotKey}] = globalThis.${stateKey};
        }
      } catch (_error) {}
      try {
        if (typeof STATES !== "undefined") {
          STATES[globalThis.${slotKey}] = globalThis.${stateKey};
        }
      } catch (_error) {}
    `);
    delete root[stateKey];
    delete root[slotKey];

    if (kind === "month" && currentMonth(selected)) writeLegacyPeriod(slot, rounded);
    return true;
  }

  function projectCurrentBundle(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!bundle?.period || !bundle?.month) return false;
    const date = new Date(Number(bundle.period.year), Number(bundle.period.month) - 1, 1);
    if (!currentMonth(date)) return false;
    for (const [slot, key] of Object.entries(MONTH_SLOTS)) {
      writeLegacyPeriod(slot, bundle.month[key]);
    }
    return true;
  }

  async function refreshDerivedEnergy(selected = selectedDate()) {
    const broker = runtime()?.broker;
    const dashboardStore = store();
    if (!broker?.valuesForPlans || !dashboardStore?.getSection) return false;
    const generation = ++state.energyGeneration;
    const energy = dashboardStore.getSection("energy") || {};
    const states = allStates();
    const overrides = legacyOverrides();
    broker.cache?.clear?.();

    const requests = ["day", "month", "year"].map(async (kind) => {
      const date = kind === "day" ? new Date() : selected;
      const plans = sourcePlans(
        energy,
        kind,
        states,
        overrides,
        root.resolveEntity || ((value) => value),
      );
      const values = await broker.valuesForPlans(plans, date, states);
      return { kind, date, plans, values };
    });

    try {
      const results = await Promise.all(requests);
      if (generation !== state.energyGeneration) return false;
      const activeBundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle;
      const selectedToken = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}`;
      for (const { kind, date, plans, values } of results) {
        for (const plan of plans) {
          const value = values.get(plan.key);
          if (!Number.isFinite(value)) continue;
          publishDerivedState(plan.slot, value, plan.source || plan.entity, kind, date);
          if (activeBundle?.token === selectedToken && activeBundle[kind]) {
            activeBundle[kind][plan.key] = value;
          }
        }
      }
      if (activeBundle?.token === selectedToken) runtime()?.applyBundle?.(activeBundle);
      projectCurrentBundle(activeBundle);
      return true;
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.0] residual energy projection", error);
      return false;
    }
  }

  function snapshotMonthlyDom() {
    return Object.fromEntries(
      ["v-solar-month", "v-home-month", "v-grid-month", "v-battery-month"].map((id) => [
        id,
        doc.getElementById(id)?.textContent || "",
      ]),
    );
  }

  function restoreMonthlyDom(snapshot) {
    Object.entries(snapshot || {}).forEach(([id, value]) => {
      const node = doc.getElementById(id);
      if (node && value) node.textContent = value;
    });
  }

  function installDispatchGuard() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current.__dmResidualDispatch) return true;
    function dispatchResidual0150(event) {
      const snapshot = event?.type === "dashboardmodern:energy-periods-0154"
        ? snapshotMonthlyDom()
        : null;
      const result = current.call(this, event);
      if (snapshot) {
        [0, 40, 120, 240, 520, 760].forEach((delay) =>
          root.setTimeout?.(() => restoreMonthlyDom(snapshot), delay),
        );
      }
      return result;
    }
    dispatchResidual0150.__dmResidualDispatch = true;
    dispatchResidual0150.__dmPrevious = current;
    root.dispatchEvent = dispatchResidual0150;
    return true;
  }

  function setManualReportState(button, expanded) {
    const panel = button.closest('[data-energy-panel="report"]') || button.parentElement;
    const form = panel?.querySelector("[data-report-manual]");
    button.setAttribute("aria-expanded", String(expanded));
    if (form) {
      form.hidden = !expanded;
      form.style.display = expanded ? "" : "none";
    }
  }

  function normalizeManualReport() {
    doc.querySelectorAll("[data-report-add]").forEach((button) => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
      setManualReportState(button, expanded);
    });
  }

  function applyTemperatureEditor() {
    const input = doc.getElementById("dm-temperature-icon");
    if (!input) return false;
    input.type = "hidden";
    input.tabIndex = -1;
    if (!clean(input.value)) input.value = "mdi:home";
    const label = input.closest("label,[data-icon-field]");
    if (label) {
      label.replaceChildren(input);
      label.hidden = true;
      label.style.setProperty("display", "none", "important");
      label.setAttribute("aria-hidden", "true");
    }
    const submit = doc.querySelector("[data-temperature-submit]");
    if (submit) submit.textContent = english() ? "ASSOCIATE" : "ASSOCIA";
    return true;
  }

  function applyEditorTheme() {
    const modal = doc.getElementById("editor-modal");
    if (modal) {
      modal.dataset.dmEditorTheme = doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
    }
  }

  function canonicalToken(device) {
    return canonicalArtworkType(
      device?.visual_key || device?.device_type || device?.type || device?.icon || device?.name,
    );
  }

  function normalizeApplianceCards() {
    const devices = store()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach(
      (card, index) => {
        const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
        if (!device) return;
        const visual = card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
        if (!visual) return;
        let icon = visual.querySelector(".appl-ic");
        if (!icon) {
          icon = doc.createElement("div");
          icon.className = "appl-ic";
          visual.replaceChildren(icon);
        }
        const imageUrl = clean(device.image || device.image_url);
        const token = canonicalToken(device);
        const assetKey = clean(device.visual_key || device.device_type || token);
        const signature = `${clean(device.id)}|${token}|${imageUrl}`;
        const currentImage = icon.querySelector("img.dm-appliance-image-0153");
        const currentArt = icon.querySelector(`.dm-appliance-art-0154[data-dm-art="${token}"]`);
        const mediaIsCanonical = imageUrl
          ? Boolean(currentImage && currentImage.getAttribute("src") === imageUrl)
          : Boolean(token && currentArt);
        if (card.dataset.dmResidualMediaSignature !== signature || !mediaIsCanonical) {
          if (imageUrl) {
            icon.innerHTML = '<span class="dm-appliance-image-wrap"><img class="dm-appliance-image dm-appliance-image-0153" alt=""></span>';
            const image = icon.querySelector("img");
            image.src = imageUrl;
            image.alt = clean(device.name);
            image.loading = "eager";
            image.decoding = "async";
            image.style.objectFit = /^data:image\//i.test(imageUrl) ? "contain" : "cover";
          } else if (token) {
            icon.innerHTML = applianceArtwork(token, 96);
            const art = icon.querySelector(".dm-appliance-art-0154");
            if (art) {
              art.dataset.applianceAsset = assetKey;
              art.dataset.applianceAssetKey = assetKey;
            }
          }
          card.dataset.dmResidualMediaSignature = signature;
        }
        const setData = (node, key, value) => {
          if (node.dataset[key] !== value) node.dataset[key] = value;
        };
        setData(card, "dmMediaKind", imageUrl ? "image" : "asset");
        setData(card, "dmArtwork", token || assetKey);
        setData(card, "dmArtStyle", "panel");
        setData(card, "applianceThemeAware", "true");
        setData(visual, "applianceCover", "true");
        card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      },
    );
  }

  function safeSwitchEnergyView(view, eventObject) {
    try {
      root.navigator?.vibrate?.(5);
    } catch (_error) {}
    doc.querySelectorAll(".sub-tab-btn").forEach((button) => button.classList.remove("active"));
    doc.querySelectorAll(".flow-view").forEach((node) => node.classList.remove("active"));
    const target =
      eventObject?.currentTarget ||
      [...doc.querySelectorAll(".sub-tab-btn")].find((button) =>
        (button.getAttribute("onclick") || "").includes(`'${view}'`),
      );
    target?.classList?.add("active");
    doc.getElementById(`view-${view}`)?.classList.add("active");
    try {
      root.scrollTo?.({ top: 0, behavior: "instant" });
    } catch (_error) {}
    if (view === "panoramica") root.renderEnergyDashboard?.();
    if (view === "temp") root.renderInverterTemp?.();
    root.queueMicrotask?.(applyResidualUi);
  }
  safeSwitchEnergyView.__dmFinalOwner = true;
  safeSwitchEnergyView.__dmResidualOwner = true;

  function installSafeEnergySwitch() {
    if (root.switchEnergyView === safeSwitchEnergyView) return true;
    root.switchEnergyView = safeSwitchEnergyView;
    return true;
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    root.localStorage?.setItem(key, JSON.stringify(value));
    try {
      root.cdMarkDirty?.();
      root.cdSyncPush?.();
    } catch (_error) {}
  }

  function roomOptionsByName(selected = "") {
    const rooms = store()?.getSection?.("rooms") || [];
    return [
      `<option value="">— ${english() ? "No room" : "Nessuna stanza"} —</option>`,
      ...rooms.map((room) => {
        const value = clean(room.name || room.id);
        return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(room.name || room.id)}</option>`;
      }),
    ].join("");
  }

  function roomOptionsById(selected = "") {
    const rooms = store()?.getSection?.("rooms") || [];
    return [
      `<option value="">— ${english() ? "No room" : "Nessuna stanza"} —</option>`,
      ...rooms.map((room) => {
        const value = clean(room.id || room.name);
        return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(room.name || room.id)}</option>`;
      }),
    ].join("");
  }

  function decorateLightEditor() {
    const body = doc.getElementById("ed-body");
    if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "luci") return false;
    body.querySelectorAll(".ed-lrow").forEach((row) => {
      const match = clean(row.textContent).match(/(?:light|switch)\.[a-z0-9_]+/i);
      const entity = match?.[0] || "";
      if (!entity) return;
      let button = row.querySelector(".dm-edit-button");
      if (!button) {
        button = doc.createElement("button");
        button.type = "button";
        button.className = "ed-del dm-edit-button";
        button.textContent = "✏️";
        row.append(button);
      }
      button.dataset.residualLightEdit = entity;
      button.title = english() ? "Edit" : "Modifica";
      button.removeAttribute("onclick");
    });

    const entityInput = body.querySelector("#luce-add-ent");
    const nameInput = body.querySelector("#luce-add-name");
    const form = entityInput?.closest("[data-light-add-form],.dm-light-add-form,.ed-form") || null;
    if (!form) return false;
    form.classList.add("dm-config-form");
    let roomSelect = form.querySelector("#luce-add-room");
    if (!roomSelect) {
      const label = doc.createElement("label");
      label.className = "ed-slot dm-config-field";
      label.innerHTML = `<span class="ed-slot-lbl">${english() ? "Room" : "Stanza"}</span><select id="luce-add-room" class="ed-input">${roomOptionsByName()}</select>`;
      (nameInput?.closest("label") || nameInput)?.insertAdjacentElement?.("afterend", label);
      roomSelect = label.querySelector("select");
    }
    if (state.lightEditEntity) {
      const lights = readJson("cd_luci", {});
      const rooms = readJson("cd_luci_rooms", {});
      if (entityInput) entityInput.value = state.lightEditEntity;
      if (nameInput) nameInput.value = lights[state.lightEditEntity] || "";
      if (roomSelect) {
        roomSelect.innerHTML = roomOptionsByName(rooms[state.lightEditEntity] || "");
        roomSelect.value = rooms[state.lightEditEntity] || "";
      }
      const submit = form.querySelector('button[onclick*="cdLuceAdd"],button[data-light-add]');
      if (submit) submit.textContent = english() ? "💾 Save changes" : "💾 Salva modifiche";
    }
    return true;
  }

  function saveLight() {
    const entity = clean(doc.getElementById("luce-add-ent")?.value);
    const name = clean(doc.getElementById("luce-add-name")?.value);
    const room = clean(doc.getElementById("luce-add-room")?.value);
    if (!/^(light|switch)\.[a-z0-9_]+$/i.test(entity)) {
      root.alert?.(english() ? "Enter a valid light or switch entity." : "Inserisci una entità light o switch valida.");
      return;
    }
    const lights = readJson("cd_luci", {});
    const rooms = readJson("cd_luci_rooms", {});
    const order = readJson("cd_luci_order", {});
    const old = state.lightEditEntity;
    if (old) {
      delete lights[old];
      delete rooms[old];
    }
    lights[entity] = name || entity.split(".")[1];
    if (room) rooms[entity] = room;
    Object.values(order).forEach((ids) => {
      if (!Array.isArray(ids)) return;
      const index = old ? ids.indexOf(old) : -1;
      if (index >= 0) ids[index] = entity;
    });
    writeJson("cd_luci", lights);
    writeJson("cd_luci_rooms", rooms);
    writeJson("cd_luci_order", order);
    state.lightEditEntity = "";
    root.updateGestioneLuci?.();
    root.editorSwitch?.("luci");
  }
  saveLight.__dmFinalOwner = true;
  saveLight.__dmResidualOwner = true;

  function installLightSave() {
    if (root.cdLuceAdd === saveLight) return true;
    root.cdLuceAdd = saveLight;
    return true;
  }

  function canonicalCovers() {
    return store()?.getSection?.("covers") || [];
  }

  function coverEntity(item) {
    return clean(item?.entity || item?.entities?.[0]);
  }

  function legacyCovers() {
    return canonicalCovers().map((item) => {
      const value = { name: clean(item.name) || coverEntity(item), entity: coverEntity(item) };
      if (item.room_id) value.room = item.room_id;
      return value;
    });
  }

  function renderCoverEditor() {
    const list = canonicalCovers();
    const current = list.find((item) => clean(item.id) === state.coverEditId) || null;
    const rows = list.length
      ? list
          .map(
            (item, index) => `<div class="ed-row" data-tapp-id="${escapeHtml(item.id)}">
              <div class="ed-row-main"><div class="ed-row-new">🪟 ${escapeHtml(item.name || coverEntity(item))}</div><div class="ed-row-old mono">${escapeHtml(coverEntity(item))}</div></div>
              <div class="dm-row-actions"><button type="button" class="ed-del dm-edit-button" data-tapp-edit="${index}" onclick="edTappEdit(${index})">✏️</button><button type="button" class="ed-del" onclick="edTappDel(${index})">🗑️</button></div>
            </div>`,
          )
          .join("")
      : `<div class="ed-empty">${english() ? "No shutters configured." : "Nessuna tapparella configurata."}</div>`;
    return `<div class="ed-intro">${english() ? "Edit an existing shutter or add a Home Assistant cover entity." : "Modifica una tapparella esistente o aggiungi una entità cover di Home Assistant."}</div>
      <div class="ed-list">${rows}</div>
      <div class="ed-form dm-tapp-form" data-tapp-form>
        <div class="ed-sec-title">${current ? (english() ? "Edit shutter" : "Modifica tapparella") : english() ? "Add shutter" : "Aggiungi tapparella"}</div>
        <label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Name" : "Nome"}</span><input id="ed-tp-name" class="ed-input" value="${escapeHtml(current?.name || "")}"></label>
        <label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${english() ? "Cover entity" : "Entità cover"}</span><span class="ed-form-row"><input id="ed-tp-ent" class="ed-input mono" data-entity-input value="${escapeHtml(coverEntity(current))}" placeholder="cover.tapparella_salone"><button type="button" class="dm-entity-picker" data-entity-target="ed-tp-ent">🔍</button></span></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Room" : "Stanza"}</span><select id="ed-tp-room" class="ed-input">${roomOptionsById(current?.room_id || "")}</select></label>
        <div class="dm-temperature-actions"><button type="button" class="ed-btn-add" onclick="edTappAdd()">${current ? (english() ? "💾 Save changes" : "💾 Salva modifiche") : english() ? "＋ Add shutter" : "＋ Aggiungi tapparella"}</button>${current ? `<button type="button" class="ed-btn-secondary" onclick="edTappCancelEdit()">${english() ? "Cancel" : "Annulla"}</button>` : ""}</div>
      </div>`;
  }
  renderCoverEditor.__dmFinalOwner = true;
  renderCoverEditor.__dmResidualOwner = true;

  async function saveCover() {
    const entity = clean(doc.getElementById("ed-tp-ent")?.value);
    const name = clean(doc.getElementById("ed-tp-name")?.value) || entity;
    const roomId = clean(doc.getElementById("ed-tp-room")?.value);
    if (!/^cover\.[a-z0-9_]+$/i.test(entity)) {
      root.alert?.(english() ? "Enter a valid cover entity." : "Inserisci una entità cover valida.");
      return;
    }
    const value = { name, entity, entities: [entity], room_id: roomId, enabled: true };
    if (state.coverEditId) await store()?.updateItem?.("covers", state.coverEditId, value);
    else await store()?.addItem?.("covers", value);
    state.coverEditId = "";
    root.renderTapparelle?.();
    root.editorSwitch?.("tapp");
  }
  saveCover.__dmFinalOwner = true;

  function editCover(idOrIndex) {
    const list = canonicalCovers();
    const numeric = Number(idOrIndex);
    state.coverEditId = list.some((item) => clean(item.id) === clean(idOrIndex))
      ? clean(idOrIndex)
      : Number.isInteger(numeric) && list[numeric]
        ? clean(list[numeric].id)
        : "";
    root.editorSwitch?.("tapp");
  }
  editCover.__dmFinalOwner = true;

  async function deleteCover(idOrIndex) {
    const list = canonicalCovers();
    const numeric = Number(idOrIndex);
    const id = list.some((item) => clean(item.id) === clean(idOrIndex))
      ? clean(idOrIndex)
      : Number.isInteger(numeric) && list[numeric]
        ? clean(list[numeric].id)
        : "";
    if (!id) return;
    await store()?.removeItem?.("covers", id);
    if (state.coverEditId === id) state.coverEditId = "";
    root.editorSwitch?.("tapp");
  }
  deleteCover.__dmFinalOwner = true;

  function installCoverEditor() {
    if (!store()?.getSection) return false;
    root.getTapparelle = legacyCovers;
    root.editorRenderTapparelle = renderCoverEditor;
    root.edTappAdd = saveCover;
    root.edTappEdit = editCover;
    root.edTappDel = deleteCover;
    root.edTappCancelEdit = () => {
      state.coverEditId = "";
      root.editorSwitch?.("tapp");
    };
    return true;
  }

  function installStyles() {
    if (doc.getElementById("dm-runtime-residual-0150-style")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-residual-0150-style";
    style.textContent = `
      label:has(#dm-temperature-icon){display:none!important}
      .dm-temperature-actions button{min-height:44px!important}
      #page-appliances-main .appl-wide-card.dm-control-device{box-sizing:border-box!important;width:min(100%,409px)!important;max-width:409px!important}
      #page-appliances-main .dm-appliance-art-0154,
      #page-appliances-main .dm-appliance-art-0154>svg,
      #page-appliances-main .dm-appliance-image-wrap,
      #page-appliances-main .dm-appliance-image-0153{box-sizing:border-box!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important}
      #page-appliances-main .dm-appliance-image-wrap{display:block!important;overflow:hidden!important}
      #page-appliances-main .dm-appliance-image-0153{display:block!important;object-position:50% 50%!important}
    `;
    doc.head.append(style);
  }

  function applyResidualUi() {
    installStyles();
    normalizeManualReport();
    applyEditorTheme();
    applyTemperatureEditor();
    decorateLightEditor();
    normalizeApplianceCards();
    projectCurrentBundle();
  }

  function installAfter(name, after) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmResidualAfter) return typeof current === "function";
    function residualAfter0150(...args) {
      const result = current.apply(this, args);
      const finish = () => root.queueMicrotask?.(after);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    residualAfter0150.__dmResidualAfter = true;
    residualAfter0150.__dmFinalOwner = true;
    residualAfter0150.__dmPrevious = current;
    root[name] = residualAfter0150;
    return true;
  }

  function installListeners() {
    if (state.listeners) return;
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const reportButton = event.target?.closest?.("[data-report-add]");
        if (reportButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setManualReportState(
            reportButton,
            reportButton.getAttribute("aria-expanded") !== "true",
          );
          return;
        }
        const lightEdit = event.target?.closest?.("[data-residual-light-edit]");
        if (lightEdit) {
          event.preventDefault();
          event.stopImmediatePropagation();
          state.lightEditEntity = clean(lightEdit.dataset.residualLightEdit);
          decorateLightEditor();
        }
      },
      true,
    );
    doc.addEventListener(
      "change",
      (event) => {
        if (event.target?.id !== "dm-temperature-room") return;
        const room = (store()?.getSection?.("rooms") || []).find(
          (item) => clean(item.id) === clean(event.target.value),
        );
        const input = doc.getElementById("dm-temperature-icon");
        if (input) input.value = clean(room?.icon) || "mdi:home";
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:runtime-ready", () => {
      projectCurrentBundle();
      refreshDerivedEnergy(selectedDate());
      root.queueMicrotask?.(applyResidualUi);
    });
    root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
      projectCurrentBundle(event.detail);
      root.queueMicrotask?.(applyResidualUi);
    });
    root.addEventListener?.("dashboardmodern:energy-statistics", (event) => {
      const selected = event.detail?.selected ? new Date(event.detail.selected) : selectedDate();
      refreshDerivedEnergy(selected);
    });
    root.addEventListener?.("pageshow", () => root.queueMicrotask?.(applyResidualUi));
  }

  function subscribeStore() {
    if (state.subscribed || !store()?.subscribe) return false;
    store().subscribe((change) => {
      if (!["energy", "appliances", "lights", "covers", "rooms"].includes(change.section)) return;
      root.queueMicrotask?.(applyResidualUi);
      if (change.section === "energy" && change.status === "success") {
        refreshDerivedEnergy(selectedDate());
      }
    });
    state.subscribed = true;
    return true;
  }

  function settle() {
    state.attempts += 1;
    installDispatchGuard();
    installSafeEnergySwitch();
    installLightSave();
    installCoverEditor();
    installAfter("editorSwitch", applyResidualUi);
    installAfter("renderApplianceSection", normalizeApplianceCards);
    installAfter("renderAppliances", normalizeApplianceCards);
    installAfter("renderEnergy", applyResidualUi);
    installAfter("renderEnergyDashboard", applyResidualUi);
    subscribeStore();
    applyResidualUi();
    const ready = Boolean(store() && runtime() && typeof root.editorSwitch === "function");
    if (!ready && state.attempts < 180) root.requestAnimationFrame?.(settle);
  }

  installListeners();
  installStyles();
  installDispatchGuard();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
