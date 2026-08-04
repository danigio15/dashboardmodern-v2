import {
  applianceArtwork,
  canonicalArtworkType,
} from "../src/core/appliance-artwork.js";

/* DashboardModern 0.15.0 — transport and deterministic UI regression guard. */
(function installRuntimeRegressionGuard0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__";
  if (root[KEY]?.installed) return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    bridgeAligned: false,
    store: null,
    unsubscribe: null,
    currentFlowText: Object.create(null),
    currentFlowSlots: Object.create(null),
    savingTemperature: false,
    alertEdit: null,
  });

  const FLOW_IDS = Object.freeze([
    "v-solar-month",
    "v-home-month",
    "v-grid-month",
    "v-battery-month",
  ]);
  const FLOW_SLOTS = Object.freeze({
    solar: "dm.energy_produzione_solare_mese",
    home: "dm.energy_consumo_casa_mese",
    gridImport: "dm.energy_rete_acquistata_mese",
    gridExport: "dm.energy_rete_venduta_mese",
    batteryCharged: "dm.energy_batteria_caricata_mese",
    batteryDischarged: "dm.energy_batteria_usata_mese",
  });

  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;
  const numbers = (value) =>
    (clean(value).match(/\d+(?:[.,]\d+)?/g) || [])
      .map((token) => Number(token.replace(",", ".")))
      .filter(Number.isFinite);

  function installSocketConstants(Socket) {
    if (typeof Socket !== "function") return false;
    [
      ["CONNECTING", 0],
      ["OPEN", 1],
      ["CLOSING", 2],
      ["CLOSED", 3],
    ].forEach(([name, value]) => {
      if (Socket[name] != null) return;
      try {
        Object.defineProperty(Socket, name, { value, configurable: true });
      } catch (_error) {}
    });
    return true;
  }

  function alignBridge() {
    const current = root.WebSocket;
    const explicitBridge =
      typeof root.__DASHBOARDMODERN_BRIDGE_WS__ === "function"
        ? root.__DASHBOARDMODERN_BRIDGE_WS__
        : null;
    const preloaded =
      typeof root.__DASHBOARDMODERN_PRELUDE_WS__ === "function"
        ? root.__DASHBOARDMODERN_PRELUDE_WS__
        : null;

    installSocketConstants(current);
    installSocketConstants(explicitBridge);
    installSocketConstants(preloaded);

    if (explicitBridge && current !== explicitBridge) root.WebSocket = explicitBridge;
    else if (typeof current !== "function" && preloaded) root.WebSocket = preloaded;

    state.bridgeAligned = explicitBridge
      ? root.WebSocket === explicitBridge
      : typeof root.WebSocket === "function";
    const reconnect = root.__DASHBOARDMODERN_LEGACY_RECONNECT__;
    if (state.bridgeAligned && reconnect?.timer) {
      root.clearTimeout?.(reconnect.timer);
      reconnect.timer = 0;
      reconnect.cancelled = true;
    }
    return state.bridgeAligned;
  }

  function installStyles() {
    if (!doc || doc.getElementById("dm-runtime-regression-guard-0150")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-regression-guard-0150";
    style.textContent = `
      #page-appliances-main .appl-visual,
      #page-appliances-main .appl-ic {
        position:relative!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
      }
      #page-appliances-main .dm-appliance-image-wrap,
      #page-appliances-main .dm-appliance-art,
      #page-appliances-main .dm-appliance-art-0154,
      #page-appliances-main [data-dm-art] {
        position:absolute!important;
        inset:0!important;
        display:block!important;
        box-sizing:border-box!important;
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        max-width:none!important;
        max-height:none!important;
        overflow:hidden!important;
      }
      #page-appliances-main img.dm-appliance-image,
      #page-appliances-main img.dm-appliance-image-0153,
      #page-appliances-main .dm-appliance-art > svg,
      #page-appliances-main .dm-appliance-art-0154 > svg,
      #page-appliances-main [data-dm-art] > svg {
        position:absolute!important;
        inset:0!important;
        display:block!important;
        box-sizing:border-box!important;
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        max-width:none!important;
        max-height:none!important;
      }
      #page-appliances-main img.dm-appliance-image,
      #page-appliances-main img.dm-appliance-image-0153 {
        object-fit:cover!important;
        object-position:50% 50%!important;
      }
    `;
    (doc.head || doc.documentElement).append(style);
  }

  function legacyArtworkKey(type) {
    return {
      oven: "forno",
      fridge: "frigo",
      microwave: "microonde",
      boiler: "boiler",
      washer: "lavatrice",
      dryer: "asciugatrice",
      dishwasher: "lavastoviglie",
      cooktop: "piano-cottura",
      television: "televisione",
    }[type] || type;
  }

  function artworkMarkup(value, size = 96) {
    const type = canonicalArtworkType(value);
    if (!type) return "";
    const key = legacyArtworkKey(type);
    return applianceArtwork(type, size).replace(
      '<span class="dm-appliance-art dm-appliance-art-0154"',
      `<span class="dm-appliance-art dm-appliance-art-0154" data-appliance-asset="${key}" data-appliance-asset-key="${key}"`,
    );
  }

  function installArtworkFacade() {
    const current = root.cdApplianceIcon;
    if (current?.__dmRuntime0150Artwork) return true;
    const original = typeof current === "function" ? current : null;

    function patchedApplianceIcon(value, size = 96) {
      return artworkMarkup(value, size) || original?.apply(this, arguments) || "";
    }

    patchedApplianceIcon.__dmRuntime0150Artwork = true;
    patchedApplianceIcon.__dmOriginal = original;
    root.cdApplianceIcon = patchedApplianceIcon;
    return true;
  }

  function applianceHolder(card) {
    let holder = card.querySelector(".appl-ic");
    if (holder) return holder;
    const visual = card.querySelector(".appl-visual") || card;
    holder = doc.createElement("div");
    holder.className = "appl-ic";
    visual.prepend(holder);
    return holder;
  }

  function removeDuplicateMedia(card, holder, canonical) {
    card
      .querySelectorAll("[data-appliance-asset], [data-dm-art], .dm-appliance-image-wrap")
      .forEach((node) => {
        if (node === canonical || canonical?.contains(node) || node.contains(canonical)) return;
        if (holder.contains(node) || !node.closest(".appl-ic") || node.closest(".appl-ic") !== holder) {
          node.remove();
        }
      });
  }

  function normalizeApplianceArtwork() {
    if (!doc) return false;
    installStyles();
    installArtworkFacade();

    const devices = store()?.getSection?.("appliances") || [];
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card, index) => {
      const device =
        devices.find((item) => clean(item?.id) === clean(card.dataset.applianceId)) ||
        devices[index] ||
        {};
      const holder = applianceHolder(card);
      const token = clean(
        device.visual_key || device.device_type || device.icon || device.name || card.textContent,
      );
      const type = canonicalArtworkType(token);
      const explicitImage = clean(device.image || device.image_url);

      if (explicitImage) {
        holder.querySelectorAll("[data-appliance-asset], [data-dm-art]").forEach((node) => node.remove());
        let image = holder.querySelector("img.dm-appliance-image, img");
        if (!image) image = doc.createElement("img");
        image.src = explicitImage;
        image.alt = clean(device.name);
        image.classList.add("dm-appliance-image", "dm-appliance-image-0153");
        let wrapper = image.closest(".dm-appliance-image-wrap");
        if (!wrapper || wrapper.parentElement !== holder) {
          wrapper = doc.createElement("span");
          wrapper.className = "dm-appliance-image-wrap";
          wrapper.append(image);
          holder.replaceChildren(wrapper);
        }
        removeDuplicateMedia(card, holder, wrapper);
        card.dataset.dmMediaKind = "image";
        card.dataset.dmArtwork = "custom";
      } else if (type) {
        holder.querySelectorAll(".dm-appliance-image-wrap, img.dm-appliance-image").forEach((node) => node.remove());
        const expected = legacyArtworkKey(type);
        let canonical = holder.querySelector(`[data-appliance-asset="${expected}"]`);
        if (!canonical) {
          holder.innerHTML = artworkMarkup(token, 96);
          canonical = holder.querySelector(`[data-appliance-asset="${expected}"]`);
        }
        removeDuplicateMedia(card, holder, canonical);
        card.dataset.dmMediaKind = "asset";
        card.dataset.dmArtwork = type;
        card.dataset.dmArtStyle = "panel";
      }
    });
    return true;
  }

  function hideLegacyTemperatureIcon() {
    const form = doc?.querySelector?.("#editor-modal [data-temperature-form]");
    if (!form) return false;
    form.querySelectorAll("label.ed-slot, label").forEach((label) => {
      if (!/(^|\s)(Simbolo|Icon)(\s|$)/i.test(clean(label.textContent))) return;
      const input = label.querySelector("#dm-temperature-icon, #ed-pl-icon, input");
      if (input) {
        input.type = "hidden";
        input.hidden = true;
        input.setAttribute("aria-hidden", "true");
        form.append(input);
      }
      label.remove();
    });
    return true;
  }

  function currentFlowValues() {
    const solar = numbers(doc?.getElementById("v-solar-month")?.textContent)[0];
    const home = numbers(doc?.getElementById("v-home-month")?.textContent)[0];
    const grid = numbers(doc?.getElementById("v-grid-month")?.textContent);
    const battery = numbers(doc?.getElementById("v-battery-month")?.textContent);
    return {
      solar,
      home,
      gridImport: grid[0],
      gridExport: grid[1],
      batteryCharged: battery[0],
      batteryDischarged: battery[1],
    };
  }

  function protectOwnerSlots(owner, mapped) {
    if (!owner || typeof owner !== "object") return;
    Object.entries(mapped).forEach(([slot, value]) => {
      if (Number.isFinite(value) && (value > 0 || state.currentFlowSlots[slot] == null)) {
        state.currentFlowSlots[slot] = Math.max(0, value);
      }
      const descriptor = Object.getOwnPropertyDescriptor(owner, slot);
      if (descriptor?.configurable === false || descriptor?.get?.__dmCurrentFlow0150) {
        try {
          owner[slot] = state.currentFlowSlots[slot];
        } catch (_error) {}
        return;
      }
      const getter = function currentFlowSlot0150() {
        return state.currentFlowSlots[slot] ?? 0;
      };
      getter.__dmCurrentFlow0150 = true;
      try {
        Object.defineProperty(owner, slot, {
          configurable: true,
          enumerable: true,
          get: getter,
          set(raw) {
            const next = Number(raw);
            if (!Number.isFinite(next)) return;
            if (next > 0 || state.currentFlowSlots[slot] == null) {
              state.currentFlowSlots[slot] = Math.max(0, next);
            }
          },
        });
      } catch (_error) {
        try {
          owner[slot] = state.currentFlowSlots[slot];
        } catch (_ignored) {}
      }
    });
  }

  function publishCurrentFlowValues(values) {
    const mapped = Object.fromEntries(
      Object.entries(FLOW_SLOTS)
        .map(([key, slot]) => [slot, values[key]])
        .filter(([, value]) => Number.isFinite(value)),
    );
    if (!Object.keys(mapped).length) return false;

    const owners = [
      root.__DASHBOARDMODERN_RELEASE_OWNER_0150__?.currentMonth,
      root.__DASHBOARDMODERN_RELEASE_E2E_GUARD_0150__?.currentMonth,
      root.__DASHBOARDMODERN_RUNTIME_COMPATIBILITY_0150__?.currentMonth,
    ].filter(Boolean);
    owners.forEach((owner) => protectOwnerSlots(owner, mapped));
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(mapped);
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.merge?.(mapped);
    return true;
  }

  function captureCurrentFlow() {
    if (!doc) return false;
    const snapshot = Object.fromEntries(
      FLOW_IDS.map((id) => [id, clean(doc.getElementById(id)?.textContent)]),
    );
    const values = currentFlowValues();
    if (!Object.values(values).some((value) => Number.isFinite(value) && value > 0)) return false;
    state.currentFlowText = snapshot;
    publishCurrentFlowValues(values);
    return true;
  }

  function restoreCurrentFlow() {
    if (!doc || !Object.keys(state.currentFlowText).length) return false;
    Object.entries(state.currentFlowText).forEach(([id, text]) => {
      const node = doc.getElementById(id);
      if (node && node.textContent !== text) node.textContent = text;
    });
    publishCurrentFlowValues(currentFlowValues());
    return true;
  }

  function protectCurrentFlow() {
    captureCurrentFlow();
    root.queueMicrotask?.(restoreCurrentFlow);
    [0, 40, 140, 320, 700, 1600, 3600, 6200].forEach((delay) =>
      root.setTimeout?.(restoreCurrentFlow, delay),
    );
  }

  function installDispatchFacade() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current.__dmRuntimeRegression0150) return false;
    function dispatchEvent0150(event) {
      if (event?.type === "dashboardmodern:energy-periods-0154") protectCurrentFlow();
      return current.call(this, event);
    }
    dispatchEvent0150.__dmRuntimeRegression0150 = true;
    dispatchEvent0150.__dmPrevious = current;
    root.dispatchEvent = dispatchEvent0150;
    return true;
  }

  function applyRoomSnapshot(dashboardStore, roomId, patch) {
    if (!dashboardStore?.applySnapshot) return false;
    const snapshot = dashboardStore.getState();
    const rooms = (snapshot.sections?.rooms || []).map((room) =>
      clean(room.id) === roomId ? { ...room, ...patch } : room,
    );
    dashboardStore.applySnapshot({
      ...snapshot,
      sections: { ...(snapshot.sections || {}), rooms },
    });
    return true;
  }

  async function persistTemperature() {
    if (state.savingTemperature) return false;
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!roomId || !dashboardStore) return false;
    if (!temp.includes(".")) {
      root.alert?.(
        doc.documentElement.lang === "en"
          ? "Enter a valid temperature entity"
          : "Inserisci un'entità temperatura valida",
      );
      return false;
    }

    const room = (dashboardStore.getSection("rooms") || []).find(
      (item) => clean(item.id) === roomId,
    );
    const patch = {
      icon: clean(doc.getElementById("dm-temperature-icon")?.value) || clean(room?.icon) || "mdi:home",
      temp,
      hum,
    };

    state.savingTemperature = true;
    try {
      let persisted = false;
      if (dashboardStore.updateItem) {
        try {
          await dashboardStore.updateItem("rooms", roomId, patch);
          const saved = (dashboardStore.getSection("rooms") || []).find(
            (item) => clean(item.id) === roomId,
          );
          persisted = clean(saved?.temp) === temp && clean(saved?.hum) === hum;
        } catch (_error) {}
      }
      if (!persisted) persisted = applyRoomSnapshot(dashboardStore, roomId, patch);
      try {
        await Promise.resolve(root.cdSyncPush?.());
      } catch (_error) {
        // Offline/local edits remain canonical and will be synchronized later.
      }
      root.buildTempCards?.();
      root.renderTemperature?.();
      root.editorSwitch?.("sez7");
      return persisted;
    } finally {
      state.savingTemperature = false;
    }
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
  }

  function readAlertGroups() {
    return readJson("cd_gruppi_extra", {});
  }

  function alertEntityFromRow(row) {
    const text = row.querySelector(".ed-row-old.mono")?.textContent || row.textContent || "";
    return text.match(/\b[a-z_][a-z0-9_]*\.[a-z0-9_]+\b/i)?.[0] || "";
  }

  function alertGroupForEntity(entity, row) {
    const saved = Object.entries(readAlertGroups()).find(
      ([, ids]) => Array.isArray(ids) && ids.includes(entity),
    );
    if (saved) return saved[0];
    const text = `${row.textContent || ""} ${
      row.closest("details")?.querySelector("summary")?.textContent || ""
    }`.toLowerCase();
    if (/apert|contact|door|window/.test(text)) return "win";
    if (/batter/.test(text)) return "batt";
    if (/luc|light/.test(text)) return "luci";
    if (/clima|climate/.test(text)) return "clima";
    if (/riscald|heating/.test(text)) return "risc";
    return "";
  }

  function alertName(entity) {
    const names = readJson("cd_avvisi_names_extra", {});
    return clean(names[entity]) || clean(root.STATES?.[entity]?.attributes?.friendly_name) || entity;
  }

  function invokeAlertEdit(button) {
    const group = clean(button.dataset.alertGroup);
    const entity = clean(button.dataset.alertEntity);
    if (!group || !entity) return false;
    state.alertEdit = { group, entity };
    const owner = root.__DASHBOARDMODERN_RELEASE_OWNER_0150__;
    if (owner) owner.alertEdit = { group, entity };
    const groupInput = doc.getElementById("ed-avv-grp");
    const entityInput = doc.getElementById("ed-avv-ent");
    const nameInput = doc.getElementById("ed-avv-name");
    if (groupInput) groupInput.value = group;
    if (entityInput) entityInput.value = entity;
    if (nameInput) nameInput.value = alertName(entity);
    return true;
  }

  function saveAlertEdit() {
    const previous = state.alertEdit;
    if (!previous) return false;
    const group = clean(doc.getElementById("ed-avv-grp")?.value) || previous.group;
    const entity = clean(doc.getElementById("ed-avv-ent")?.value) || previous.entity;
    const name = clean(doc.getElementById("ed-avv-name")?.value);
    if (!entity.includes(".")) return false;

    const groups = readAlertGroups();
    const names = readJson("cd_avvisi_names_extra", {});
    if (Array.isArray(groups[previous.group])) {
      groups[previous.group] = groups[previous.group].filter((id) => id !== previous.entity);
    }
    groups[group] ||= [];
    if (!groups[group].includes(entity)) groups[group].push(entity);
    delete names[previous.entity];
    if (name) names[entity] = name;
    writeJson("cd_gruppi_extra", groups);
    writeJson("cd_avvisi_names_extra", names);
    state.alertEdit = null;
    const owner = root.__DASHBOARDMODERN_RELEASE_OWNER_0150__;
    if (owner) owner.alertEdit = null;
    root.editorSwitch?.("avvisi");
    return true;
  }

  function bindAlertEditButton(button, group, entity) {
    button.removeAttribute("onclick");
    button.type = "button";
    button.classList.add("ed-del", "dm-edit-button");
    button.dataset.standardAlertEdit = "";
    button.dataset.realAlertEdit = "";
    button.dataset.standardAlertGroup = group;
    button.dataset.standardAlertEntity = entity;
    button.dataset.alertGroup = group;
    button.dataset.alertEntity = entity;
    button.textContent = "✏️";
    button.title = doc.documentElement.lang === "en" ? "Edit" : "Modifica";
    button.setAttribute("aria-label", button.title);
  }

  function installAlertEditButtons() {
    if (!doc) return false;
    doc.querySelectorAll("#editor-modal [data-dm-standard-alert-list]").forEach((node) => node.remove());
    doc.querySelectorAll("#editor-modal details").forEach((details) => {
      details.open = true;
    });
    doc.querySelectorAll("#editor-modal .ed-row").forEach((row) => {
      const entity = alertEntityFromRow(row);
      const group = entity && alertGroupForEntity(entity, row);
      if (!entity || !group) return;

      let edit = row.querySelector("[data-standard-alert-edit], [data-real-alert-edit]");
      if (!edit) {
        const remove = [...row.querySelectorAll(".ed-del")].find((button) =>
          /edDelAvviso/.test(button.getAttribute("onclick") || "") ||
          button.textContent.includes("🗑️"),
        );
        if (!remove) return;
        edit = doc.createElement("button");
        remove.before(edit);
      }
      bindAlertEditButton(edit, group, entity);
      row
        .querySelectorAll("[data-standard-alert-edit], [data-real-alert-edit]")
        .forEach((candidate) => {
          if (candidate !== edit) candidate.remove();
        });
    });
    return true;
  }

  function capturePrimaryInteractions(event) {
    const temperature = event.target?.closest?.("[data-temperature-submit]");
    if (temperature) {
      event.preventDefault();
      event.stopImmediatePropagation();
      persistTemperature().catch((error) => root.console?.warn?.("Temperature save", error));
      return;
    }

    const alertEdit = event.target?.closest?.(
      "[data-standard-alert-edit], [data-real-alert-edit]",
    );
    if (alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      invokeAlertEdit(alertEdit);
      return;
    }

    const alertSave = event.target?.closest?.(
      'button[onclick="edAddAvviso()"], button[onclick*="edAddAvviso"]',
    );
    if (alertSave && state.alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAlertEdit();
    }
  }

  function installEditorFacade() {
    const current = root.editorSwitch;
    if (typeof current !== "function" || current.__dmRuntime0150Review) return false;

    function patchedEditorSwitch() {
      const result = current.apply(this, arguments);
      scheduleApply();
      return result;
    }

    Object.assign(patchedEditorSwitch, current);
    patchedEditorSwitch.__dmRuntime0150Review = true;
    patchedEditorSwitch.__dmOriginal = current;
    root.editorSwitch = patchedEditorSwitch;
    return true;
  }

  function apply() {
    alignBridge();
    installDispatchFacade();
    normalizeApplianceArtwork();
    hideLegacyTemperatureIcon();
    installAlertEditButtons();
    installEditorFacade();
    captureCurrentFlow();
    bindStore();
  }

  function scheduleApply() {
    root.queueMicrotask?.(apply);
    root.setTimeout?.(apply, 0);
    [40, 140, 360].forEach((delay) => {
      root.setTimeout?.(normalizeApplianceArtwork, delay);
      root.setTimeout?.(installAlertEditButtons, delay);
    });
    root.setTimeout?.(hideLegacyTemperatureIcon, 40);
  }

  function bindStore() {
    const current = store();
    if (!current || state.store === current) return Boolean(current);
    state.unsubscribe?.();
    state.store = current;
    state.unsubscribe = current.subscribe?.((change) => {
      if (["appliances", "rooms", "snapshot"].includes(change?.section)) scheduleApply();
    });
    return true;
  }

  state.alignBridge = alignBridge;
  state.normalizeApplianceArtwork = normalizeApplianceArtwork;
  state.installAlertEditButtons = installAlertEditButtons;
  state.captureCurrentFlow = captureCurrentFlow;
  state.restoreCurrentFlow = restoreCurrentFlow;
  state.apply = apply;

  alignBridge();
  installStyles();
  root.addEventListener?.("click", capturePrimaryInteractions, true);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-periods-0154", protectCurrentFlow, true);
  root.addEventListener?.("pageshow", scheduleApply);
  doc?.addEventListener?.("click", scheduleApply, true);

  scheduleApply();
  [50, 180, 500, 900].forEach((delay) => root.setTimeout?.(apply, delay));
})(globalThis);
