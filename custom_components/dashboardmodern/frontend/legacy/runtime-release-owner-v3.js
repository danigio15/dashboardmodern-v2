/* DashboardModern 0.15.0 — final deterministic release owner. */
(function installReleaseOwnerV3(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RELEASE_OWNER_0150__";
  if (root[KEY]?.version === "0.15.0-v3" || !root.document) return;
  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0-v3",
    currentMonth: Object.create(null),
    periodLocked: false,
    scheduled: false,
    savingTemperature: false,
    lightEditEntity: "",
    alertEdit: null,
    wrapped: new WeakSet(),
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
  const store = () => root.DashboardModernModules?.store || null;
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");

  function lexical(name, fallback = null) {
    try {
      return root.eval?.(`typeof ${name} !== "undefined" ? ${name} : null`) || fallback;
    } catch (_error) {
      return root[name] || fallback;
    }
  }

  function runtimeBundle() {
    return root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle || null;
  }

  function bundleIsCurrent(bundle) {
    if (!bundle?.period) return false;
    const now = new Date();
    return (
      Number(bundle.period.month) === now.getMonth() + 1 &&
      Number(bundle.period.year) === now.getFullYear()
    );
  }

  function captureCurrent(bundle = runtimeBundle()) {
    if (!bundleIsCurrent(bundle) || !bundle?.month) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      const value = finite(bundle.month[key]);
      if (value != null) state.currentMonth[slot] = value;
    });
    return true;
  }

  function installPeriodLock() {
    if (state.periodLocked) return;
    root.CD_PERIOD ||= {};
    const targets = [...new Set([lexical("CD_PERIOD", null), root.CD_PERIOD].filter(Boolean))];
    captureCurrent();
    targets.forEach((target) => {
      Object.keys(MONTH_SLOTS).forEach((slot) => {
        const existing = finite(target[slot]);
        if (state.currentMonth[slot] == null && existing != null) state.currentMonth[slot] = existing;
        const descriptor = Object.getOwnPropertyDescriptor(target, slot);
        if (descriptor?.configurable === false) return;
        Object.defineProperty(target, slot, {
          configurable: false,
          enumerable: true,
          get() {
            return state.currentMonth[slot] ?? 0;
          },
          set(raw) {
            const value = finite(raw);
            if (value == null) return;
            const bundle = runtimeBundle();
            if (state.currentMonth[slot] == null || !bundle || bundleIsCurrent(bundle)) {
              state.currentMonth[slot] = value;
            }
          },
        });
      });
    });
    state.periodLocked = true;
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
    root.__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__ = true;
    retireObserver(root, "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__", null);
    retireObserver(root, "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__", null);
    root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ = {
      ...(root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ || {}),
      installed: true,
      version: "0.15.0",
      observer: disabledObserver(),
    };
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154__, "domObserver", disabledObserver());
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__, "observer", disabledObserver());
    retireObserver(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__, "styleObserver", disabledObserver());
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
    [
      "dm-appliance-media-layout-lock-0153",
      "dm-release-0152-artwork-layout-fix",
      "dm-energy-report-media-fixes-0153",
    ].forEach((id) => doc.getElementById(id)?.remove());
    let style = doc.getElementById("dm-release-0154-final-artwork-lock");
    if (style) return;
    style = doc.createElement("style");
    style.id = "dm-release-0154-final-artwork-lock";
    style.textContent = `
      :root,[data-theme="light"]{--dm-art-panel:#e0f2fe}
      [data-theme="dark"]{--dm-art-panel:#243b5a}
      [data-report-manual][hidden]{display:none!important}
      html body #page-appliances-main .appl-wide-card{box-sizing:border-box!important;background-color:var(--card-bg,var(--ha-card-background,#fff))!important;color:var(--text,var(--primary-text-color,#0f172a))!important;border-color:var(--card-border,var(--divider-color,#dbe4ee))!important}
      html body #page-appliances-main .appl-wide-card.dm-control-device{width:min(100%,408px)!important;max-width:408px!important;min-height:0!important}
      html body #page-appliances-main .appl-spark{display:none!important}
      html body #page-appliances-main .appl-visual{position:relative!important;box-sizing:border-box!important;overflow:hidden!important}
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-image,
      html body #page-appliances-main .dm-appliance-art-0154>svg{position:absolute!important;inset:0!important;display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;object-position:50% 50%!important}
      html body #page-appliances-main .dm-appliance-image:not([src^="data:image"]){object-fit:cover!important}
      html body #page-appliances-main .dm-appliance-image[src^="data:image"]{object-fit:contain!important}
      html body #page-appliances-main .dm-art-panel{fill:var(--dm-art-panel)!important}
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

  function setImportant(node, property, value) {
    if (!node?.style) return;
    if (
      node.style.getPropertyValue(property) === value &&
      node.style.getPropertyPriority(property) === "important"
    ) return;
    node.style.setProperty(property, value, "important");
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
      oven: "♨", fridge: "❄", microwave: "〰", boiler: "⇩", washer: "◉",
      dryer: "≋", dishwasher: "▦", cooktop: "●", television: "▶",
    }[canonical] || "⚙";
    return `<span class="dm-appliance-art dm-appliance-art-0154" data-dm-art="${canonical}" data-dm-art-style="panel" data-appliance-asset="${source}" data-appliance-asset-key="${source}"><svg viewBox="0 0 96 96" role="img" aria-hidden="true"><rect class="dm-art-panel" x="2" y="2" width="92" height="92" rx="20"/><rect x="15" y="12" width="66" height="72" rx="12" fill="#0f2942"/><text x="48" y="60" text-anchor="middle" font-size="34" fill="#8be2ff">${glyph}</text></svg></span>`;
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
      ? english() ? "Turn off" : "Spegni"
      : english() ? "Turn on" : "Accendi";
  }

  function normalizeAppliances() {
    const devices = store()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    const states = { ...(lexical("_RAW_STATES", {}) || {}), ...(lexical("STATES", {}) || {}) };
    doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach((card, index) => {
      const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
      if (!device) return;
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      setImportant(card, "background-color", "var(--card-bg, var(--ha-card-background, #fff))");
      setImportant(card, "color", "var(--text, var(--primary-text-color, #0f172a))");
      setImportant(card, "border-color", "var(--card-border, var(--divider-color, #dbe4ee))");
      const visual = card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
      if (!visual) return;
      setImportant(visual, "position", "relative");
      let icon = visual.querySelector(".appl-ic");
      if (!icon) {
        icon = doc.createElement("div");
        icon.className = "appl-ic";
        visual.replaceChildren(icon);
      }
      ["top", "right", "bottom", "left"].forEach((property) => setImportant(icon, property, "0px"));
      setImportant(icon, "position", "absolute");
      setImportant(icon, "width", "100%");
      setImportant(icon, "height", "100%");
      const source = clean(device.visual_key || device.device_type || device.name).toLowerCase();
      const canonical = canonicalArtwork(source);
      const imageUrl = clean(device.image || device.image_url);
      let image = icon.querySelector("img.dm-appliance-image");
      const artwork = icon.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"] > svg`);
      if (imageUrl && !image) {
        icon.innerHTML = '<span class="dm-appliance-image-wrap"><img class="dm-appliance-image dm-appliance-image-0153" loading="eager" decoding="async" alt=""></span>';
        image = icon.querySelector("img");
      } else if (!imageUrl && !artwork) {
        icon.innerHTML = artworkMarkup(canonical, source);
      }
      if (imageUrl && image) {
        image.classList.add("dm-appliance-image-0153");
        if (image.getAttribute("src") !== imageUrl) image.setAttribute("src", imageUrl);
        if (image.getAttribute("alt") !== clean(device.name)) image.setAttribute("alt", clean(device.name));
        setImportant(image, "object-fit", /^data:image\//i.test(imageUrl) ? "contain" : "cover");
        setImportant(image, "object-position", "50% 50%");
        card.dataset.dmMediaKind = "image";
        card.dataset.dmArtwork = "custom";
      } else {
        card.dataset.dmMediaKind = "asset";
        card.dataset.dmArtwork = canonical;
      }
      card.dataset.dmFinalMediaSignature = `${clean(device.id)}|${canonical}|${imageUrl}`;
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      visual.dataset.applianceCover = "true";
      card.querySelectorAll(".appl-mini").forEach((node) => {
        const original = clean(node.textContent);
        if (!/kWh/i.test(original)) return;
        const value = clean(original.replace(/🔋/gu, "").replace(/^(Totale|Total)\s*/i, ""));
        const label = `${english() ? "Total" : "Totale"} ${value}`;
        if (node.textContent !== label) node.textContent = label;
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
    const input = form?.querySelector("#dm-temperature-icon");
    if (!form || !input) return;
    input.type = "hidden";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    if (!clean(input.value)) input.value = "mdi:home";
    const label = input.closest("label") || input.closest("[data-icon-field]");
    if (label) {
      label.hidden = true;
      label.style.setProperty("display", "none", "important");
      label.setAttribute("aria-hidden", "true");
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
      normalizeTemperatureCards();
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
  const writeJson = (key, value) => root.localStorage?.setItem(key, JSON.stringify(value));

  function startLightEdit(button) {
    const row = button.closest(".ed-lrow") || button.closest(".ed-row");
    const entity = /\b(?:light|switch)\.[a-z0-9_]+/i.exec(clean(row?.textContent))?.[0] || "";
    if (!entity) return false;
    const item = (store()?.getSection?.("lights") || []).find((light) => (light.entities || []).includes(entity));
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
    const item = (dashboardStore?.getSection?.("lights") || []).find((light) => (light.entities || []).includes(previous));
    if (item && dashboardStore?.updateItem) await dashboardStore.updateItem("lights", item.id, { name, entities: [entity], entity, room_id: roomId });
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
    const entries = Object.entries(groups).flatMap(([group, entities]) => (entities || []).map((entity) => ({ group, entity })));
    let list = body.querySelector("[data-dm-standard-alert-list]");
    if (!list) {
      list = doc.createElement("section");
      list.dataset.dmStandardAlertList = "";
      body.prepend(list);
    }
    const html = entries.map(({ group, entity }) => `<article class="dm-standard-alert-row"><span><strong>${alertName(entity)}</strong><small>${entity}</small></span><button type="button" class="dm-edit-button" data-real-alert-edit="" data-standard-alert-edit="" data-alert-group="${group}" data-alert-entity="${entity}">✏️</button></article>`).join("");
    if (list.innerHTML !== html) list.innerHTML = html;
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
    if (Array.isArray(groups[previous.group])) groups[previous.group] = groups[previous.group].filter((id) => id !== previous.entity);
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
    if (typeof current !== "function" || current.__dmReleaseOwnerAlertV3) return;
    function addAlertV3(...args) {
      if (saveAlertEdit()) return;
      return current.apply(this, args);
    }
    addAlertV3.__dmReleaseOwnerAlertV3 = true;
    root.edAddAvviso = addAlertV3;
  }

  function applyEditorContracts() {
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
      if (/✏|edit|modifica/i.test(button.textContent || button.title || button.getAttribute("aria-label") || "")) button.classList.add("dm-edit-button");
    });
    renderAlerts();
    installAlertSave();
  }

  function applyAll() {
    publishContracts();
    installStyles();
    installPeriodLock();
    captureCurrent();
    normalizeAppliances();
    normalizeTemperatureCards();
    applyEditorContracts();
  }
  state.apply = applyAll;

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;
    root.queueMicrotask?.(() => {
      state.scheduled = false;
      applyAll();
    });
  }

  function wrapOnce(name) {
    const current = root[name];
    if (typeof current !== "function" || state.wrapped.has(current) || current.__dmReleaseOwnerV3) return;
    function wrappedReleaseOwnerV3(...args) {
      const result = current.apply(this, args);
      const finish = () => scheduleApply();
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    wrappedReleaseOwnerV3.__dmReleaseOwnerV3 = true;
    state.wrapped.add(current);
    state.wrapped.add(wrappedReleaseOwnerV3);
    root[name] = wrappedReleaseOwnerV3;
  }

  function installHooks() {
    ["renderApplianceSection", "renderTemperature", "buildTempCards"].forEach(wrapOnce);
  }

  function preserveEnergySnapshot() {
    const ids = ["v-solar-month", "v-home-month", "v-grid-month", "v-battery-month"];
    const snapshot = Object.fromEntries(ids.map((id) => [id, doc.getElementById(id)?.textContent ?? null]));
    const restore = () => Object.entries(snapshot).forEach(([id, value]) => {
      const node = doc.getElementById(id);
      if (node && value != null && node.textContent !== value) node.textContent = value;
    });
    root.queueMicrotask?.(restore);
    root.setTimeout?.(restore, 360);
  }

  function suppressLegacyEnergyEvent() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current.__dmReleaseOwnerDispatchV3) return;
    function dispatchV3(event) {
      if (event?.type === "dashboardmodern:energy-periods-0154") {
        preserveEnergySnapshot();
        return true;
      }
      return current.call(this, event);
    }
    dispatchV3.__dmReleaseOwnerDispatchV3 = true;
    root.dispatchEvent = dispatchV3;
  }

  function handleClick(event) {
    const temperature = event.target?.closest?.("[data-temperature-submit]");
    if (temperature) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveTemperature().catch((error) => root.console?.warn?.("Temperature save", error));
      return;
    }
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
      state.alertEdit = { group: clean(alertEdit.dataset.alertGroup), entity: clean(alertEdit.dataset.alertEntity) };
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
    if (toggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const entity = clean(toggle.dataset.entity);
      if (entity) root.dmCallHaService?.(entity.split(".")[0], toggle.dataset.state === "on" ? "turn_off" : "turn_on", { entity_id: entity });
      return;
    }
    scheduleApply();
  }

  root.addEventListener("click", handleClick, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.id === "dm-temperature-room") {
      const room = store()?.getSection?.("rooms")?.find((item) => clean(item.id) === clean(event.target.value));
      const icon = doc.getElementById("dm-temperature-icon");
      if (icon) icon.value = clean(room?.icon) || "mdi:home";
    }
    scheduleApply();
  }, true);

  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    captureCurrent(event.detail);
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    installHooks();
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installHooks();
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("pageshow", scheduleApply);

  suppressLegacyEnergyEvent();
  publishContracts();
  installStyles();
  installPeriodLock();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", applyAll, { once: true });
  else applyAll();
  [60, 220, 600].forEach((delay) => root.setTimeout?.(() => {
    installHooks();
    applyAll();
  }, delay));
})(globalThis);
