import {
  applianceArtwork,
  canonicalArtworkType,
} from "../src/core/appliance-artwork.js";

/* DashboardModern 0.15.0 — deterministic final UI/transport guard. */
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
    ownerApply: null,
    dispatch: null,
    alertEdit: null,
    applying: false,
    currentFlowText: Object.create(null),
  });

  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;
  const readJson = (key, fallback) => {
    try {
      return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
    } catch (_error) {
      return fallback;
    }
  };
  const writeJson = (key, value) => root.localStorage?.setItem(key, JSON.stringify(value));

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
    const explicit =
      typeof root.__DASHBOARDMODERN_BRIDGE_WS__ === "function"
        ? root.__DASHBOARDMODERN_BRIDGE_WS__
        : null;
    const preloaded =
      typeof root.__DASHBOARDMODERN_PRELUDE_WS__ === "function"
        ? root.__DASHBOARDMODERN_PRELUDE_WS__
        : null;
    installSocketConstants(root.WebSocket);
    installSocketConstants(explicit);
    installSocketConstants(preloaded);

    if (explicit && root.WebSocket !== explicit) root.WebSocket = explicit;
    else if (typeof root.WebSocket !== "function" && preloaded) root.WebSocket = preloaded;
    if (!explicit && preloaded && typeof root.__DASHBOARDMODERN_BRIDGE_WS__ !== "function") {
      root.__DASHBOARDMODERN_BRIDGE_WS__ = preloaded;
    }
    state.bridgeAligned = typeof root.WebSocket === "function";
    return state.bridgeAligned;
  }

  function installStyles() {
    if (!doc || doc.getElementById("dm-runtime-regression-guard-0150")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-regression-guard-0150";
    style.textContent = `
      html body #page-appliances-main .appl-wide-card.dm-control-device{
        box-sizing:border-box!important;max-width:408px!important;
        max-height:190px!important;min-height:0!important;overflow:hidden!important
      }
      html body #page-appliances-main .appl-wide-card .appl-spark{display:none!important}
      html body #page-appliances-main .appl-visual{
        position:relative!important;box-sizing:border-box!important;
        height:100%!important;min-height:96px!important;overflow:hidden!important
      }
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{
        position:absolute!important;inset:0!important;display:block!important;
        box-sizing:border-box!important;width:100%!important;height:100%!important;
        min-width:100%!important;min-height:100%!important;max-width:none!important;
        max-height:none!important;margin:0!important;padding:0!important;overflow:hidden!important;
        transform:none!important
      }
      html body #page-appliances-main .dm-appliance-image,
      html body #page-appliances-main .dm-appliance-image-0153,
      html body #page-appliances-main .dm-appliance-art-0154>svg{
        position:absolute!important;inset:0!important;display:block!important;
        box-sizing:border-box!important;width:100%!important;height:100%!important;
        min-width:100%!important;min-height:100%!important;max-width:none!important;
        max-height:none!important;margin:0!important;padding:0!important;
        object-position:50% 50%!important;transform:none!important
      }
      html body #page-appliances-main .dm-appliance-image:not([src^="data:image"]){object-fit:cover!important}
      html body #page-appliances-main .dm-appliance-image[src^="data:image"]{object-fit:contain!important}
      #editor-modal [data-dm-final-alert-list]{display:block!important}
      #editor-modal [data-dm-final-alert-list] .ed-row{display:flex!important}
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

  function replaceMarkup(holder, markup) {
    const template = doc.createElement("template");
    template.innerHTML = markup;
    holder.replaceChildren(...template.content.childNodes);
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
      const visual = card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
      if (!visual) return;
      let holder = visual.querySelector(":scope > .appl-ic") || visual.querySelector(".appl-ic");
      if (!holder) {
        holder = doc.createElement("div");
        holder.className = "appl-ic";
        visual.prepend(holder);
      }

      visual.querySelectorAll("[data-dm-art],.dm-appliance-image-wrap").forEach((node) => {
        if (!holder.contains(node)) node.remove();
      });

      const token = clean(
        device.visual_key || device.device_type || device.icon || device.name || card.textContent,
      );
      const type = canonicalArtworkType(token);
      const imageUrl = clean(device.image || device.image_url);
      if (imageUrl) {
        const wrapper = doc.createElement("span");
        wrapper.className = "dm-appliance-image-wrap";
        const image = doc.createElement("img");
        image.className = "dm-appliance-image dm-appliance-image-0153";
        image.src = imageUrl;
        image.alt = clean(device.name);
        wrapper.append(image);
        holder.replaceChildren(wrapper);
        card.dataset.dmArtwork = "custom";
        card.dataset.dmMediaKind = "image";
      } else if (type) {
        replaceMarkup(holder, artworkMarkup(token, 96));
        card.dataset.dmArtwork = type;
        card.dataset.dmMediaKind = "asset";
      }

      const media = [...holder.querySelectorAll("[data-dm-art],.dm-appliance-image-wrap")];
      media.slice(1).forEach((node) => node.remove());
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      visual.dataset.applianceCover = "true";

      const toggle = card.querySelector('[data-dm-power-toggle="true"]');
      if (toggle) {
        card.querySelectorAll("button").forEach((button) => {
          if (button !== toggle && /^[⏻×✕]$/u.test(clean(button.textContent))) button.remove();
        });
      }
    });
    return true;
  }

  function alertName(entity) {
    return readJson("cd_avvisi_names_extra", {})[entity] || entity;
  }

  function bindFinalAlertEdit(button, group, entity) {
    button.type = "button";
    button.removeAttribute("onclick");
    button.classList.add("ed-del", "dm-edit-button");
    button.dataset.finalAlertEdit = "";
    button.dataset.realAlertEdit = "";
    button.dataset.standardAlertEdit = "";
    button.dataset.alertGroup = group;
    button.dataset.alertEntity = entity;
    button.textContent = "✏️";
    button.title = doc.documentElement.lang === "en" ? "Edit" : "Modifica";
    button.setAttribute("aria-label", button.title);
  }

  function normalizeAlertEditor() {
    if (!doc || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
    const body = doc.getElementById("ed-body");
    if (!body) return false;

    body.querySelectorAll("[data-dm-standard-alert-list],[data-dm-final-alert-list]").forEach((node) =>
      node.remove(),
    );
    body.querySelectorAll("[data-real-alert-edit],[data-standard-alert-edit]").forEach((button) => {
      button.removeAttribute("data-real-alert-edit");
      button.removeAttribute("data-standard-alert-edit");
      button.removeAttribute("data-final-alert-edit");
    });

    const entries = Object.entries(readJson("cd_gruppi_extra", {})).flatMap(([group, entities]) =>
      (entities || []).map((entity) => ({ group, entity })),
    );
    if (!entries.length) return true;

    const list = doc.createElement("section");
    list.dataset.dmFinalAlertList = "";
    body.prepend(list);

    entries.forEach(({ group, entity }) => {
      const rows = [...body.querySelectorAll(".ed-row")].filter((row) =>
        clean(row.textContent).includes(entity),
      );
      let row = rows.find((candidate) =>
        [...candidate.querySelectorAll("button")].some((button) =>
          /edDelAvviso/.test(button.getAttribute("onclick") || ""),
        ),
      );
      if (!row) {
        row = doc.createElement("article");
        row.className = "ed-row dm-standard-alert-row";
        row.innerHTML = `<div class="ed-row-main"><div class="ed-row-new"></div><div class="ed-row-old mono"></div></div>`;
        row.querySelector(".ed-row-new").textContent = alertName(entity);
        row.querySelector(".ed-row-old").textContent = entity;
      }
      list.append(row);
      let edit = row.querySelector("[data-final-alert-edit]");
      if (!edit) {
        edit = doc.createElement("button");
        const remove = [...row.querySelectorAll("button")].find((button) =>
          /edDelAvviso/.test(button.getAttribute("onclick") || "") || /🗑/u.test(button.textContent),
        );
        if (remove) remove.before(edit);
        else row.append(edit);
      }
      bindFinalAlertEdit(edit, group, entity);
    });
    return true;
  }

  function startAlertEdit(button) {
    const group = clean(button.dataset.alertGroup);
    const entity = clean(button.dataset.alertEntity);
    if (!group || !entity) return false;
    state.alertEdit = { group, entity };
    const groupInput = doc.getElementById("ed-avv-grp");
    const entityInput = doc.getElementById("ed-avv-ent");
    const nameInput = doc.getElementById("ed-avv-name");
    if (groupInput) groupInput.value = group;
    if (entityInput) entityInput.value = entity;
    if (nameInput) nameInput.value = alertName(entity);
    return true;
  }

  function saveAlertEdit() {
    if (!state.alertEdit) return false;
    const previous = state.alertEdit;
    const group = clean(doc.getElementById("ed-avv-grp")?.value) || previous.group;
    const entity = clean(doc.getElementById("ed-avv-ent")?.value);
    const name = clean(doc.getElementById("ed-avv-name")?.value);
    if (!entity.includes(".")) return true;
    const groups = readJson("cd_gruppi_extra", {});
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
    root.editorSwitch?.("avvisi");
    scheduleFinalApply();
    return true;
  }

  async function saveTemperature() {
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!roomId || !temp.includes(".") || !dashboardStore?.updateItem) {
      if (temp && !temp.includes(".")) {
        root.alert?.(
          doc.documentElement.lang === "en"
            ? "Enter a valid temperature entity"
            : "Inserisci un'entità temperatura valida",
        );
      }
      return false;
    }

    const sync = dashboardStore.syncAdapter;
    dashboardStore.syncAdapter = async () => {};
    try {
      const room = (dashboardStore.getSection("rooms") || []).find((item) => item.id === roomId);
      await dashboardStore.updateItem("rooms", roomId, {
        icon: clean(room?.icon) || "mdi:home",
        temp,
        hum,
      });
    } finally {
      dashboardStore.syncAdapter = sync;
    }
    root.buildTempCards?.();
    root.renderTemperature?.();
    root.editorSwitch?.("sez7");
    return true;
  }

  function numbers(value) {
    return (clean(value).match(/\d+(?:[.,]\d+)?/g) || [])
      .map((token) => Number(token.replace(",", ".")))
      .filter(Number.isFinite);
  }

  function captureCurrentFlow() {
    if (!doc) return false;
    const snapshot = Object.fromEntries(
      FLOW_IDS.map((id) => [id, clean(doc.getElementById(id)?.textContent)]),
    );
    const grid = numbers(snapshot["v-grid-month"]);
    const battery = numbers(snapshot["v-battery-month"]);
    const values = {
      solar: numbers(snapshot["v-solar-month"])[0],
      home: numbers(snapshot["v-home-month"])[0],
      gridImport: grid[0],
      gridExport: grid[1],
      batteryCharged: battery[0],
      batteryDischarged: battery[1],
    };
    if (!Object.values(values).some((value) => Number.isFinite(value) && value > 0)) return false;
    state.currentFlowText = snapshot;
    const mapped = Object.fromEntries(
      Object.entries(FLOW_SLOTS)
        .map(([key, slot]) => [slot, values[key]])
        .filter(([, value]) => Number.isFinite(value)),
    );
    [
      root.__DASHBOARDMODERN_RELEASE_OWNER_0150__?.currentMonth,
      root.__DASHBOARDMODERN_RELEASE_E2E_GUARD_0150__?.currentMonth,
    ]
      .filter(Boolean)
      .forEach((target) => Object.assign(target, mapped));
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(mapped);
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.merge?.(mapped);
    return true;
  }

  function restoreCurrentFlow() {
    Object.entries(state.currentFlowText).forEach(([id, value]) => {
      const node = doc?.getElementById(id);
      if (node && value && node.textContent !== value) node.textContent = value;
    });
  }

  function installDispatchOwner() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current === state.dispatch) return false;
    function finalDispatch(event) {
      if (event?.type === "dashboardmodern:energy-periods-0154") captureCurrentFlow();
      const result = current.call(this, event);
      if (event?.type === "dashboardmodern:energy-periods-0154") {
        root.queueMicrotask?.(restoreCurrentFlow);
        [0, 40, 140, 320].forEach((delay) => root.setTimeout?.(restoreCurrentFlow, delay));
      }
      return result;
    }
    finalDispatch.__dmFinalOwner0150 = true;
    state.dispatch = finalDispatch;
    root.dispatchEvent = finalDispatch;
    return true;
  }

  function installOwnerWrapper() {
    const owner = root.__DASHBOARDMODERN_RELEASE_OWNER_0150__;
    const current = owner?.apply;
    if (typeof current !== "function" || current === state.ownerApply) return false;
    function finalOwnerApply() {
      const result = current.apply(this, arguments);
      root.queueMicrotask?.(finalizeDom);
      root.setTimeout?.(finalizeDom, 0);
      return result;
    }
    finalOwnerApply.__dmFinalOwner0150 = true;
    state.ownerApply = finalOwnerApply;
    owner.apply = finalOwnerApply;
    return true;
  }

  function wrapRender(name) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmFinalOwner0150) return false;
    function finalRender() {
      const result = current.apply(this, arguments);
      const finish = () => scheduleFinalApply();
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    Object.assign(finalRender, current);
    finalRender.__dmFinalOwner0150 = true;
    finalRender.__dmPrevious = current;
    root[name] = finalRender;
    return true;
  }

  function bindStore() {
    const current = store();
    if (!current || state.store === current) return Boolean(current);
    state.unsubscribe?.();
    state.store = current;
    state.unsubscribe = current.subscribe?.((change) => {
      if (["appliances", "rooms", "snapshot"].includes(change?.section)) scheduleFinalApply();
    });
    return true;
  }

  function finalizeDom() {
    if (state.applying) return;
    state.applying = true;
    try {
      alignBridge();
      installStyles();
      installArtworkFacade();
      normalizeApplianceArtwork();
      normalizeAlertEditor();
      installDispatchOwner();
      installOwnerWrapper();
      ["renderApplianceSection", "editorSwitch", "buildTempCards", "renderTemperature"].forEach(
        wrapRender,
      );
      bindStore();
    } finally {
      state.applying = false;
    }
  }

  function scheduleFinalApply() {
    root.queueMicrotask?.(finalizeDom);
    [0, 40, 140].forEach((delay) => root.setTimeout?.(finalizeDom, delay));
  }

  function handleClick(event) {
    const alertEdit = event.target?.closest?.("[data-final-alert-edit]");
    if (alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startAlertEdit(alertEdit);
      return;
    }
    const alertSave = event.target?.closest?.('button[onclick="edAddAvviso()"]');
    if (alertSave && state.alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAlertEdit();
      return;
    }
    const temperature = event.target?.closest?.("[data-temperature-submit]");
    if (temperature) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveTemperature().catch((error) => root.console?.warn?.("Temperature save", error));
      return;
    }
    scheduleFinalApply();
  }

  alignBridge();
  installStyles();
  doc?.addEventListener?.("click", handleClick, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleFinalApply);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleFinalApply);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleFinalApply);
  root.addEventListener?.("pageshow", scheduleFinalApply);
  scheduleFinalApply();
  [50, 180, 500, 900, 1600].forEach((delay) => root.setTimeout?.(finalizeDom, delay));
})(globalThis);
