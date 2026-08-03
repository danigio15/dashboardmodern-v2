/* DashboardModern 0.15.0 — single bounded owner for retained runtime contracts. */
(function installFinalOwner0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_FINAL_OWNER_0150__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    wrapped: new Set(),
    repairing: false,
    repaired: false,
    alertEdit: null,
    alertSaveOriginal: null,
  });

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });
  const YEAR_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_anno": "house",
    "dm.energy_produzione_solare_anno": "solar",
    "dm.energy_rete_acquistata_anno": "gridImport",
    "dm.energy_rete_venduta_anno": "gridExport",
    "dm.energy_batteria_caricata_anno": "batteryCharged",
    "dm.energy_batteria_usata_anno": "batteryDischarged",
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

  function globalLexical(name, fallback = null) {
    try {
      const value = root.eval?.(name);
      return value ?? fallback;
    } catch (_error) {
      return root[name] ?? fallback;
    }
  }

  function periodRegistry() {
    return globalLexical("CD_PERIOD", (root.CD_PERIOD ||= {}));
  }

  function rawStates() {
    return globalLexical("_RAW_STATES", (root._RAW_STATES ||= {}));
  }

  function visibleStates() {
    return globalLexical("STATES", (root.STATES ||= {}));
  }

  function allStates() {
    return { ...rawStates(), ...visibleStates() };
  }

  function currentSelection() {
    const now = new Date();
    const month = Number(doc.getElementById("ed-sel-month")?.value);
    const year = Number(doc.getElementById("ed-sel-year")?.value);
    return {
      month: Number.isInteger(month) ? month : now.getMonth() + 1,
      year: Number.isInteger(year) ? year : now.getFullYear(),
    };
  }

  function bundleIsCurrent(bundle) {
    if (!bundle?.period) return false;
    const now = new Date();
    return (
      Number(bundle.period.month) === now.getMonth() + 1 &&
      Number(bundle.period.year) === now.getFullYear()
    );
  }

  function sourceFor(key, kind) {
    const energy = store()?.getSection?.("energy") || {};
    const definitions = {
      house: ["house", kind === "year" ? "annual_energy" : "total_energy"],
      solar: ["solar", kind === "year" ? "annual_energy" : "total_energy"],
      gridImport: ["grid", kind === "year" ? "annual_import_energy" : "total_import_energy"],
      gridExport: ["grid", kind === "year" ? "annual_export_energy" : "total_export_energy"],
      batteryCharged: ["battery", kind === "year" ? "annual_charged_energy" : "total_charged_energy"],
      batteryDischarged: ["battery", kind === "year" ? "annual_discharged_energy" : "total_discharged_energy"],
    };
    const [group, field] = definitions[key] || [];
    return clean(energy?.[group]?.[field] || energy?.[group]?.total_energy);
  }

  function publishDerived(slot, value, key, kind, bundle) {
    const number = finite(value);
    if (!slot || number == null) return;
    const selected = new Date(Number(bundle.period.year), Number(bundle.period.month) - 1, 1);
    const stamp = new Date().toISOString();
    const object = {
      entity_id: slot,
      state: String(Math.max(0, number)),
      attributes: {
        unit_of_measurement: "kWh",
        device_class: "energy",
        state_class: "measurement",
        dashboardmodern_derived: true,
        dashboardmodern_source: sourceFor(key, kind),
        dashboardmodern_period: kind,
        dashboardmodern_selected: selected.toISOString(),
        dashboardmodern_version: "0.15.0",
      },
      last_changed: stamp,
      last_updated: stamp,
    };
    rawStates()[slot] = object;
    try {
      visibleStates()[slot] = object;
    } catch (_error) {}
  }

  function projectBundle(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!bundle?.period) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      publishDerived(slot, bundle.month?.[key], key, "month", bundle);
    });
    Object.entries(YEAR_SLOTS).forEach(([slot, key]) => {
      publishDerived(slot, bundle.year?.[key], key, "year", bundle);
    });
    if (!bundleIsCurrent(bundle)) return true;
    const registry = periodRegistry();
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      const number = finite(bundle.month?.[key]);
      if (number != null) registry[slot] = Math.max(0, number);
    });
    return true;
  }

  function installBrokerProjection() {
    const broker = runtime()?.broker;
    const original = broker?.ingestState;
    if (typeof original !== "function" || original.__dmFinalPeriodOwner) return false;
    function ingestFinalPeriod0150(haState) {
      const result = original.call(this, haState);
      const attributes = haState?.attributes || {};
      const slot = clean(haState?.entity_id);
      const number = finite(haState?.state);
      if (attributes.dashboardmodern_derived === true && number != null) {
        rawStates()[slot] = haState;
        try {
          visibleStates()[slot] = haState;
        } catch (_error) {}
        if (attributes.dashboardmodern_period !== "month") {
          periodRegistry()[slot] = Math.max(0, number);
        } else {
          const selected = new Date(attributes.dashboardmodern_selected || 0);
          const now = new Date();
          if (
            selected.getMonth() === now.getMonth() &&
            selected.getFullYear() === now.getFullYear()
          ) {
            periodRegistry()[slot] = Math.max(0, number);
          }
        }
      }
      return result;
    }
    ingestFinalPeriod0150.__dmFinalPeriodOwner = true;
    ingestFinalPeriod0150.__dmPrevious = original;
    broker.ingestState = ingestFinalPeriod0150;
    return true;
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
    root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ = {
      ...(root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ || {}),
      installed: true,
      version: "0.15.0",
      observer: { disabled: true },
    };
    root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ || {}),
      installed: true,
      observer: null,
      observerVersion: 3,
      version: "0.15.0",
    };
  }

  function installStyles() {
    if (doc.getElementById("dm-runtime-final-owner-style")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-final-owner-style";
    style.textContent = `
      [data-report-manual][hidden]{display:none!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell{background:var(--card-bg,#161f36)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .dm-report-row{background:var(--surface-2,#1b2540)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-input{background:var(--surface-3,#212d4c)!important;color:var(--text,#e6edf7)!important;border-color:var(--card-border,#263453)!important}
      html body #page-appliances-main .appl-wide-card{background:var(--card-bg,var(--ha-card-background,#fff))!important;color:var(--text,var(--primary-text-color,#0f172a))!important;border-color:var(--card-border,var(--divider-color,#dbe4ee))!important}
      html body #page-appliances-main .appl-wide-card.dm-control-device{width:min(100%,410px)!important;max-width:410px!important;min-height:0!important}
      html body #page-appliances-main .appl-spark{display:none!important}
      html body #page-appliances-main .appl-visual,
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-image{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;object-fit:cover!important;object-position:50% 50%!important}
      html body #page-appliances-main .dm-appliance-art-0154>svg{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important}
      html body #page-appliances-main .dm-appliance-power-toggle{min-height:40px;padding:8px 14px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer}
      html body #dm-shutter-popup header{position:relative!important;display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:48px!important;padding-right:56px!important}
      html body #dm-shutter-popup [data-shutter-popup-close]{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important}
      html body #dm-shutter-popup .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      html body #dm-shutter-popup .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important}
      .dm-standard-alert-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;margin:8px 0;border:1px solid var(--card-border,#dbe4ee);border-radius:14px}
      #temp-grid .temp-card{min-height:110px!important}
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

  function artworkMarkup(canonical, legacyToken) {
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
    return `<span class="dm-appliance-art dm-appliance-art-0154" data-dm-art="${canonical}" data-dm-art-style="panel" data-appliance-asset="${legacyToken}" data-appliance-asset-key="${legacyToken}"><svg viewBox="0 0 96 96" role="img" aria-hidden="true"><rect x="2" y="2" width="92" height="92" rx="20" fill="#e0f2fe"/><rect x="15" y="12" width="66" height="72" rx="12" fill="#0f2942"/><text x="48" y="60" text-anchor="middle" font-size="34" fill="#8be2ff">${glyph}</text></svg></span>`;
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
      (card.querySelector(".appl-wide-actions,.appl-actions,.appl-wide-body") || card).append(button);
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

  function normalizeApplianceCards() {
    const devices = store()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    const states = allStates();
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card, index) => {
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
      const legacyToken = clean(device.visual_key || device.device_type || device.name).toLowerCase();
      const canonical = canonicalArtwork(legacyToken);
      const imageUrl = clean(device.image || device.image_url);
      const signature = `${clean(device.id)}|${canonical}|${imageUrl}`;
      if (card.dataset.dmFinalMediaSignature !== signature) {
        if (imageUrl) {
          icon.innerHTML = '<span class="dm-appliance-image-wrap"><img class="dm-appliance-image dm-appliance-image-0153" alt=""></span>';
          const image = icon.querySelector("img");
          image.src = imageUrl;
          image.alt = clean(device.name);
          card.dataset.dmMediaKind = "image";
        } else {
          icon.innerHTML = artworkMarkup(canonical, legacyToken);
          card.dataset.dmMediaKind = "asset";
        }
        card.dataset.dmFinalMediaSignature = signature;
      }
      card.dataset.dmArtwork = canonical;
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      visual.dataset.applianceCover = "true";
      ensurePowerToggle(card, device, states);
    });
  }

  function applyTemperatureEditor() {
    const input = doc.getElementById("dm-temperature-icon");
    if (!input) return;
    input.type = "hidden";
    input.tabIndex = -1;
    if (!clean(input.value)) input.value = "mdi:home";
    const label = input.closest("label") || input.closest("[data-icon-field]");
    if (label) {
      if (input.parentElement !== label || label.childNodes.length !== 1) label.replaceChildren(input);
      label.hidden = true;
      label.style.display = "none";
      label.setAttribute("aria-hidden", "true");
    }
  }

  function applyManualReport() {
    doc.querySelectorAll('[data-energy-panel="report"]').forEach((panel) => {
      const button = panel.querySelector("[data-report-add]");
      const form = panel.querySelector("[data-report-manual]");
      if (!button || !form) return;
      if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
      const expanded = button.getAttribute("aria-expanded") === "true";
      form.hidden = !expanded;
      form.style.display = expanded ? "" : "none";
    });
  }

  function applyEditorContracts() {
    const modal = doc.getElementById("editor-modal");
    if (modal) modal.dataset.dmEditorTheme = doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTemperatureEditor();
    applyManualReport();
    const tappButton = doc.querySelector("#ed-tp-name")?.closest(".ed-form")?.querySelector(".ed-btn-add");
    if (tappButton) {
      const form = tappButton.closest(".ed-form") || tappButton.parentElement;
      form?.setAttribute("data-tapp-form", "");
    }
    doc.querySelectorAll("[data-tapp-edit]").forEach((button) => button.classList.add("dm-edit-button"));
    doc.querySelectorAll(".ed-lrow button").forEach((button) => {
      if (/✏|edit|modifica/i.test(button.textContent || button.getAttribute("aria-label") || "")) {
        button.classList.add("dm-edit-button");
      }
    });
  }

  function normalizedToken(value) {
    return clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function repairAppliance(item, states) {
    const tokens = [item.name, item.device_type, item.visual_key].map(normalizedToken).filter((token) => token.length >= 3);
    const explicit = [item.control_entity, item.power_entity, item.energy_entity, item.daily_energy_entity, item.monthly_energy_entity, item.total_energy_entity, item.report_entity, item.history_entity, ...(item.entities || [])].map(clean).filter(Boolean);
    const discovered = Object.keys(states).filter((id) => {
      const text = normalizedToken(`${id} ${states[id]?.attributes?.friendly_name || ""}`);
      return tokens.some((token) => text.includes(token));
    });
    const ids = [...new Set([...explicit, ...discovered])];
    const metadata = ids.map((id) => {
      const attributes = states[id]?.attributes || {};
      return {
        id,
        domain: id.split(".")[0],
        unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
        deviceClass: clean(attributes.device_class).toLowerCase(),
        text: normalizedToken(`${id} ${attributes.friendly_name || ""}`),
      };
    });
    const control = metadata.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id || "";
    const power = metadata.find((entry) => /^(w|kw)$/.test(entry.unit) || entry.deviceClass === "power" || /(^|_)(power|potenza|watt)($|_)/.test(entry.text))?.id || "";
    const energies = metadata.filter((entry) => /^(wh|kwh|mwh)$/.test(entry.unit) || entry.deviceClass === "energy" || /(^|_)(energy|energia|kwh)($|_)/.test(entry.text));
    const daily = energies.find((entry) => /oggi|today|daily|giorn|day/.test(entry.text))?.id || "";
    const monthly = energies.find((entry) => /mese|month|monthly/.test(entry.text))?.id || "";
    const total = energies.find((entry) => /totale|total|lifetime|counter|meter/.test(entry.text))?.id || "";
    const energy = clean(item.energy_entity) || monthly || total || daily || energies[0]?.id || "";
    const report = clean(item.report_entity) || monthly || total || daily || energy;
    return {
      ...item,
      entities: ids,
      control_entity: clean(item.control_entity) || control,
      power_entity: clean(item.power_entity) || power,
      energy_entity: energy,
      daily_energy_entity: clean(item.daily_energy_entity) || daily,
      monthly_energy_entity: clean(item.monthly_energy_entity) || monthly,
      total_energy_entity: clean(item.total_energy_entity) || total,
      report_entity: report,
      history_entity: clean(item.history_entity) || report || power,
      show_in_report: item.show_in_report !== false,
    };
  }

  async function repairAppliances() {
    const dashboardStore = store();
    if (!dashboardStore?.getSection || !dashboardStore?.replaceSection || state.repairing) return false;
    const current = dashboardStore.getSection("appliances") || [];
    if (!current.length) {
      state.repaired = true;
      root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = { installed: true, version: "0.15.0" };
      return true;
    }
    const repaired = current.map((item) => repairAppliance(item, allStates()));
    const signature = (item) => JSON.stringify({ entities: item.entities || [], control: item.control_entity || "", power: item.power_entity || "", energy: item.energy_entity || "", total: item.total_energy_entity || "", report: item.report_entity || "", history: item.history_entity || "" });
    if (!current.every((item, index) => signature(item) === signature(repaired[index]))) {
      state.repairing = true;
      try {
        await dashboardStore.replaceSection("appliances", repaired);
      } finally {
        state.repairing = false;
      }
    }
    state.repaired = true;
    root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = { installed: true, version: "0.15.0" };
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
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
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
    list.innerHTML = entries.map(({ group, entity }) => `<article class="dm-standard-alert-row"><span><strong>${alertName(entity)}</strong><small>${entity}</small></span><button type="button" class="dm-edit-button" data-real-alert-edit="" data-standard-alert-edit="" data-alert-group="${group}" data-alert-entity="${entity}">✏️</button></article>`).join("");
  }

  function saveEditedAlert() {
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
    if (typeof current !== "function" || current.__dmFinalAlertSave) return;
    state.alertSaveOriginal ||= current;
    function addAlertFinal(...args) {
      if (saveEditedAlert()) return;
      return current.apply(this, args);
    }
    addAlertFinal.__dmFinalAlertSave = true;
    addAlertFinal.__dmPrevious = current;
    root.edAddAvviso = addAlertFinal;
  }

  function installSafeEnergyView() {
    const current = root.switchEnergyView;
    if (current?.__dmSafeEnergyView0150) return;
    function safeEnergyView0150(view, eventArg) {
      root.navigator?.vibrate?.(5);
      doc.querySelectorAll(".sub-tab-btn").forEach((button) => button.classList.remove("active"));
      doc.querySelectorAll(".flow-view").forEach((panel) => panel.classList.remove("active"));
      const eventButton = eventArg?.currentTarget || root.event?.currentTarget;
      const button = eventButton || [...doc.querySelectorAll(".sub-tab-btn")].find((node) => {
        const text = `${node.dataset.view || ""} ${node.getAttribute("onclick") || ""} ${node.textContent || ""}`.toLowerCase();
        return text.includes(String(view).toLowerCase());
      });
      button?.classList.add("active");
      doc.getElementById(`view-${view}`)?.classList.add("active");
      doc.getElementById(`ed-pane-${view}`)?.classList.add("active");
      root.scrollTo?.({ top: 0, behavior: "instant" });
      if (view === "panoramica") root.renderEnergyDashboard?.();
      if (view === "temp") root.renderInverterTemp?.();
    }
    safeEnergyView0150.__dmSafeEnergyView0150 = true;
    safeEnergyView0150.__dmPrevious = current;
    root.switchEnergyView = safeEnergyView0150;
  }

  function applyAll() {
    publishContracts();
    installStyles();
    installBrokerProjection();
    projectBundle();
    installSafeEnergyView();
    applyEditorContracts();
    normalizeApplianceCards();
    renderAlerts();
    installAlertSave();
    repairAppliances().catch((error) => root.console?.warn?.("[DashboardModern 0.15.0] appliance repair", error));
  }

  function wrap(name) {
    if (state.wrapped.has(name)) return;
    const current = root[name];
    if (typeof current !== "function" || current.__dmFinalOwner) return;
    function finalOwnerRender(...args) {
      const result = current.apply(this, args);
      const finish = () => root.queueMicrotask?.(applyAll);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    finalOwnerRender.__dmFinalOwner = true;
    finalOwnerRender.__dmPrevious = current;
    root[name] = finalOwnerRender;
    state.wrapped.add(name);
  }

  function settle() {
    state.attempts += 1;
    ["apriConfigEntita", "editorSwitch", "renderApplianceSection", "renderAppliances", "renderEnergy", "renderEnergyDashboard", "renderEdDeviceList", "renderTemperature", "buildTempCards", "renderReport"].forEach(wrap);
    applyAll();
    if ((!store() || !runtime() || !state.repaired) && state.attempts < 180) root.requestAnimationFrame?.(settle);
  }

  doc.addEventListener("click", (event) => {
    const add = event.target?.closest?.("[data-report-add]");
    if (add) {
      const panel = add.closest('[data-energy-panel="report"]');
      const form = panel?.querySelector("[data-report-manual]");
      if (!form) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const expanded = add.getAttribute("aria-expanded") === "true";
      add.setAttribute("aria-expanded", String(!expanded));
      form.hidden = expanded;
      form.style.display = expanded ? "none" : "";
      return;
    }
    const edit = event.target?.closest?.("[data-real-alert-edit],[data-standard-alert-edit]");
    if (edit) {
      event.preventDefault();
      state.alertEdit = { group: clean(edit.dataset.alertGroup), entity: clean(edit.dataset.alertEntity) };
      const group = doc.getElementById("ed-avv-grp");
      const entity = doc.getElementById("ed-avv-ent");
      const name = doc.getElementById("ed-avv-name");
      if (group) group.value = state.alertEdit.group;
      if (entity) entity.value = state.alertEdit.entity;
      if (name) name.value = alertName(state.alertEdit.entity);
      return;
    }
    const toggle = event.target?.closest?.('[data-dm-power-toggle="true"]');
    if (!toggle) return;
    event.preventDefault();
    const entity = clean(toggle.dataset.entity);
    if (!entity) return;
    root.dmCallHaService?.(entity.split(".")[0], toggle.dataset.state === "on" ? "turn_off" : "turn_on", { entity_id: entity });
  }, true);

  doc.addEventListener("change", (event) => {
    if (event.target?.id !== "dm-temperature-room") return;
    const room = store()?.getSection?.("rooms")?.find((item) => clean(item.id) === clean(event.target.value));
    const icon = doc.getElementById("dm-temperature-icon");
    if (icon) icon.value = clean(room?.icon) || "mdi:home";
  }, true);

  root.addEventListener?.("dashboardmodern:energy-periods-0154", (event) => {
    event.stopImmediatePropagation();
  }, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    projectBundle(event.detail);
    root.queueMicrotask?.(applyAll);
  });
  root.addEventListener?.("dashboardmodern:energy-statistics", () => root.queueMicrotask?.(applyAll));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));

  publishContracts();
  installStyles();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
