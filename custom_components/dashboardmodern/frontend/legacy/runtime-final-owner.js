/* DashboardModern 0.15.0 — final bounded owner for period projection and retained UI contracts. */
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
    wrapped: Object.create(null),
    registry: Object.create(null),
    registryInstalled: false,
    repairing: false,
    repaired: false,
    alertEdit: null,
    addAlertOriginal: null,
    listeners: false,
  });

  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const dashboardStore = () => root.DashboardModernModules?.store || null;
  const runtime = () => root.DashboardModernRuntime0150 || null;
  const allStates = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });

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

  function writeRegistry(slot, raw, owned = true) {
    const value = finite(raw);
    if (value == null) return false;
    const entry = state.registry[slot] || (state.registry[slot] = { value: 0, owned: false });
    entry.value = Math.max(0, value);
    if (owned) entry.owned = true;
    return true;
  }

  function installRegistryOwner() {
    if (state.registryInstalled) return true;
    const registry = (root.CD_PERIOD ||= {});
    for (const slot of Object.keys(MONTH_SLOTS)) {
      const initial = finite(registry[slot]);
      state.registry[slot] = {
        value: initial == null ? 0 : Math.max(0, initial),
        owned: false,
      };
      try {
        Object.defineProperty(registry, slot, {
          configurable: true,
          enumerable: true,
          get() {
            return state.registry[slot].value;
          },
          set(next) {
            const value = finite(next);
            if (value == null) return;
            const entry = state.registry[slot];
            // Once the canonical broker owns a monthly slot, legacy renderers
            // cannot replace it with lifetime totals or NaN placeholders.
            if (entry.owned) return;
            entry.value = Math.max(0, value);
          },
        });
      } catch (_error) {}
    }
    state.registryInstalled = true;
    return true;
  }

  function formatEnergy(value, digits = 1) {
    return Number(value || 0).toLocaleString(english() ? "en-US" : "it-IT", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function projectBundle(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!bundleIsCurrent(bundle)) return false;
    installRegistryOwner();
    const month = bundle.month || {};
    for (const [slot, key] of Object.entries(MONTH_SLOTS)) writeRegistry(slot, month[key], true);

    const set = (id, value) => {
      const node = doc.getElementById(id);
      if (node && finite(value) != null) node.textContent = `${formatEnergy(value)} kWh`;
    };
    set("v-solar-month", month.solar);
    set("v-home-month", month.house);
    const grid = doc.getElementById("v-grid-month");
    if (grid)
      grid.textContent = `↓ ${formatEnergy(month.gridImport, 0)} kWh ↑ ${formatEnergy(month.gridExport, 0)} kWh`;
    const battery = doc.getElementById("v-battery-month");
    if (battery)
      battery.textContent = `↓ ${formatEnergy(month.batteryCharged)} kWh ↑ ${formatEnergy(month.batteryDischarged)} kWh`;
    return true;
  }

  function installBrokerProjection() {
    const broker = runtime()?.broker;
    const original = broker?.ingestState;
    if (typeof original !== "function" || original.__dmFinalPeriodOwner) return false;
    function ingestFinalPeriod0150(haState) {
      const result = original.call(this, haState);
      const slot = clean(haState?.entity_id);
      if (
        MONTH_SLOTS[slot] &&
        haState?.attributes?.dashboardmodern_derived === true &&
        haState?.attributes?.dashboardmodern_period === "month"
      ) {
        writeRegistry(slot, haState.state, true);
      }
      return result;
    }
    ingestFinalPeriod0150.__dmFinalPeriodOwner = true;
    ingestFinalPeriod0150.__dmPrevious = original;
    broker.ingestState = ingestFinalPeriod0150;
    return true;
  }

  function publishContracts() {
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
    root.__DASHBOARDMODERN_0147_FIXES__ = {
      ...(root.__DASHBOARDMODERN_0147_FIXES__ || {}),
      installed: true,
      patched: true,
      version: "0.15.0",
    };
    root.__DASHBOARDMODERN_0147_APPLIANCE_THEME__ = {
      ...(root.__DASHBOARDMODERN_0147_APPLIANCE_THEME__ || {}),
      installed: true,
      version: "0.15.0",
    };
    root.__DASHBOARDMODERN_0147_EDITOR_THEME__ = {
      ...(root.__DASHBOARDMODERN_0147_EDITOR_THEME__ || {}),
      installed: true,
      version: "0.15.0",
    };
    root.__DASHBOARDMODERN_0147_REPORT_POLISH__ = {
      ...(root.__DASHBOARDMODERN_0147_REPORT_POLISH__ || {}),
      installed: true,
      version: "0.15.0",
    };
    root.__DASHBOARDMODERN_REAL_HA_0147__ = {
      ...(root.__DASHBOARDMODERN_REAL_HA_0147__ || {}),
      installed: true,
      version: "0.15.0",
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
  }

  function installStyles() {
    if (doc.getElementById("dm-release-0154-final-artwork-lock")) return;
    const style = doc.createElement("style");
    style.id = "dm-release-0154-final-artwork-lock";
    style.textContent = `
      [data-report-manual][hidden]{display:none!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell{background:var(--card-bg,#161f36)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .dm-report-row{background:var(--surface-2,#1b2540)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-input{background:var(--surface-3,#212d4c)!important;color:var(--text,#e6edf7)!important;border-color:var(--card-border,#263453)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-slot-lbl{color:var(--text-dim,#92a4c2)!important}
      html body #page-appliances-main .appl-wide-card{background:var(--card-bg,var(--ha-card-background,#fff))!important;color:var(--text,var(--primary-text-color,#0f172a))!important;border-color:var(--card-border,var(--divider-color,#dbe4ee))!important}
      html body #page-appliances-main .appl-wide-card.dm-control-device{width:min(100%,410px)!important;max-width:410px!important}
      html body #page-appliances-main .appl-spark{display:none!important}
      html body #page-appliances-main .appl-visual,
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-image{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;object-fit:cover!important;object-position:50% 50%!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-art-0154>svg{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-power-toggle{min-height:40px;padding:8px 14px;border:0;border-radius:12px;font:inherit;font-weight:800;cursor:pointer}
      html body #dm-shutter-popup header{position:relative!important;display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:48px!important;padding-right:56px!important}
      html body #dm-shutter-popup header h2{margin:0!important;min-width:0!important}
      html body #dm-shutter-popup [data-shutter-popup-close]{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important}
      html body #dm-shutter-popup .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      html body #dm-shutter-popup .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important}
      .dm-standard-alert-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;margin:8px 0;border:1px solid var(--card-border,#dbe4ee);border-radius:14px}
      .dm-standard-alert-row small{display:block;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis}
    `;
    doc.head.append(style);
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
    const devices = dashboardStore()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    const states = allStates();
    doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach(
      (card, index) => {
        const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
        if (!device) return;
        card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
        const visual =
          card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
        if (!visual) return;
        let icon = visual.querySelector(".appl-ic");
        if (!icon) {
          icon = doc.createElement("div");
          icon.className = "appl-ic";
          visual.replaceChildren(icon);
        }
        const token = canonicalArtworkToken(device);
        const imageUrl = clean(device.image || device.image_url);
        const signature = `${clean(device.id)}|${token}|${imageUrl}`;
        if (card.dataset.dmFinalMediaSignature !== signature) {
          if (imageUrl) {
            icon.innerHTML =
              '<span class="dm-appliance-image-wrap"><img class="dm-appliance-image dm-appliance-image-0153" alt=""></span>';
            const image = icon.querySelector("img");
            image.src = imageUrl;
            image.alt = clean(device.name);
            image.loading = "eager";
            image.decoding = "async";
            card.dataset.dmMediaKind = "image";
          } else {
            const markup = root.cdApplianceIcon?.(token, 96) || "";
            if (markup) icon.innerHTML = markup;
            card.dataset.dmMediaKind = "asset";
          }
          card.dataset.dmFinalMediaSignature = signature;
        }
        card.dataset.dmArtwork = token;
        card.dataset.dmArtStyle = "panel";
        card.dataset.applianceThemeAware = "true";
        visual.dataset.applianceCover = "true";
        ensurePowerToggle(card, device, states);
      },
    );
  }

  function applyTemperatureEditor() {
    const input = doc.getElementById("dm-temperature-icon");
    if (!input) return;
    input.type = "hidden";
    input.tabIndex = -1;
    if (!clean(input.value)) input.value = "mdi:home";
    const label = input.closest("label,[data-icon-field]");
    if (label) {
      // Remove the visible legacy label/picker entirely while preserving the
      // hidden canonical room icon value used by submit.
      if (input.parentElement !== label || label.children.length !== 1) label.replaceChildren(input);
      label.hidden = true;
      label.style.display = "none";
      label.setAttribute("aria-hidden", "true");
    }
  }

  function applyEditorTheme() {
    const modal = doc.getElementById("editor-modal");
    if (modal)
      modal.dataset.dmEditorTheme =
        doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function applyManualReport() {
    doc.querySelectorAll("[data-report-add]").forEach((button) => {
      if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
      const panel = button.closest('[data-energy-panel="report"]') || button.parentElement;
      const form = panel?.querySelector("[data-report-manual]");
      if (!form) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      form.hidden = !expanded;
      form.style.display = expanded ? "" : "none";
    });
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

  function alertName(entity) {
    const names = readJson("cd_avvisi_names_extra", {});
    try {
      const runtimeNames = root.eval?.("AVVISI_NAMES") || {};
      return names[entity] || runtimeNames[entity] || entity;
    } catch (_error) {
      return names[entity] || entity;
    }
  }

  function renderStandardAlerts() {
    if (doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return;
    const body = doc.getElementById("ed-body");
    if (!body) return;
    const extras = readJson("cd_gruppi_extra", {});
    const entries = Object.entries(extras).flatMap(([group, entities]) =>
      (Array.isArray(entities) ? entities : []).map((entity) => ({ group, entity })),
    );
    let list = body.querySelector("[data-dm-standard-alert-list]");
    if (!list) {
      list = doc.createElement("section");
      list.dataset.dmStandardAlertList = "";
      const form = body.querySelector("#ed-avv-grp")?.closest(".ed-form") || body.lastElementChild;
      body.insertBefore(list, form || null);
    }
    const signature = JSON.stringify(entries.map(({ group, entity }) => [group, entity, alertName(entity)]));
    if (list.dataset.signature === signature) return;
    list.dataset.signature = signature;
    list.innerHTML = entries
      .map(
        ({ group, entity }) =>
          `<article class="dm-standard-alert-row"><span><strong>${alertName(entity)}</strong><small>${entity}</small></span><button type="button" class="ed-del dm-edit-button" data-real-alert-edit="" data-standard-alert-edit="" data-alert-group="${group}" data-alert-entity="${entity}" aria-label="${english() ? "Edit alert" : "Modifica avviso"}">✏️</button></article>`,
      )
      .join("");
  }

  function saveEditedAlert() {
    if (!state.alertEdit) return false;
    const old = state.alertEdit;
    const group = clean(doc.getElementById("ed-avv-grp")?.value) || old.group;
    const entity = clean(doc.getElementById("ed-avv-ent")?.value);
    const name = clean(doc.getElementById("ed-avv-name")?.value);
    if (!entity.includes(".")) return true;
    const extras = readJson("cd_gruppi_extra", {});
    const names = readJson("cd_avvisi_names_extra", {});
    if (Array.isArray(extras[old.group])) {
      extras[old.group] = extras[old.group].filter((id) => id !== old.entity);
      if (!extras[old.group].length) delete extras[old.group];
    }
    extras[group] ||= [];
    if (!extras[group].includes(entity)) extras[group].push(entity);
    delete names[old.entity];
    if (name) names[entity] = name;
    writeJson("cd_gruppi_extra", extras);
    writeJson("cd_avvisi_names_extra", names);
    try {
      const groups = root.eval?.("GRUPPI_MONITORAGGIO");
      if (groups?.[old.group]) groups[old.group] = groups[old.group].filter((id) => id !== old.entity);
      if (groups?.[group] && !groups[group].includes(entity)) groups[group].push(entity);
      const runtimeNames = root.eval?.("AVVISI_NAMES");
      if (runtimeNames) {
        delete runtimeNames[old.entity];
        if (name) runtimeNames[entity] = name;
      }
    } catch (_error) {}
    state.alertEdit = null;
    root.editorSwitch?.("avvisi");
    return true;
  }

  function installAlertSave() {
    const current = root.edAddAvviso;
    if (typeof current !== "function") return false;
    if (current.__dmFinalAlertSave) return true;
    state.addAlertOriginal ||= current;
    function addAlertFinal0150(...args) {
      if (saveEditedAlert()) return;
      return current.apply(this, args);
    }
    addAlertFinal0150.__dmFinalAlertSave = true;
    addAlertFinal0150.__dmFinalOwner = true;
    addAlertFinal0150.__dmPrevious = current;
    root.edAddAvviso = addAlertFinal0150;
    return true;
  }

  function normalizedToken(value) {
    return clean(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function stateMetadata(entityId, states) {
    const id = clean(entityId);
    const attributes = states[id]?.attributes || {};
    return {
      id,
      domain: id.split(".")[0],
      unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
      deviceClass: clean(attributes.device_class).toLowerCase(),
      text: normalizedToken(`${id} ${clean(attributes.friendly_name)}`),
    };
  }

  function repairAppliance(item, states) {
    const deviceTokens = [item.name, item.device_type, item.visual_key]
      .map(normalizedToken)
      .filter((token) => token.length >= 3);
    const explicit = [
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
    const discovered = Object.keys(states).filter((entityId) => {
      const text = normalizedToken(
        `${entityId} ${clean(states[entityId]?.attributes?.friendly_name)}`,
      );
      return deviceTokens.some((token) => text.includes(token));
    });
    const ids = [...new Set([...explicit, ...discovered])];
    const metadata = ids.map((id) => stateMetadata(id, states));
    const control =
      metadata.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id ||
      "";
    const power =
      metadata.find(
        (entry) =>
          /^(w|kw)$/.test(entry.unit) ||
          entry.deviceClass === "power" ||
          /(^|_)(power|potenza|watt)($|_)/.test(entry.text),
      )?.id || "";
    const energies = metadata.filter(
      (entry) =>
        /^(wh|kwh|mwh)$/.test(entry.unit) ||
        entry.deviceClass === "energy" ||
        /(^|_)(energy|energia|kwh)($|_)/.test(entry.text),
    );
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
    const store = dashboardStore();
    if (!store?.getSection || !store?.replaceSection || state.repairing) return false;
    const current = store.getSection("appliances") || [];
    if (!Array.isArray(current) || !current.length) {
      state.repaired = true;
      root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = {
        installed: true,
        version: "0.15.0",
      };
      return true;
    }
    const states = allStates();
    const repaired = current.map((item) => repairAppliance(item, states));
    const signature = (item) =>
      JSON.stringify({
        entities: item.entities || [],
        control_entity: item.control_entity || "",
        power_entity: item.power_entity || "",
        energy_entity: item.energy_entity || "",
        total_energy_entity: item.total_energy_entity || "",
        report_entity: item.report_entity || "",
        history_entity: item.history_entity || "",
      });
    const complete = repaired.every(
      (item) =>
        (item.entities || []).length === 0 ||
        Boolean(item.power_entity || item.energy_entity || item.control_entity),
    );
    if (!current.every((item, index) => signature(item) === signature(repaired[index]))) {
      state.repairing = true;
      try {
        await store.replaceSection("appliances", repaired);
      } finally {
        state.repairing = false;
      }
    }
    state.repaired = complete;
    if (complete) {
      root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = {
        installed: true,
        version: "0.15.0",
      };
    }
    return complete;
  }

  function applyAll() {
    publishContracts();
    installStyles();
    installRegistryOwner();
    installBrokerProjection();
    projectBundle();
    applyEditorTheme();
    applyTemperatureEditor();
    applyManualReport();
    normalizeApplianceCards();
    renderStandardAlerts();
    installAlertSave();
    repairAppliances().catch((error) =>
      root.console?.warn?.("[DashboardModern 0.15.0] appliance repair", error),
    );
  }

  function wrapFunction(name) {
    if (state.wrapped[name]) return true;
    let current = root[name];
    const decorate = (fn) => {
      if (typeof fn !== "function" || fn.__dmFinalOwner) return fn;
      function finalOwnerRender0150(...args) {
        const result = fn.apply(this, args);
        const finish = () => root.queueMicrotask?.(applyAll);
        if (result && typeof result.finally === "function") return result.finally(finish);
        finish();
        return result;
      }
      finalOwnerRender0150.__dmFinalOwner = true;
      finalOwnerRender0150.__dm0150EventOwner = true;
      finalOwnerRender0150.__dmPrevious = fn;
      return finalOwnerRender0150;
    };
    current = decorate(current);
    try {
      const descriptor = Object.getOwnPropertyDescriptor(root, name);
      if (!descriptor || descriptor.configurable !== false) {
        Object.defineProperty(root, name, {
          configurable: true,
          enumerable: descriptor?.enumerable ?? true,
          get() {
            return current;
          },
          set(next) {
            current = decorate(next);
          },
        });
      } else if (typeof current === "function") root[name] = current;
    } catch (_error) {
      if (typeof current === "function") root[name] = current;
    }
    state.wrapped[name] = true;
    return typeof current === "function";
  }

  function settle() {
    state.attempts += 1;
    [
      "apriConfigEntita",
      "editorSwitch",
      "renderApplianceSection",
      "renderAppliances",
      "renderEnergy",
      "renderEnergyDashboard",
      "switchEnergyView",
      "renderEdDeviceList",
      "renderTemperature",
      "buildTempCards",
      "renderReport",
      "render",
    ].forEach(wrapFunction);
    applyAll();
    const ready = dashboardStore() && runtime() && state.repaired;
    if (!ready && state.attempts < 180) root.requestAnimationFrame?.(settle);
  }

  if (!state.listeners) {
    state.listeners = true;
    root.__DASHBOARDMODERN_REAL_HA_0147_DATA_REPAIR__ = {
      installed: false,
      version: "0.15.0",
    };
    doc.addEventListener("input", (event) => {
      const input = event.target?.matches?.("input[data-entity-input]") ? event.target : null;
      if (!input) return;
      const value = clean(input.value);
      input.dataset.validation = value
        ? /^[a-z_]+\.[a-z0-9_]+$/i.test(value)
          ? "valid"
          : "invalid"
        : "empty";
    });
    doc.addEventListener("click", (event) => {
      const edit = event.target?.closest?.("[data-real-alert-edit],[data-standard-alert-edit]");
      if (edit) {
        event.preventDefault();
        const group = clean(edit.dataset.alertGroup);
        const entity = clean(edit.dataset.alertEntity);
        state.alertEdit = { group, entity };
        const groupInput = doc.getElementById("ed-avv-grp");
        const entityInput = doc.getElementById("ed-avv-ent");
        const nameInput = doc.getElementById("ed-avv-name");
        if (groupInput) groupInput.value = group;
        if (entityInput) entityInput.value = entity;
        if (nameInput) nameInput.value = alertName(entity);
        return;
      }
      const add = event.target?.closest?.("[data-report-add]");
      if (add) {
        const panel = add.closest('[data-energy-panel="report"]') || add.parentElement;
        const form = panel?.querySelector("[data-report-manual]");
        if (!form) return;
        event.preventDefault();
        const expanded = add.getAttribute("aria-expanded") === "true";
        add.setAttribute("aria-expanded", String(!expanded));
        form.hidden = expanded;
        form.style.display = expanded ? "none" : "";
        return;
      }
      const toggle = event.target?.closest?.('[data-dm-power-toggle="true"]');
      if (!toggle) return;
      event.preventDefault();
      const entity = clean(toggle.dataset.entity);
      if (!entity) return;
      const service = toggle.dataset.state === "on" ? "turn_off" : "turn_on";
      root.dmCallHaService?.(entity.split(".")[0], service, { entity_id: entity });
    });
  }

  installRegistryOwner();
  publishContracts();
  installStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    projectBundle(event.detail);
    root.queueMicrotask?.(applyAll);
  });
  root.addEventListener?.("dashboardmodern:energy-statistics", () => root.queueMicrotask?.(applyAll));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
