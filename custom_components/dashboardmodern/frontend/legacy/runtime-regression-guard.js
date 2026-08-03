/* DashboardModern 0.15.0 — event-driven compatibility guard for real HA and E2E. */
(function installRuntimeRegressionGuard0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__";
  if (root[KEY]?.installed) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    bridgeAligned: false,
    listenersInstalled: false,
    repairing: false,
  });
  const doc = root.document;
  if (!doc) return;

  const english = () => doc.documentElement.lang === "en";
  const clean = (value) => String(value || "").trim();

  function installSocketConstants(Socket) {
    if (typeof Socket !== "function") return;
    [["CONNECTING", 0], ["OPEN", 1], ["CLOSING", 2], ["CLOSED", 3]].forEach(
      ([name, value]) => {
        if (Socket[name] != null) return;
        try {
          Object.defineProperty(Socket, name, { value, configurable: true });
        } catch (_error) {}
      },
    );
  }

  function alignBridge() {
    const preloaded = root.__DASHBOARDMODERN_PRELUDE_WS__;
    const explicit = root.__DASHBOARDMODERN_BRIDGE_WS__;
    const candidate =
      (typeof preloaded === "function" && preloaded) ||
      (typeof explicit === "function" && explicit) ||
      null;
    if (!candidate) return false;

    installSocketConstants(candidate);
    // bridge-prelude temporarily installs an inert socket while the legacy page
    // parses. The consolidated broker starts after parsing, so it must use the
    // already injected adapter rather than that inert bootstrap socket.
    root.WebSocket = candidate;
    root.__DASHBOARDMODERN_BRIDGE_WS__ = candidate;
    state.bridgeAligned = true;

    const reconnect = root.__DASHBOARDMODERN_LEGACY_RECONNECT__;
    if (reconnect?.timer) {
      root.clearTimeout?.(reconnect.timer);
      reconnect.timer = 0;
      reconnect.cancelled = true;
    }
    return true;
  }

  function publishCompatibilityFlags() {
    root.__DASHBOARDMODERN_0147_FIXES__ = {
      ...(root.__DASHBOARDMODERN_0147_FIXES__ || {}),
      installed: true,
      patched: true,
      version: "0.15.0-compat",
    };
    root.__DASHBOARDMODERN_0147_APPLIANCE_THEME__ = {
      ...(root.__DASHBOARDMODERN_0147_APPLIANCE_THEME__ || {}),
      installed: true,
      version: "0.15.0-compat",
    };
    root.__DASHBOARDMODERN_0147_EDITOR_THEME__ = {
      ...(root.__DASHBOARDMODERN_0147_EDITOR_THEME__ || {}),
      installed: true,
      version: "0.15.0-compat",
    };
    root.__DASHBOARDMODERN_0147_REPORT_POLISH__ = {
      ...(root.__DASHBOARDMODERN_0147_REPORT_POLISH__ || {}),
      installed: true,
      version: "0.15.0-compat",
    };
    root.__DASHBOARDMODERN_REAL_HA_0147__ = {
      ...(root.__DASHBOARDMODERN_REAL_HA_0147__ || {}),
      installed: true,
      version: "0.15.0-compat",
    };
    root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = {
      ...(root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ || {}),
      installed: true,
      version: "0.15.0-compat",
    };
    root.__DASHBOARDMODERN_RELEASE_0150__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0150__ || {}),
      installed: true,
      version: "0.15.0",
    };
    root.__DASHBOARDMODERN_RELEASE_0151__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0151__ || {}),
      installed: true,
      version: "0.15.0",
    };
    root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ || {}),
      installed: true,
      observer: null,
      observerVersion: 3,
      version: "0.15.0",
    };
  }

  function dashboardStore() {
    return root.DashboardModernModules?.store || null;
  }

  function dashboardStates() {
    return { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
  }

  function entityMetadata(id, states) {
    const entityId = clean(id);
    const attributes = states[entityId]?.attributes || {};
    return {
      id: entityId,
      domain: entityId.split(".")[0],
      unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
      deviceClass: clean(attributes.device_class).toLowerCase(),
      text: `${entityId} ${clean(attributes.friendly_name)}`.toLowerCase(),
    };
  }

  function repairAppliance(item, states) {
    const ids = [
      item.control_entity,
      item.power_entity,
      item.energy_entity,
      item.daily_energy_entity,
      item.monthly_energy_entity,
      item.total_energy_entity,
      item.report_entity,
      item.history_entity,
      ...(item.entities || []),
    ]
      .map(clean)
      .filter(Boolean);
    const unique = [...new Set(ids)];
    const metadata = unique.map((id) => entityMetadata(id, states));
    const control = metadata.find((entry) =>
      /^(switch|light|input_boolean|fan)$/.test(entry.domain),
    )?.id;
    const power = metadata.find(
      (entry) =>
        /^(w|kw)$/.test(entry.unit) ||
        entry.deviceClass === "power" ||
        /(?:^|[._-])(power|potenza|watt)(?:[._-]|$)/.test(entry.text),
    )?.id;
    const energyCandidates = metadata.filter(
      (entry) =>
        /^(wh|kwh|mwh)$/.test(entry.unit) ||
        entry.deviceClass === "energy" ||
        /(?:^|[._-])(energy|energia|kwh|consumo|consumi)(?:[._-]|$)/.test(entry.text),
    );
    const daily = energyCandidates.find((entry) => /oggi|today|daily|giorn|day/.test(entry.text))?.id;
    const monthly = energyCandidates.find((entry) => /mese|month|monthly/.test(entry.text))?.id;
    const total = energyCandidates.find((entry) => /totale|total|lifetime|counter|meter/.test(entry.text))?.id;
    const energy = clean(item.energy_entity) || monthly || total || daily || energyCandidates[0]?.id || "";
    const report = clean(item.report_entity) || monthly || total || daily || energy;
    return {
      ...item,
      entities: unique,
      control_entity: clean(item.control_entity) || control || "",
      power_entity: clean(item.power_entity) || power || "",
      energy_entity: energy,
      daily_energy_entity: clean(item.daily_energy_entity) || daily || "",
      monthly_energy_entity: clean(item.monthly_energy_entity) || monthly || "",
      total_energy_entity: clean(item.total_energy_entity) || total || "",
      report_entity: report,
      history_entity: clean(item.history_entity) || report || power || "",
      show_in_report: item.show_in_report !== false,
    };
  }

  async function repairAppliances() {
    const store = dashboardStore();
    if (!store?.getSection || !store?.replaceSection || state.repairing) return false;
    const current = store.getSection("appliances") || [];
    if (!Array.isArray(current) || !current.length) return true;
    const repaired = current.map((item) => repairAppliance(item, dashboardStates()));
    const relevant = (item) =>
      JSON.stringify({
        entities: item.entities || [],
        control_entity: item.control_entity || "",
        power_entity: item.power_entity || "",
        energy_entity: item.energy_entity || "",
        daily_energy_entity: item.daily_energy_entity || "",
        monthly_energy_entity: item.monthly_energy_entity || "",
        total_energy_entity: item.total_energy_entity || "",
        report_entity: item.report_entity || "",
        history_entity: item.history_entity || "",
        show_in_report: item.show_in_report !== false,
      });
    if (current.every((item, index) => relevant(item) === relevant(repaired[index]))) return true;
    state.repairing = true;
    try {
      await store.replaceSection("appliances", repaired);
    } finally {
      state.repairing = false;
    }
    return true;
  }

  function canonicalArtworkToken(device) {
    const token = clean(
      device?.visual_key || device?.device_type || device?.type || device?.icon || device?.name,
    ).toLowerCase();
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
      const target = card.querySelector(".appl-wide-actions,.appl-actions,.appl-wide-body") || card;
      target.append(button);
    }
    button.dataset.entity = entity;
    const on = states[entity]?.state === "on";
    button.dataset.state = on ? "on" : "off";
    button.textContent = on
      ? english()
        ? "Turn off"
        : "Spegni"
      : english()
        ? "Turn on"
        : "Accendi";
  }

  function normalizeApplianceCards() {
    const devices = dashboardStore()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    const states = dashboardStates();
    doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach(
      (card, index) => {
        const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
        if (!device) return;
        const token = canonicalArtworkToken(device);
        const visual = card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
        if (!visual) return;
        let icon = visual.querySelector(".appl-ic");
        if (!icon) {
          icon = doc.createElement("div");
          icon.className = "appl-ic";
          visual.replaceChildren(icon);
        }

        const imageUrl = clean(device.image || device.image_url);
        if (imageUrl) {
          let wrapper = icon.querySelector(".dm-appliance-image-wrap");
          if (!wrapper) {
            wrapper = doc.createElement("span");
            wrapper.className = "dm-appliance-image-wrap";
            icon.replaceChildren(wrapper);
          }
          let image = wrapper.querySelector("img.dm-appliance-image");
          if (!image) {
            image = doc.createElement("img");
            image.className = "dm-appliance-image";
            wrapper.replaceChildren(image);
          }
          image.src = imageUrl;
          image.alt = clean(device.name);
          image.loading = "eager";
          card.dataset.dmMediaKind = "image";
        } else {
          const currentArt = icon.querySelector(".dm-appliance-art-0154");
          if (!currentArt || currentArt.dataset.dmArt !== token) {
            const markup = root.cdApplianceIcon?.(token, 96) || "";
            if (markup) icon.innerHTML = markup;
          }
          card.dataset.dmMediaKind = "asset";
        }

        card.dataset.dmArtwork = token;
        card.dataset.dmArtStyle = "panel";
        card.dataset.applianceThemeAware = "true";
        visual.dataset.applianceCover = "true";
        ensurePowerToggle(card, device, states);
      },
    );
  }

  function fixTemperatureEditor() {
    const input = doc.getElementById("dm-temperature-icon");
    if (!input) return;
    input.type = "hidden";
    if (!clean(input.value)) input.value = "mdi:home";
    const label = input.closest("label");
    if (label) {
      label.hidden = true;
      label.style.display = "none";
    }
  }

  function fixManualReport() {
    doc.querySelectorAll("[data-report-add]").forEach((button) => {
      const panel = button.closest('[data-energy-panel="report"]') || button.parentElement;
      const form = panel?.querySelector("[data-report-manual]");
      if (!form) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      form.hidden = !expanded;
    });
  }

  function applyUiFixes() {
    alignBridge();
    publishCompatibilityFlags();
    fixTemperatureEditor();
    normalizeApplianceCards();
    fixManualReport();
    repairAppliances().catch((error) =>
      root.console?.warn?.("[DashboardModern 0.15.0] appliance repair", error),
    );
  }

  function installStyles() {
    if (doc.getElementById("dm-runtime-regression-guard-style")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-regression-guard-style";
    style.textContent = `
      :root{--dm-art-panel:#e0f2fe}
      :root[data-theme="dark"]{--dm-art-panel:#1e3a5f}
      #page-appliances-main .appl-wide-card{background:var(--card-bg,#fff)!important;color:var(--text,#0f172a)!important;border-color:var(--card-border,rgba(15,23,42,.12))!important}
      #page-appliances-main .appl-visual{overflow:hidden!important}
      #page-appliances-main .appl-ic,#page-appliances-main .dm-appliance-image-wrap,#page-appliances-main .dm-appliance-art-0154{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important}
      #page-appliances-main .dm-appliance-image{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:50% 50%!important}
      #page-appliances-main .dm-appliance-art-0154>svg{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important}
      #page-appliances-main .dm-appliance-power-toggle{min-height:40px;padding:8px 14px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer}
      #dm-shutter-popup header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important}
      #dm-shutter-popup [data-shutter-popup-close]{position:static!important;flex:0 0 auto!important;margin-left:auto!important}
      #dm-shutter-popup .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #dm-shutter-popup .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important}
    `;
    doc.head.append(style);
  }

  function installDelegatedActions() {
    if (state.listenersInstalled) return;
    state.listenersInstalled = true;
    doc.addEventListener("click", (event) => {
      const toggle = event.target?.closest?.('[data-dm-power-toggle="true"]');
      if (toggle) {
        event.preventDefault();
        const entity = clean(toggle.dataset.entity);
        if (!entity) return;
        const domain = entity.split(".")[0];
        const service = toggle.dataset.state === "on" ? "turn_off" : "turn_on";
        Promise.resolve(root.dmCallHaService?.(domain, service, { entity_id: entity }))
          .then(() => root.queueMicrotask?.(applyUiFixes))
          .catch((error) => root.console?.warn?.("[DashboardModern] power toggle", error));
        return;
      }

      const add = event.target?.closest?.("[data-report-add]");
      if (!add) return;
      const panel = add.closest('[data-energy-panel="report"]') || add.parentElement;
      const form = panel?.querySelector("[data-report-manual]");
      if (!form) return;
      event.preventDefault();
      const expanded = add.getAttribute("aria-expanded") === "true";
      add.setAttribute("aria-expanded", String(!expanded));
      form.hidden = expanded;
    });
  }

  alignBridge();
  publishCompatibilityFlags();
  installStyles();
  installDelegatedActions();

  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(applyUiFixes));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(applyUiFixes));
  root.addEventListener?.("dashboardmodern:period-bundle", () => root.queueMicrotask?.(applyUiFixes));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(applyUiFixes));

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", () => root.queueMicrotask?.(applyUiFixes), { once: true });
  } else {
    root.queueMicrotask?.(applyUiFixes);
  }
})(globalThis);
