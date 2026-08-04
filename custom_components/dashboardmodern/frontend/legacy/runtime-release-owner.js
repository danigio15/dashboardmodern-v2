/* DashboardModern 0.15.0 — deterministic release owner for retained UI contracts. */
(function installReleaseOwner0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RELEASE_OWNER_0150__";
  if (root[KEY]?.installed || !root.document) return;
  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    currentMonth: Object.create(null),
    timers: new Set(),
    lightEditEntity: "",
    alertEdit: null,
    savingTemperature: false,
  });

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });

  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : null;
  };
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const store = () => root.DashboardModernModules?.store || null;
  const runtimeState = () => root.__DASHBOARDMODERN_RUNTIME_0150__ || null;

  function lexical(name, fallback = null) {
    try {
      return root.eval?.(`typeof ${name} !== "undefined" ? ${name} : null`) || fallback;
    } catch (_error) {
      return root[name] || fallback;
    }
  }

  function periodRegistry() {
    return lexical("CD_PERIOD", root.CD_PERIOD || (root.CD_PERIOD = {}));
  }

  function bundleIsCurrent(bundle) {
    if (!bundle?.period) return false;
    const now = new Date();
    return (
      Number(bundle.period.month) === now.getMonth() + 1 &&
      Number(bundle.period.year) === now.getFullYear()
    );
  }

  function captureCurrent(bundle = runtimeState()?.bundle) {
    if (!bundleIsCurrent(bundle) || !bundle?.month) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      const value = finite(bundle.month[key]);
      if (value != null) state.currentMonth[slot] = value;
    });
    restoreCurrent();
    return true;
  }

  function restoreCurrent() {
    if (!Object.keys(state.currentMonth).length) return false;
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(state.currentMonth);
    const registries = [periodRegistry(), root.CD_PERIOD].filter(Boolean);
    [...new Set(registries)].forEach((registry) => {
      Object.entries(state.currentMonth).forEach(([slot, value]) => {
        try {
          registry[slot] = value;
        } catch (_error) {}
      });
    });
    return true;
  }

  function onPeriodBundle(bundle) {
    if (bundleIsCurrent(bundle)) {
      captureCurrent(bundle);
      return;
    }
    root.queueMicrotask?.(restoreCurrent);
    [20, 60, 140, 320, 700].forEach((delay) => root.setTimeout?.(restoreCurrent, delay));
  }

  function disabledObserver() {
    return Object.freeze({ disabled: true, disconnect() {}, observe() {} });
  }

  function retireObserver(owner, key, replacement = null) {
    if (!owner) return;
    try {
      owner[key]?.disconnect?.();
    } catch (_error) {}
    try {
      Object.defineProperty(owner, key, {
        configurable: true,
        enumerable: false,
        get: () => replacement,
        set: (next) => {
          try {
            next?.disconnect?.();
          } catch (_error) {}
        },
      });
    } catch (_error) {
      try {
        owner[key] = replacement;
      } catch (_ignored) {}
    }
  }

  function disableLegacyOwners() {
    root.__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__ = true;
    retireObserver(root, "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__", null);
    retireObserver(root, "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__", null);
    retireObserver(root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__, "observer", disabledObserver());
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154__, "domObserver", disabledObserver());
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__, "observer", disabledObserver());
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__, "styleObserver", disabledObserver());
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__, "observer", null);
  }

  function publishContracts() {
    const contracts = {
      __DASHBOARDMODERN_0147_FIXES__: { installed: true, patched: true },
      __DASHBOARDMODERN_0147_APPLIANCE_THEME__: { installed: true },
      __DASHBOARDMODERN_0147_EDITOR_THEME__: { installed: true },
      __DASHBOARDMODERN_0147_REPORT_POLISH__: { installed: true },
      __DASHBOARDMODERN_REAL_HA_0147__: { installed: true },
      __DASHBOARDMODERN_RELEASE_0150__: { installed: true },
      __DASHBOARDMODERN_RELEASE_0151__: { installed: true },
    };
    Object.entries(contracts).forEach(([key, value]) => {
      root[key] = { ...(root[key] || {}), ...value, version: "0.15.0" };
    });
    root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ = {
      ...(root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ || {}),
      installed: true,
      version: "0.15.0",
      observer: disabledObserver(),
    };
    root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ || {}),
      installed: true,
      version: "0.15.0",
      observer: null,
      observerVersion: 3,
    };
    const broker = root.DashboardModernRuntime0150?.broker;
    if (broker && Number(broker.nextId) < 152000) broker.nextId = 152000;
  }

  function installStyles() {
    if (doc.getElementById("dm-runtime-release-owner-style")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-release-owner-style";
    style.textContent = `
      [data-report-manual][hidden]{display:none!important}
      html body #page-appliances-main .appl-wide-card.dm-control-device{width:min(100%,409px)!important;max-width:409px!important;box-sizing:border-box!important;min-height:0!important}
      html body #page-appliances-main .appl-spark{display:none!important}
      html body #page-appliances-main .appl-visual,
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important}
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{display:grid!important;place-items:center!important}
      html body #page-appliances-main .dm-appliance-image,
      html body #page-appliances-main .dm-appliance-art-0154>svg{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;object-position:50% 50%!important}
      html body #page-appliances-main .dm-appliance-image:not([src^="data:image"]){object-fit:cover!important}
      html body #page-appliances-main .dm-appliance-image[src^="data:image"]{object-fit:contain!important}
      html body #page-appliances-main .dm-appliance-power-toggle{min-height:40px;padding:8px 14px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer}
      #temp-grid .temp-card{min-height:110px!important}
      #temp-grid .temp-room-icon{display:inline-grid;place-items:center;min-width:28px;min-height:28px;margin-right:8px}
      #editor-modal [data-temperature-form] label:has(#dm-temperature-icon){display:none!important}
      #editor-modal .dm-temperature-actions button{min-height:44px!important}
      #dm-shutter-popup header{position:relative!important;display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:48px!important;padding-right:56px!important}
      #dm-shutter-popup [data-shutter-popup-close]{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important}
      #dm-shutter-popup .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #dm-shutter-popup .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important}
      .dm-standard-alert-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;margin:8px 0;border:1px solid var(--card-border,#dbe4ee);border-radius:14px}
    `;
    doc.head.append(style);
  }

  function canonicalArtwork(value) {
    const token = clean(value).toLowerCase();
    if (/microonde|microwave/.test(token)) return "microwave";
    if (/forno|oven|stove/.test(token)) return "oven";
    if (/frigo|fridge|refriger|freezer|congelatore/.test(token)) return "fridge";
    if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) return "boiler";
    if (/lavatrice|washer|washing[_ -]?machine/.test(token)) return "washer";
    if (/asciugatrice|dryer/.test(token)) return "dryer";
    if (/lavastoviglie|dishwasher/.test(token)) return "dishwasher";
    if (/piano[_ -]?cottura|cooktop|hob/.test(token)) return "cooktop";
    if (/televis|\btv\b|monitor/.test(token)) return "television";
    return token || "generic";
  }

  function artworkMarkup(canonical, source) {
    const glyph = {
      oven: "♨",
      fridge: "❄",
      microwave: "〰",
      boiler: "⇩",
      washer: "◉",
      dryer: "≋",
      dishwasher: "▦",
      cooktop: "●",
      television: "▶",
    }[canonical] || "⚙";
    return `<span class="dm-appliance-art dm-appliance-art-0154" data-dm-art="${canonical}" data-dm-art-style="panel" data-appliance-asset="${source}" data-appliance-asset-key="${source}"><svg viewBox="0 0 96 96" role="img" aria-hidden="true"><rect class="dm-art-panel" x="2" y="2" width="92" height="92" rx="20" fill="#e0f2fe"/><rect x="15" y="12" width="66" height="72" rx="12" fill="#0f2942"/><text x="48" y="60" text-anchor="middle" font-size="34" fill="#8be2ff">${glyph}</text></svg></span>`;
  }

  function ensurePowerToggle(card, device, states) {
    const entity = clean(device?.control_entity);
    if (!entity) return;
    card.classList.add("dm-control-device");
    let button = card.querySelector('[data-dm-power-toggle="true"]');
    if (!button) {
      button = doc.createElement("button");
      button.type = "button";
      button.className = "dm-appliance-power-toggle";
      button.dataset.dmPowerToggle = "true";
      (card.querySelector(".appl-actions,.appl-wide-actions,.appl-wide-body") || card).append(button);
    }
    const on = clean(states[entity]?.state).toLowerCase() === "on";
    button.dataset.entity = entity;
    button.dataset.state = on ? "on" : "off";
    button.textContent = on
      ? english()
        ? "Turn off"
        : "Spegni"
      : english()
        ? "Turn on"
        : "Accendi";
  }

  function normalizeAppliances() {
    const devices = store()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    const states = { ...(lexical("_RAW_STATES", {}) || {}), ...(lexical("STATES", {}) || {}) };
    doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach((card, index) => {
      const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
      if (!device) return;
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      const visual = card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
      if (!visual) return;
      let icon = visual.querySelector(".appl-ic");
      if (!icon) {
        icon = doc.createElement("div");
        icon.className = "appl-ic";
        visual.replaceChildren(icon);
      }
      const source = clean(device.visual_key || device.device_type || device.name).toLowerCase();
      const canonical = canonicalArtwork(source);
      const imageUrl = clean(device.image || device.image_url);
      const validImage = imageUrl && icon.querySelector("img.dm-appliance-image");
      const validArtwork = !imageUrl && icon.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"] > svg`);
      if (!validImage && !validArtwork) {
        if (imageUrl) {
          icon.innerHTML = '<span class="dm-appliance-image-wrap"><img class="dm-appliance-image dm-appliance-image-0153" loading="eager" decoding="async" alt=""></span>';
          const image = icon.querySelector("img");
          image.src = imageUrl;
          image.alt = clean(device.name);
          const fit = /^data:image\//i.test(imageUrl) ? "contain" : "cover";
          image.style.setProperty("object-fit", fit, "important");
          image.style.setProperty("object-position", "50% 50%", "important");
          card.dataset.dmMediaKind = "image";
        } else {
          icon.innerHTML = artworkMarkup(canonical, source);
          card.dataset.dmMediaKind = "asset";
        }
      } else if (validImage) {
        const fit = /^data:image\//i.test(imageUrl) ? "contain" : "cover";
        validImage.classList.add("dm-appliance-image-0153");
        validImage.style.setProperty("object-fit", fit, "important");
        validImage.style.setProperty("object-position", "50% 50%", "important");
        if (validImage.getAttribute("src") !== imageUrl) validImage.setAttribute("src", imageUrl);
        card.dataset.dmMediaKind = "image";
      }
      card.dataset.dmFinalMediaSignature = `${clean(device.id)}|${canonical}|${imageUrl}`;
      card.dataset.dmArtwork = imageUrl ? "custom" : canonical;
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      visual.dataset.applianceCover = "true";
      card.querySelectorAll(".appl-mini").forEach((node) => {
        const original = clean(node.textContent);
        if (!/kWh/i.test(original)) return;
        const value = clean(original.replace(/🔋/gu, "").replace(/^(Totale|Total)\s*/i, ""));
        node.textContent = `${english() ? "Total" : "Totale"} ${value}`;
      });
      ensurePowerToggle(card, device, states);
    });
  }

  function normalizeTemperatureCards() {
    const rooms = (store()?.getSection?.("rooms") || []).filter((room) => clean(room.temp));
    doc.querySelectorAll("#temp-grid .temp-card").forEach((card, index) => {
      const room = rooms[index];
      if (!room) return;
      let icon = card.querySelector(".temp-room-icon");
      if (!icon) {
        icon = doc.createElement("span");
        icon.className = "temp-room-icon";
        (card.querySelector(".temp-card-header") || card).prepend(icon);
      }
      icon.dataset.roomIcon = clean(room.icon) || "mdi:home";
      if (!clean(icon.textContent)) icon.textContent = /^mdi:/i.test(clean(room.icon)) ? "🏠" : clean(room.icon) || "🏠";
    });
  }

  function normalizeTemperatureEditor() {
    const form = doc.querySelector("#editor-modal [data-temperature-form]");
    if (!form) return;
    const input = form.querySelector("#dm-temperature-icon");
    if (input) {
      input.type = "hidden";
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      if (!clean(input.value)) input.value = "mdi:home";
      const label = input.closest("label") || input.closest("[data-icon-field]");
      if (label) {
        if (!label.contains(input) || label.childNodes.length !== 1) label.replaceChildren(input);
        label.hidden = true;
        label.style.setProperty("display", "none", "important");
        label.setAttribute("aria-hidden", "true");
      }
    }
    const submit = form.querySelector("[data-temperature-submit]");
    if (submit && submit.dataset.releaseOwnerMounted !== "true") {
      submit.dataset.releaseOwnerMounted = "true";
      submit.type = "button";
      submit.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          saveTemperature();
        },
        true,
      );
    }
  }

  async function saveTemperature() {
    if (state.savingTemperature) return;
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!roomId || !temp.includes(".") || !dashboardStore?.updateItem) return;
    state.savingTemperature = true;
    try {
      const room = dashboardStore.getSection("rooms").find((item) => clean(item.id) === roomId);
      await dashboardStore.updateItem("rooms", roomId, {
        icon: clean(doc.getElementById("dm-temperature-icon")?.value) || clean(room?.icon) || "mdi:home",
        temp,
        hum,
      });
      root.buildTempCards?.();
      root.renderTemperature?.();
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.0] temperature save", error);
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

  function lightEntityFromRow(row) {
    const text = clean(row?.textContent);
    return /\b(?:light|switch)\.[a-z0-9_]+/i.exec(text)?.[0] || "";
  }

  function startLightEdit(button) {
    const row = button.closest(".ed-lrow") || button.closest(".ed-row");
    const entity = lightEntityFromRow(row);
    if (!entity) return false;
    const item = (store()?.getSection?.("lights") || []).find((light) =>
      (light.entities || []).includes(entity),
    );
    state.lightEditEntity = entity;
    const entityInput = doc.getElementById("luce-add-ent") || doc.getElementById("light-add-ent");
    const nameInput = doc.getElementById("luce-add-name") || doc.getElementById("light-add-name");
    const roomSelect = doc.getElementById("luce-add-room") || doc.getElementById("light-add-room");
    if (entityInput) entityInput.value = entity;
    if (nameInput) nameInput.value = clean(item?.name) || readJson("cd_luci", {})[entity] || "";
    if (roomSelect) roomSelect.value = clean(item?.room_id);
    return true;
  }

  async function saveLightEdit() {
    const previous = state.lightEditEntity;
    if (!previous) return false;
    const dashboardStore = store();
    const entity = clean((doc.getElementById("luce-add-ent") || doc.getElementById("light-add-ent"))?.value);
    const name = clean((doc.getElementById("luce-add-name") || doc.getElementById("light-add-name"))?.value) || entity;
    const roomId = clean((doc.getElementById("luce-add-room") || doc.getElementById("light-add-room"))?.value);
    if (!entity.includes(".")) return true;
    const lights = dashboardStore?.getSection?.("lights") || [];
    const item = lights.find((light) => (light.entities || []).includes(previous));
    if (item && dashboardStore?.updateItem) {
      await dashboardStore.updateItem("lights", item.id, {
        name,
        entities: [entity],
        entity,
        room_id: roomId,
      });
    }
    const names = readJson("cd_luci", {});
    const rooms = readJson("cd_luci_rooms", {});
    delete names[previous];
    delete rooms[previous];
    names[entity] = name;
    const room = dashboardStore?.getSection?.("rooms")?.find((entry) => clean(entry.id) === roomId);
    rooms[entity] = clean(room?.name);
    writeJson("cd_luci", names);
    writeJson("cd_luci_rooms", rooms);
    state.lightEditEntity = "";
    root.editorSwitch?.("luci");
    return true;
  }

  function alertName(entity) {
    return readJson("cd_avvisi_names_extra", {})[entity] || entity;
  }

  function renderAlerts() {
    if (doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return;
    const body = doc.getElementById("ed-body");
    if (!body) return;
    const groups = readJson("cd_gruppi_extra", {});
    const entries = Object.entries(groups).flatMap(([group, entities]) =>
      (entities || []).map((entity) => ({ group, entity })),
    );
    let list = body.querySelector("[data-dm-standard-alert-list]");
    if (!list) {
      list = doc.createElement("section");
      list.dataset.dmStandardAlertList = "";
      body.prepend(list);
    }
    list.innerHTML = entries
      .map(
        ({ group, entity }) =>
          `<article class="dm-standard-alert-row"><span><strong>${alertName(entity)}</strong><small>${entity}</small></span><button type="button" class="dm-edit-button" data-real-alert-edit="" data-standard-alert-edit="" data-alert-group="${group}" data-alert-entity="${entity}">✏️</button></article>`,
      )
      .join("");
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
    return true;
  }

  function installAlertSave() {
    const current = root.edAddAvviso;
    if (typeof current !== "function" || current.__dmReleaseOwnerAlert) return;
    function addAlertReleaseOwner(...args) {
      if (saveAlertEdit()) return;
      return current.apply(this, args);
    }
    addAlertReleaseOwner.__dmReleaseOwnerAlert = true;
    addAlertReleaseOwner.__dmPrevious = current;
    root.edAddAvviso = addAlertReleaseOwner;
  }

  function applyEditorContracts() {
    const modal = doc.getElementById("editor-modal");
    if (modal) modal.dataset.dmEditorTheme = doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
    normalizeTemperatureEditor();
    doc.querySelectorAll('[data-energy-panel="report"]').forEach((panel) => {
      const button = panel.querySelector("[data-report-add]");
      const form = panel.querySelector("[data-report-manual]");
      if (!button || !form) return;
      if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
      const expanded = button.getAttribute("aria-expanded") === "true";
      form.hidden = !expanded;
      form.style.display = expanded ? "" : "none";
    });
    const tappButton = doc.querySelector("#ed-tp-name")?.closest(".ed-form")?.querySelector(".ed-btn-add");
    tappButton?.closest(".ed-form")?.setAttribute("data-tapp-form", "");
    doc.querySelectorAll("[data-tapp-edit]").forEach((button) => button.classList.add("dm-edit-button"));
    doc.querySelectorAll(".ed-lrow button").forEach((button) => {
      if (/✏|edit|modifica/i.test(button.textContent || button.title || button.getAttribute("aria-label") || "")) {
        button.classList.add("dm-edit-button");
      }
    });
    renderAlerts();
    installAlertSave();
  }

  function applyAll() {
    publishContracts();
    disableLegacyOwners();
    installStyles();
    captureCurrent();
    normalizeAppliances();
    normalizeTemperatureCards();
    applyEditorContracts();
  }
  state.apply = applyAll;

  function scheduleApply() {
    root.queueMicrotask?.(applyAll);
    [30, 110, 280, 650, 1200].forEach((delay) => {
      const timer = root.setTimeout?.(() => {
        state.timers.delete(timer);
        applyAll();
      }, delay);
      if (timer) state.timers.add(timer);
    });
  }

  function wrap(name) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmReleaseOwnerRender) return false;
    function releaseOwnerRender(...args) {
      const result = current.apply(this, args);
      const finish = () => scheduleApply();
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    releaseOwnerRender.__dmReleaseOwnerRender = true;
    releaseOwnerRender.__dmPrevious = current;
    root[name] = releaseOwnerRender;
    return true;
  }

  function installWrappers() {
    [
      "editorSwitch",
      "renderApplianceSection",
      "renderAppliances",
      "renderEnergy",
      "renderEnergyDashboard",
      "renderEdDeviceList",
      "renderTemperature",
      "buildTempCards",
      "renderReport",
    ].forEach(wrap);
  }

  function suppressLegacyEnergyEvent() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current.__dmReleaseOwnerDispatch) return;
    function dispatchReleaseOwner(event) {
      if (event?.type === "dashboardmodern:energy-periods-0154") return true;
      return current.call(this, event);
    }
    dispatchReleaseOwner.__dmReleaseOwnerDispatch = true;
    dispatchReleaseOwner.__dmPrevious = current;
    root.dispatchEvent = dispatchReleaseOwner;
  }

  doc.addEventListener(
    "click",
    (event) => {
      const reportAdd = event.target?.closest?.("[data-report-add]");
      if (reportAdd) {
        const form = reportAdd.closest('[data-energy-panel="report"]')?.querySelector("[data-report-manual]");
        if (!form) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const expanded = reportAdd.getAttribute("aria-expanded") === "true";
        reportAdd.setAttribute("aria-expanded", String(!expanded));
        form.hidden = expanded;
        form.style.display = expanded ? "none" : "";
        return;
      }
      const alertEdit = event.target?.closest?.("[data-real-alert-edit],[data-standard-alert-edit]");
      if (alertEdit) {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.alertEdit = {
          group: clean(alertEdit.dataset.alertGroup),
          entity: clean(alertEdit.dataset.alertEntity),
        };
        const group = doc.getElementById("ed-avv-grp");
        const entity = doc.getElementById("ed-avv-ent");
        const name = doc.getElementById("ed-avv-name");
        if (group) group.value = state.alertEdit.group;
        if (entity) entity.value = state.alertEdit.entity;
        if (name) name.value = alertName(state.alertEdit.entity);
        return;
      }
      const lightEdit = event.target?.closest?.(".ed-lrow .dm-edit-button");
      if (lightEdit && startLightEdit(lightEdit)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const lightSave = event.target?.closest?.(".dm-light-add-form .ed-btn-add");
      if (lightSave && state.lightEditEntity) {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveLightEdit().catch((error) => root.console?.warn?.("Light save", error));
        return;
      }
      const toggle = event.target?.closest?.('[data-dm-power-toggle="true"]');
      if (!toggle) {
        scheduleApply();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const entity = clean(toggle.dataset.entity);
      if (!entity) return;
      root.dmCallHaService?.(
        entity.split(".")[0],
        toggle.dataset.state === "on" ? "turn_off" : "turn_on",
        { entity_id: entity },
      );
    },
    true,
  );

  doc.addEventListener(
    "change",
    (event) => {
      if (event.target?.id === "dm-temperature-room") {
        const room = store()?.getSection?.("rooms")?.find((item) => clean(item.id) === clean(event.target.value));
        const icon = doc.getElementById("dm-temperature-icon");
        if (icon) icon.value = clean(room?.icon) || "mdi:home";
      }
      scheduleApply();
    },
    true,
  );

  function settle() {
    installWrappers();
    suppressLegacyEnergyEvent();
    applyAll();
  }

  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    onPeriodBundle(event.detail);
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("pageshow", scheduleApply);

  suppressLegacyEnergyEvent();
  publishContracts();
  disableLegacyOwners();
  installStyles();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
  [40, 140, 360, 800, 1500].forEach((delay) => root.setTimeout?.(settle, delay));
})(globalThis);
