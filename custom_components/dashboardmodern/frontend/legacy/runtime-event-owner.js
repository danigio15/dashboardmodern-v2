/* DashboardModern 0.15.0 — bounded event owner for canonical startup and DOM renders. */
(function installRuntimeEventOwner0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RUNTIME_EVENT_OWNER_0150__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    wrappers: false,
    listeners: false,
    refreshing: false,
    refreshed: false,
    coverEditId: "",
    repairing: false,
  });
  const clean = (value) => String(value || "").trim();
  const english = () => doc.documentElement.lang === "en";
  const store = () => root.DashboardModernModules?.store || null;
  const api = () => root.DashboardModernRuntime0150 || null;
  const states = () => ({ ...(root._RAW_STATES || {}), ...(root.STATES || {}) });

  function publishLegacyContracts() {
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

  function installFinalStyles() {
    if (doc.getElementById("dm-release-0154-final-artwork-lock")) return;
    const style = doc.createElement("style");
    style.id = "dm-release-0154-final-artwork-lock";
    style.textContent = `
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell{background:var(--card-bg,#161f36)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .dm-report-row{background:var(--surface-2,#1b2540)!important;color:var(--text,#e6edf7)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-input{background:var(--surface-3,#212d4c)!important;color:var(--text,#e6edf7)!important;border-color:var(--card-border,#263453)!important}
      #editor-modal[data-dm-editor-theme="dark"] .ed-slot-lbl{color:var(--text-dim,#92a4c2)!important}
      html body #page-appliances-main .appl-wide-card{background:var(--card-bg,#fff)!important;color:var(--text,#0f172a)!important;border-color:var(--card-border,rgba(15,23,42,.12))!important}
      html body #page-appliances-main .appl-visual,
      html body #page-appliances-main .appl-ic,
      html body #page-appliances-main .dm-appliance-image-wrap,
      html body #page-appliances-main .dm-appliance-art-0154{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-image{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;object-fit:cover!important;object-position:50% 50%!important;transform:none!important}
      html body #page-appliances-main .dm-appliance-art-0154>svg{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important;transform:none!important}
      html body #page-appliances-main .appl-spark{display:none!important}
      html body #dm-shutter-popup header{position:relative!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;min-height:48px!important;padding-right:56px!important}
      html body #dm-shutter-popup header h2{margin:0!important;min-width:0!important}
      html body #dm-shutter-popup [data-shutter-popup-close]{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important}
      html body #dm-shutter-popup .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      html body #dm-shutter-popup .dm-shutter-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important}
    `;
    doc.head.append(style);
  }

  function currentBundle() {
    return root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle || null;
  }

  function isCurrentPeriod(bundle) {
    if (!bundle?.period) return false;
    const now = new Date();
    return Number(bundle.period.month) === now.getMonth() + 1 &&
      Number(bundle.period.year) === now.getFullYear();
  }

  function setMonthText(id, value) {
    const node = doc.getElementById(id);
    if (!node || !Number.isFinite(Number(value))) return;
    const formatted = Number(value).toLocaleString(english() ? "en-US" : "it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    node.textContent = `${formatted} kWh`;
  }

  function applyCurrentEnergy() {
    const bundle = currentBundle();
    if (!isCurrentPeriod(bundle)) return;
    const month = bundle.month || {};
    root.CD_PERIOD ||= {};
    const slots = {
      "dm.energy_consumo_casa_mese": month.house,
      "dm.energy_produzione_solare_mese": month.solar,
      "dm.energy_rete_acquistata_mese": month.gridImport,
      "dm.energy_rete_venduta_mese": month.gridExport,
      "dm.energy_batteria_caricata_mese": month.batteryCharged,
      "dm.energy_batteria_usata_mese": month.batteryDischarged,
    };
    Object.entries(slots).forEach(([slot, value]) => {
      if (Number.isFinite(Number(value))) root.CD_PERIOD[slot] = Number(value);
    });
    setMonthText("v-solar-month", month.solar);
    setMonthText("v-home-month", month.house);
    const grid = doc.getElementById("v-grid-month");
    if (grid) grid.textContent = `↓ ${Number(month.gridImport || 0).toLocaleString(english() ? "en-US" : "it-IT")} kWh ↑ ${Number(month.gridExport || 0).toLocaleString(english() ? "en-US" : "it-IT")} kWh`;
    const battery = doc.getElementById("v-battery-month");
    if (battery) battery.textContent = `↓ ${Number(month.batteryCharged || 0).toLocaleString(english() ? "en-US" : "it-IT")} kWh ↑ ${Number(month.batteryDischarged || 0).toLocaleString(english() ? "en-US" : "it-IT")} kWh`;
  }

  async function refreshCanonicalPeriod() {
    if (state.refreshing || !store() || typeof api()?.refreshSelectedPeriod !== "function") return false;
    state.refreshing = true;
    try {
      const result = await api().refreshSelectedPeriod();
      state.refreshed = Boolean(result);
      applyCurrentEnergy();
      return Boolean(result);
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.0] canonical startup refresh", error);
      return false;
    } finally {
      state.refreshing = false;
    }
  }

  function canonicalArtworkToken(device) {
    const token = clean(device?.visual_key || device?.device_type || device?.type || device?.icon || device?.name).toLowerCase();
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

  function ensurePowerToggle(card, device, allStates) {
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
    const on = allStates[entity]?.state === "on";
    button.dataset.entity = entity;
    button.dataset.state = on ? "on" : "off";
    button.textContent = on ? (english() ? "Turn off" : "Spegni") : (english() ? "Turn on" : "Accendi");
  }

  function normalizeApplianceCards() {
    const devices = store()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((item) => [clean(item.id), item]));
    const allStates = states();
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
      const token = canonicalArtworkToken(device);
      const imageUrl = clean(device.image || device.image_url);
      if (imageUrl) {
        icon.innerHTML = `<span class="dm-appliance-image-wrap"><img class="dm-appliance-image" alt=""></span>`;
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
      card.dataset.dmArtwork = token;
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      visual.dataset.applianceCover = "true";
      ensurePowerToggle(card, device, allStates);
    });
  }

  function applyEditorContracts() {
    const modal = doc.getElementById("editor-modal");
    if (modal) modal.dataset.dmEditorTheme = doc.documentElement.dataset.theme === "dark" ? "dark" : "light";

    const icon = doc.getElementById("dm-temperature-icon");
    if (icon) {
      icon.type = "hidden";
      if (!clean(icon.value)) icon.value = "mdi:home";
      const label = icon.closest("label");
      if (label) {
        label.hidden = true;
        label.style.display = "none";
      }
    }

    doc.querySelectorAll("[data-report-add]").forEach((button) => {
      if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
      const panel = button.closest('[data-energy-panel="report"]') || button.parentElement;
      const form = panel?.querySelector("[data-report-manual]");
      if (form) form.hidden = button.getAttribute("aria-expanded") !== "true";
    });

    doc.querySelectorAll("input[data-entity-input]").forEach((input) => {
      const value = clean(input.value);
      input.dataset.validation = value ? (/^[a-z_]+\.[a-z0-9_]+$/i.test(value) ? "valid" : "invalid") : "empty";
    });
  }

  function metadata(id, allStates) {
    const entity = clean(id);
    const attributes = allStates[entity]?.attributes || {};
    return {
      id: entity,
      domain: entity.split(".")[0],
      unit: clean(attributes.unit_of_measurement).toLowerCase().replace(/\s+/g, ""),
      deviceClass: clean(attributes.device_class).toLowerCase(),
      text: `${entity} ${clean(attributes.friendly_name)}`.toLowerCase(),
    };
  }

  function repairItem(item, allStates) {
    const ids = [...new Set([
      item.control_entity,
      item.power_entity,
      item.energy_entity,
      item.daily_energy_entity,
      item.monthly_energy_entity,
      item.total_energy_entity,
      item.report_entity,
      item.history_entity,
      ...(item.entities || []),
    ].map(clean).filter(Boolean))];
    const list = ids.map((id) => metadata(id, allStates));
    const control = list.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id || "";
    const power = list.find((entry) => /^(w|kw)$/.test(entry.unit) || entry.deviceClass === "power" || /power|potenza|watt/.test(entry.text))?.id || "";
    const energies = list.filter((entry) => /^(wh|kwh|mwh)$/.test(entry.unit) || entry.deviceClass === "energy" || /energy|energia|kwh/.test(entry.text));
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
    if (!current.length) return true;
    const repaired = current.map((item) => repairItem(item, states()));
    const signature = (item) => JSON.stringify({
      entities: item.entities || [], control_entity: item.control_entity || "", power_entity: item.power_entity || "",
      energy_entity: item.energy_entity || "", daily_energy_entity: item.daily_energy_entity || "",
      monthly_energy_entity: item.monthly_energy_entity || "", total_energy_entity: item.total_energy_entity || "",
      report_entity: item.report_entity || "", history_entity: item.history_entity || "", show_in_report: item.show_in_report !== false,
    });
    if (current.every((item, index) => signature(item) === signature(repaired[index]))) return true;
    state.repairing = true;
    try {
      await dashboardStore.replaceSection("appliances", repaired);
    } finally {
      state.repairing = false;
    }
    return true;
  }

  function coverOptions(selected) {
    return (store()?.getSection?.("rooms") || []).map((room) =>
      `<option value="${clean(room.id)}" ${clean(room.id) === clean(selected) ? "selected" : ""}>${clean(room.name)}</option>`,
    ).join("");
  }

  function canonicalCovers() {
    return store()?.getSection?.("covers") || [];
  }

  function installCoverEditor() {
    if (!store()) return false;
    root.getTapparelle = () => canonicalCovers().map((item) => {
      const value = { name: item.name || item.entity, entity: item.entity || item.entities?.[0] || "" };
      if (item.room_id) value.room = item.room_id;
      return value;
    });
    root.editorRenderTapparelle = function renderCovers0150() {
      const covers = canonicalCovers();
      const current = covers.find((item) => clean(item.id) === state.coverEditId) || null;
      const rows = covers.map((item, index) => `<div class="ed-row" data-tapp-id="${clean(item.id)}"><div class="ed-row-main"><div class="ed-row-new">🪟 ${clean(item.name || item.entity)}</div><div class="ed-row-old mono">${clean(item.entity || item.entities?.[0])}</div></div><div class="dm-row-actions"><button type="button" class="ed-del" data-tapp-edit="${index}" onclick="edTappEdit(${index})">✏️</button><button type="button" class="ed-del" onclick="edTappDel(${index})">🗑️</button></div></div>`).join("");
      return `<div class="ed-list">${rows || `<div class="ed-empty">${english() ? "No shutters configured." : "Nessuna tapparella configurata."}</div>`}</div><div class="ed-form dm-tapp-form" data-tapp-form><div class="ed-sec-title">${current ? (english() ? "Edit shutter" : "Modifica tapparella") : (english() ? "Add shutter" : "Aggiungi tapparella")}</div><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Name" : "Nome"}</span><input id="ed-tp-name" class="ed-input" value="${clean(current?.name)}"></label><label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${english() ? "Cover entity" : "Entità cover"}</span><span class="ed-form-row"><input id="ed-tp-ent" class="ed-input mono" data-entity-input value="${clean(current?.entity || current?.entities?.[0])}" placeholder="cover.tapparella_salone"><button type="button" class="dm-entity-picker" data-entity-target="ed-tp-ent">🔍</button></span></label><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Room" : "Stanza"}</span><select id="ed-tp-room" class="ed-input"><option value=""></option>${coverOptions(current?.room_id)}</select></label><div class="dm-temperature-actions"><button type="button" class="ed-btn-add" onclick="edTappAdd()">${current ? (english() ? "💾 Save changes" : "💾 Salva modifiche") : (english() ? "＋ Add shutter" : "＋ Aggiungi tapparella")}</button></div></div>`;
    };
    root.edTappEdit = function editCover0150(idOrIndex) {
      const covers = canonicalCovers();
      const numeric = Number(idOrIndex);
      state.coverEditId = covers.some((item) => clean(item.id) === clean(idOrIndex)) ? clean(idOrIndex) : (Number.isInteger(numeric) && covers[numeric] ? clean(covers[numeric].id) : "");
      root.editorSwitch?.("tapp");
    };
    root.edTappAdd = async function saveCover0150() {
      const entity = clean(doc.getElementById("ed-tp-ent")?.value);
      if (!/^cover\.[a-z0-9_]+$/i.test(entity)) return;
      const value = {
        name: clean(doc.getElementById("ed-tp-name")?.value) || entity,
        entity,
        entities: [entity],
        room_id: clean(doc.getElementById("ed-tp-room")?.value),
        enabled: true,
      };
      if (state.coverEditId) await store().updateItem("covers", state.coverEditId, value);
      else await store().addItem("covers", value);
      state.coverEditId = "";
      root.editorSwitch?.("tapp");
    };
    root.edTappDel = async function deleteCover0150(idOrIndex) {
      const covers = canonicalCovers();
      const numeric = Number(idOrIndex);
      const id = covers.some((item) => clean(item.id) === clean(idOrIndex)) ? clean(idOrIndex) : (Number.isInteger(numeric) && covers[numeric] ? clean(covers[numeric].id) : "");
      if (!id) return;
      await store().removeItem("covers", id);
      root.editorSwitch?.("tapp");
    };
    return true;
  }

  function applyAll() {
    publishLegacyContracts();
    installFinalStyles();
    installCoverEditor();
    applyEditorContracts();
    normalizeApplianceCards();
    applyCurrentEnergy();
    repairAppliances().catch((error) => root.console?.warn?.("[DashboardModern] appliance repair", error));
  }

  function wrap(name) {
    const original = root[name];
    if (typeof original !== "function" || original.__dm0150EventOwner) return false;
    function wrapped0150(...args) {
      const result = original.apply(this, args);
      const finish = () => root.queueMicrotask?.(applyAll);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    wrapped0150.__dm0150EventOwner = true;
    wrapped0150.__dmPrevious = original;
    root[name] = wrapped0150;
    return true;
  }

  function settle(attempt = 0) {
    installCoverEditor();
    [
      "apriConfigEntita", "editorSwitch", "renderApplianceSection", "renderAppliances",
      "renderEnergy", "switchEnergyView", "renderEdDeviceList", "renderTemperature", "buildTempCards",
    ].forEach(wrap);
    applyAll();
    if (store() && api()) {
      state.wrappers = true;
      refreshCanonicalPeriod();
      return true;
    }
    if (attempt >= 120) return false;
    root.requestAnimationFrame?.(() => settle(attempt + 1));
    return false;
  }

  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("input", (event) => {
      const input = event.target?.matches?.("input[data-entity-input]") ? event.target : null;
      if (!input) return;
      const value = clean(input.value);
      input.dataset.validation = value ? (/^[a-z_]+\.[a-z0-9_]+$/i.test(value) ? "valid" : "invalid") : "empty";
    });
    doc.addEventListener("click", (event) => {
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

  publishLegacyContracts();
  installFinalStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(() => settle()));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(() => settle()));
  root.addEventListener?.("dashboardmodern:period-bundle", () => root.queueMicrotask?.(applyAll));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(() => settle()));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => settle(), { once: true });
  else settle();
})(globalThis);
