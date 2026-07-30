/* Real Home Assistant acceptance fixes for the blocked 0.14.7 release. */
const FLAG = "__DASHBOARDMODERN_REAL_HA_0147__";
const isEnglish = () => document.documentElement.lang === "en";
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/"/g, "&quot;");
const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (_error) {
    return fallback;
  }
};
const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  try {
    globalThis.cdMarkDirty?.();
    globalThis.cdSyncPush?.();
  } catch (_error) {}
};

let applianceEditId = "";
let alertEdit = null;
let lightEditEntity = "";
let repairingAppliances = false;

function parentHass() {
  try {
    if (window.parent === window) return null;
    return window.parent.document.querySelector("home-assistant")?.hass || null;
  } catch (_error) {
    return null;
  }
}

function installSocketConstants() {
  const constructors = [globalThis.WebSocket];
  try {
    constructors.push(window.parent.__DASHBOARDMODERN_BRIDGE_WS__);
  } catch (_error) {}
  constructors.filter((value) => typeof value === "function").forEach((Socket) => {
    [["CONNECTING", 0], ["OPEN", 1], ["CLOSING", 2], ["CLOSED", 3]].forEach(([key, value]) => {
      if (Socket[key] == null) {
        try {
          Object.defineProperty(Socket, key, { value, configurable: true });
        } catch (_error) {}
      }
    });
  });
}

function installServiceBridgeFix() {
  installSocketConstants();
  const previous = globalThis.dmCallHaService;
  if (previous?.__dmRealHa0147) return true;
  if (typeof previous !== "function") return false;

  const fixed = async function dmCallHaServiceReal(domain, service, serviceData = {}) {
    const hass = parentHass();
    if (globalThis.__DASHBOARDMODERN_HOSTED__ && typeof hass?.callService === "function") {
      return hass.callService(domain, service, serviceData);
    }
    return previous.call(this, domain, service, serviceData);
  };
  fixed.__dmRealHa0147 = true;
  fixed.__dmPrevious = previous;
  globalThis.dmCallHaService = fixed;

  globalThis.cdTappCmd = async function cdTappCmdReal(button) {
    try {
      navigator.vibrate?.(15);
      const service = button?.getAttribute?.("data-svc");
      if (!service) return;
      const entities = button.hasAttribute("data-all")
        ? (globalThis.getTapparelle?.() || []).map((item) => item?.entity).filter(Boolean)
        : [button.closest?.("[data-tapp]")?.getAttribute?.("data-tapp")].filter(Boolean);
      if (!entities.length) return;
      button.disabled = true;
      await Promise.all(entities.map((entityId) => fixed("cover", service, { entity_id: entityId })));
    } catch (error) {
      globalThis.console?.error?.("[Tapparelle] servizio fallito", error);
      globalThis.alert?.(error?.message || String(error));
    } finally {
      if (button) button.disabled = false;
    }
  };
  return true;
}

function entityId(value) {
  return typeof value === "string" ? value.trim() : String(value?.entity || value?.entity_id || "").trim();
}

function dashboardStates() {
  try {
    return globalThis.eval("STATES") || {};
  } catch (_error) {
    return globalThis.STATES || {};
  }
}

function entityMetadata(id) {
  const state = dashboardStates()?.[id];
  const attributes = state?.attributes || {};
  return {
    id,
    domain: id.split(".")[0],
    unit: String(attributes.unit_of_measurement || "").toLowerCase().replace(/\s+/g, ""),
    deviceClass: String(attributes.device_class || "").toLowerCase(),
    name: id.toLowerCase(),
  };
}

function classifyAppliance(item = {}) {
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
  ].map(entityId).filter(Boolean))];
  const meta = ids.map(entityMetadata);
  const control = meta.find((entry) => /^(switch|light|input_boolean|fan)$/.test(entry.domain))?.id || "";
  const energyCandidates = meta.filter((entry) =>
    /^(wh|kwh|mwh)$/.test(entry.unit) ||
    entry.deviceClass === "energy" ||
    /(?:^|[_-])(energy|energia|kwh|consumo|consumi|total_energy)(?:[_-]|$)/.test(entry.name),
  );
  const power = meta.find((entry) =>
    /^(w|kw)$/.test(entry.unit) ||
    entry.deviceClass === "power" ||
    /(?:^|[_-])(power|potenza|watt)(?:[_-]|$)/.test(entry.name),
  )?.id || "";
  const daily = energyCandidates.find((entry) => /(?:oggi|today|daily|giorn|day)/.test(entry.name))?.id || "";
  const monthly = energyCandidates.find((entry) => /(?:mese|month|monthly)/.test(entry.name))?.id || "";
  const total = energyCandidates.find((entry) => /(?:totale|total|lifetime)/.test(entry.name))?.id || "";
  const energy = monthly || total || daily || energyCandidates[0]?.id || "";
  const report = entityId(item.report_entity) || monthly || total || daily || energy;
  return {
    ...item,
    entities: ids,
    control_entity: entityId(item.control_entity) || control,
    power_entity: entityId(item.power_entity) || power,
    energy_entity: entityId(item.energy_entity) || energy,
    daily_energy_entity: entityId(item.daily_energy_entity) || daily,
    monthly_energy_entity: entityId(item.monthly_energy_entity) || monthly,
    total_energy_entity: entityId(item.total_energy_entity) || total,
    report_entity: report,
    history_entity: entityId(item.history_entity) || report || power,
    show_in_report: item.show_in_report !== false,
  };
}

function relevantApplianceFields(item) {
  return JSON.stringify({
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
}

function refreshReportRuntime() {
  try {
    globalThis.cdRebuildReportDevices?.();
    globalThis.buildReportSelect?.();
    if (document.querySelector("#view-panoramica.active")) globalThis.renderEnergyDashboard?.();
  } catch (error) {
    globalThis.console?.warn?.("[Report] refresh", error);
  }
}

async function repairApplianceEntities() {
  const store = globalThis.DashboardModernModules?.store;
  if (!store?.getSection || !store?.replaceSection || repairingAppliances) return false;
  const current = store.getSection("appliances");
  if (!Array.isArray(current) || !current.length) return true;
  const repaired = current.map(classifyAppliance);
  if (current.every((item, index) => relevantApplianceFields(item) === relevantApplianceFields(repaired[index]))) {
    refreshReportRuntime();
    return true;
  }
  repairingAppliances = true;
  try {
    await store.replaceSection("appliances", repaired);
    refreshReportRuntime();
  } finally {
    repairingAppliances = false;
  }
  return true;
}

function createEntityField(id, label, value = "", placeholder = "sensor.entity") {
  return `<label class="ed-slot dm-entity-field dm-config-field" data-entity-field><span class="ed-slot-lbl">${escapeHtml(label)}</span><span class="ed-form-row"><input id="${escapeHtml(id)}" class="ed-input mono" data-entity-input value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"><button type="button" class="dm-entity-picker" data-entity-target="${escapeHtml(id)}" aria-label="${escapeHtml(label)}">🔍</button></span></label>`;
}

function installApplianceEditorFix() {
  const renderer = globalThis.editorRenderAppliances;
  const save = globalThis.edApplSave;
  const edit = globalThis.edApplEdit;
  const cancel = globalThis.edApplCancel;
  if (![renderer, save, edit, cancel].every((fn) => typeof fn === "function")) return false;
  if (renderer.__dmRealHa0147) return true;

  globalThis.edApplEdit = function edApplEditReal(index) {
    applianceEditId = (globalThis.getAppliances?.() || [])[Number(index)]?.id || "";
    return edit.apply(this, arguments);
  };
  globalThis.edApplCancel = function edApplCancelReal() {
    applianceEditId = "";
    return cancel.apply(this, arguments);
  };

  const wrappedRenderer = function editorRenderAppliancesReal() {
    const template = document.createElement("template");
    template.innerHTML = renderer.apply(this, arguments);
    const form = [...template.content.querySelectorAll(".ed-form")].at(-1);
    if (!form || form.querySelector("[data-appliance-canonical-fields]")) return template.innerHTML;
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances") || globalThis.getAppliances?.() || [];
    const item = items.find((entry) => entry.id === applianceEditId) || {};
    const group = document.createElement("section");
    group.className = "dm-config-subsection";
    group.dataset.applianceCanonicalFields = "";
    group.innerHTML = `<div class="ed-sec-title">⚡ ${isEnglish() ? "Entities and Energy Report" : "Entità e Report Energia"}</div>
      <div class="ed-intro">${isEnglish() ? "Assign power, energy and control explicitly. The Energy Report uses the energy entity." : "Assegna esplicitamente potenza, energia e comando. Il Report Energia usa l’entità energia."}</div>
      <div class="dm-config-grid">${createEntityField("appl-power-entity", isEnglish() ? "Power entity" : "Entità potenza", item.power_entity, "sensor.forno_potenza")}${createEntityField("appl-energy-entity", isEnglish() ? "Energy / Report entity" : "Entità energia / Report", item.report_entity || item.energy_entity, "sensor.forno_energia")}${createEntityField("appl-control-entity", isEnglish() ? "On/off control" : "Comando ON/OFF", item.control_entity, "switch.forno")}</div>`;
    const threshold = form.querySelector("#appl-thr");
    if (threshold) form.insertBefore(group, threshold);
    else form.append(group);
    form.classList.add("dm-config-form");
    return template.innerHTML;
  };
  wrappedRenderer.__dmRealHa0147 = true;
  globalThis.editorRenderAppliances = wrappedRenderer;

  const wrappedSave = async function edApplSaveReal() {
    const explicit = {
      power_entity: document.getElementById("appl-power-entity")?.value.trim() || "",
      energy_entity: document.getElementById("appl-energy-entity")?.value.trim() || "",
      control_entity: document.getElementById("appl-control-entity")?.value.trim() || "",
    };
    const name = document.getElementById("appl-name")?.value.trim() || "";
    const editId = applianceEditId;
    const result = await save.apply(this, arguments);
    const store = globalThis.DashboardModernModules?.store;
    if (!store?.getSection || !store?.updateItem) return result;
    const items = store.getSection("appliances");
    const item = items.find((entry) => entry.id === editId) || [...items].reverse().find((entry) => !name || entry.name === name);
    if (!item) return result;
    const entities = [...new Set([...(item.entities || []), explicit.power_entity, explicit.energy_entity, explicit.control_entity].filter(Boolean))];
    const classified = classifyAppliance({
      ...item,
      ...explicit,
      report_entity: explicit.energy_entity || item.report_entity,
      history_entity: explicit.energy_entity || item.history_entity,
      entities,
    });
    await store.updateItem("appliances", item.id, classified);
    applianceEditId = "";
    refreshReportRuntime();
    return result;
  };
  wrappedSave.__dmRealHa0147 = true;
  globalThis.edApplSave = wrappedSave;
  return true;
}

function inferAlertGroup(details) {
  const text = details?.querySelector("summary")?.textContent?.toLowerCase() || "";
  if (/apert|contact|door|window/.test(text)) return "win";
  if (/batter/.test(text)) return "batt";
  if (/luc|light/.test(text)) return "luci";
  if (/clima|climate/.test(text)) return "clima";
  if (/riscald|heating/.test(text)) return "risc";
  return "";
}

function updateRuntimeAlert(group, oldEntity, newEntity, name) {
  try {
    const groups = globalThis.eval("GRUPPI_MONITORAGGIO");
    if (groups?.[group]) {
      groups[group] = groups[group].filter((id) => id !== oldEntity);
      if (!groups[group].includes(newEntity)) groups[group].push(newEntity);
    }
  } catch (_error) {}
  try {
    const names = globalThis.eval("AVVISI_NAMES");
    if (names) {
      delete names[oldEntity];
      if (name) names[newEntity] = name;
    }
  } catch (_error) {}
}

function saveEditedStandardAlert() {
  if (!alertEdit || alertEdit.kind !== "standard") return false;
  const group = document.getElementById("ed-avv-grp")?.value || alertEdit.group;
  const entity = document.getElementById("ed-avv-ent")?.value.trim() || "";
  const name = document.getElementById("ed-avv-name")?.value.trim() || "";
  if (!entity.includes(".")) {
    globalThis.alert?.(isEnglish() ? "Enter a valid entity." : "Inserisci una entità valida.");
    return true;
  }
  const extras = readJson("cd_gruppi_extra", {});
  const removed = readJson("cd_gruppi_removed", {});
  const names = readJson("cd_avvisi_names_extra", {});
  const old = alertEdit;
  if (extras[old.group]?.includes(old.entity)) {
    extras[old.group] = extras[old.group].filter((id) => id !== old.entity);
    if (!extras[old.group].length) delete extras[old.group];
  } else {
    removed[old.group] ||= [];
    if (!removed[old.group].includes(old.entity)) removed[old.group].push(old.entity);
  }
  extras[group] ||= [];
  if (!extras[group].includes(entity)) extras[group].push(entity);
  delete names[old.entity];
  if (name) names[entity] = name;
  writeJson("cd_gruppi_extra", extras);
  writeJson("cd_gruppi_removed", removed);
  writeJson("cd_avvisi_names_extra", names);
  updateRuntimeAlert(old.group, old.entity, entity, name);
  if (group !== old.group) updateRuntimeAlert(group, "", entity, name);
  alertEdit = null;
  globalThis.editorSwitch?.("avvisi");
  globalThis.edToast?.(isEnglish() ? "Alert updated" : "Avviso aggiornato");
  return true;
}

function installAlertsEditorFix() {
  const renderer = globalThis.editorRenderAvvisi;
  const add = globalThis.edAddAvviso;
  if (typeof renderer !== "function" || typeof add !== "function") return false;
  if (renderer.__dmRealHa0147) return true;

  globalThis.dmRealEditAlert = (group, entity) => {
    alertEdit = { kind: "standard", group, entity };
    globalThis.editorSwitch?.("avvisi");
  };
  globalThis.dmRealCancelAlert = () => {
    alertEdit = null;
    globalThis.editorSwitch?.("avvisi");
  };

  const wrapped = function editorRenderAvvisiReal() {
    const template = document.createElement("template");
    template.innerHTML = renderer.apply(this, arguments);
    template.content.querySelectorAll("details.ed-acc").forEach((details) => {
      const group = inferAlertGroup(details);
      if (!group) return;
      details.open = true;
      details.querySelectorAll(".ed-row").forEach((row) => {
        const entity = row.querySelector(".ed-row-old.mono")?.textContent?.trim();
        if (!entity || row.querySelector("[data-real-alert-edit]")) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ed-del dm-edit-button";
        button.dataset.realAlertEdit = "";
        button.textContent = "✏️";
        button.title = isEnglish() ? "Edit" : "Modifica";
        button.setAttribute("onclick", `dmRealEditAlert(${JSON.stringify(group)},${JSON.stringify(entity)})`);
        row.querySelector(".ed-del")?.before(button);
      });
    });
    const form = [...template.content.querySelectorAll(".ed-form")].at(-1);
    form?.classList.add("dm-config-form");
    if (alertEdit?.kind === "standard") {
      const names = readJson("cd_avvisi_names_extra", {});
      const select = template.content.querySelector("#ed-avv-grp");
      select?.querySelectorAll("option").forEach((option) => option.toggleAttribute("selected", option.value === alertEdit.group));
      template.content.querySelector("#ed-avv-ent")?.setAttribute("value", alertEdit.entity);
      template.content.querySelector("#ed-avv-name")?.setAttribute("value", names[alertEdit.entity] || dashboardStates()?.[alertEdit.entity]?.attributes?.friendly_name || alertEdit.entity);
      const saveButton = form?.querySelector("button[onclick='edAddAvviso()']");
      if (saveButton) {
        saveButton.textContent = isEnglish() ? "💾 Save changes" : "💾 Salva modifiche";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "ed-btn-secondary";
        cancel.textContent = isEnglish() ? "Cancel" : "Annulla";
        cancel.setAttribute("onclick", "dmRealCancelAlert()");
        saveButton.after(cancel);
      }
    }
    return template.innerHTML;
  };
  wrapped.__dmRealHa0147 = true;
  globalThis.editorRenderAvvisi = wrapped;
  globalThis.edAddAvviso = function edAddAvvisoReal() {
    if (saveEditedStandardAlert()) return;
    return add.apply(this, arguments);
  };
  return true;
}

function roomOptions(selected = "") {
  const rooms = globalThis.cdRoomList?.() || globalThis.getStanze?.() || [];
  return [`<option value="">— ${isEnglish() ? "No room" : "Nessuna stanza"} —</option>`, ...rooms.map((room) => {
    const value = String(room.name || room.id || "");
    const label = String(room.name || room.id || "");
    return `<option value="${escapeHtml(value)}"${value === selected || label === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  })].join("");
}

function installLightsEditorFix() {
  const renderer = globalThis.editorRenderLuci;
  const add = globalThis.cdLuceAdd;
  if (typeof renderer !== "function" || typeof add !== "function") return false;
  if (renderer.__dmRealHa0147) return true;

  globalThis.dmRealEditLight = (entity) => {
    lightEditEntity = entity;
    globalThis.editorSwitch?.("luci");
  };
  globalThis.dmRealCancelLight = () => {
    lightEditEntity = "";
    globalThis.editorSwitch?.("luci");
  };

  const wrapped = function editorRenderLuciReal() {
    const template = document.createElement("template");
    template.innerHTML = renderer.apply(this, arguments);
    template.content.querySelectorAll(".ed-lrow").forEach((row) => {
      const entity = row.querySelector("div[style*='font-family:monospace']")?.textContent?.trim();
      if (!entity) return;
      const buttons = [...row.querySelectorAll("button")];
      const editButton = buttons.find((button) => /Rinomina|Rename/i.test(button.title || ""));
      if (editButton) {
        editButton.title = isEnglish() ? "Edit" : "Modifica";
        editButton.setAttribute("onclick", `dmRealEditLight(${JSON.stringify(entity)})`);
        editButton.classList.add("dm-edit-button");
      }
    });
    const form = template.content.querySelector("[data-light-add-form], .dm-light-add-form");
    if (form) {
      form.classList.add("dm-config-form");
      const lights = readJson("cd_luci", {});
      const rooms = readJson("cd_luci_rooms", {});
      const inputEntity = form.querySelector("#luce-add-ent");
      const inputName = form.querySelector("#luce-add-name");
      let roomSelect = form.querySelector("#luce-add-room");
      if (!roomSelect) {
        const label = document.createElement("label");
        label.className = "ed-slot dm-config-field";
        label.innerHTML = `<span class="ed-slot-lbl">${isEnglish() ? "Room" : "Stanza"}</span><select id="luce-add-room" class="ed-input">${roomOptions(lightEditEntity ? rooms[lightEditEntity] || "" : "")}</select>`;
        inputName?.insertAdjacentElement("afterend", label);
        roomSelect = label.querySelector("select");
      }
      if (lightEditEntity) {
        inputEntity?.setAttribute("value", lightEditEntity);
        inputName?.setAttribute("value", lights[lightEditEntity] || "");
        if (roomSelect) roomSelect.value = rooms[lightEditEntity] || "";
        const submit = [...form.querySelectorAll("button")].find((button) => /cdLuceAdd/.test(button.getAttribute("onclick") || ""));
        if (submit) {
          submit.textContent = isEnglish() ? "💾 Save changes" : "💾 Salva modifiche";
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "ed-btn-secondary";
          cancel.textContent = isEnglish() ? "Cancel" : "Annulla";
          cancel.setAttribute("onclick", "dmRealCancelLight()");
          submit.after(cancel);
        }
      }
    }
    return template.innerHTML;
  };
  wrapped.__dmRealHa0147 = true;
  globalThis.editorRenderLuci = wrapped;

  globalThis.cdLuceAdd = function cdLuceAddReal() {
    const newEntity = document.getElementById("luce-add-ent")?.value.trim() || "";
    const name = document.getElementById("luce-add-name")?.value.trim() || "";
    const room = document.getElementById("luce-add-room")?.value.trim() || "";
    if (!/^(light|switch)\.[a-z0-9_]+$/i.test(newEntity)) {
      globalThis.alert?.(isEnglish() ? "Enter a valid light or switch entity." : "Inserisci una entità light o switch valida.");
      return;
    }
    const wasEdit = Boolean(lightEditEntity);
    const lights = readJson("cd_luci", {});
    const rooms = readJson("cd_luci_rooms", {});
    const order = readJson("cd_luci_order", {});
    if (lightEditEntity) {
      delete lights[lightEditEntity];
      delete rooms[lightEditEntity];
    }
    lights[newEntity] = name || newEntity.split(".")[1];
    if (room) rooms[newEntity] = room;
    Object.values(order).forEach((ids) => {
      if (!Array.isArray(ids)) return;
      const index = lightEditEntity ? ids.indexOf(lightEditEntity) : -1;
      if (index >= 0) ids[index] = newEntity;
    });
    writeJson("cd_luci", lights);
    writeJson("cd_luci_rooms", rooms);
    writeJson("cd_luci_order", order);
    lightEditEntity = "";
    globalThis.updateGestioneLuci?.();
    globalThis.editorSwitch?.("luci");
    globalThis.edToast?.(wasEdit ? (isEnglish() ? "Light updated" : "Luce aggiornata") : (isEnglish() ? "Light added" : "Luce aggiunta"));
  };
  return true;
}

function decorateReportRows(root = document) {
  root.querySelectorAll("#editor-modal .dm-report-row").forEach((row) => {
    if (row.dataset.realReportLayout === "true") return;
    row.dataset.realReportLayout = "true";
    const toggle = row.querySelector(":scope > label:first-child");
    const labelInput = row.querySelector("[data-report-label]");
    const iconField = row.querySelector("[data-icon-field]");
    const entityField = row.querySelector("[data-entity-field]");
    const actions = [...row.children].find((child) => child.querySelector?.("[data-report-up]"));
    if (toggle) toggle.classList.add("dm-report-toggle");
    if (actions) actions.classList.add("dm-report-actions");
    const fields = document.createElement("div");
    fields.className = "dm-report-fields";
    const wrap = (node, label) => {
      if (!node) return;
      if (node.matches("label")) {
        node.classList.add("dm-config-field");
        fields.append(node);
        return;
      }
      const holder = document.createElement("label");
      holder.className = "dm-config-field";
      holder.innerHTML = `<span class="ed-slot-lbl">${label}</span>`;
      holder.append(node);
      fields.append(holder);
    };
    wrap(labelInput, isEnglish() ? "Report name" : "Nome nel Report");
    wrap(iconField, isEnglish() ? "Icon" : "Icona");
    wrap(entityField, isEnglish() ? "Energy entity" : "Entità energia");
    if (actions) row.insertBefore(fields, actions);
    else row.append(fields);
  });
}

function decorateApplianceCards(root = document) {
  root.querySelectorAll("#page-appliances-main .appl-wide-card.dm-control-device").forEach((card) => {
    card.querySelector(".appl-spark")?.remove();
    const toggle = [...card.querySelectorAll(".appl-action-btn")].find((button) => button.textContent.trim() === "⏻" || button.dataset.dmPowerToggle === "true");
    if (toggle) {
      toggle.dataset.dmPowerToggle = "true";
      const on = toggle.classList.contains("on");
      toggle.textContent = on ? (isEnglish() ? "Turn off" : "Spegni") : (isEnglish() ? "Turn on" : "Accendi");
      toggle.setAttribute("aria-label", toggle.textContent);
    }
  });
  const grid = root.querySelector("#tapp-grid");
  const bulk = grid?.firstElementChild;
  if (bulk && bulk.querySelector("[data-all]")) bulk.classList.add("dm-shutter-bulk-actions");
}

function installCss() {
  if (document.getElementById("dm-real-ha-0147-css")) return;
  const style = document.createElement("style");
  style.id = "dm-real-ha-0147-css";
  style.textContent = `
    #editor-modal .ed-form.dm-config-form,
    #editor-modal .dm-temperature-form,
    #editor-modal .dm-config-subsection {
      padding: 16px !important;
      border: 1px solid var(--card-border, var(--divider-color, #dbe4ee)) !important;
      border-radius: 18px !important;
      background: var(--surface-2, var(--secondary-background-color, #f8fafc)) !important;
      box-shadow: none !important;
      gap: 12px !important;
    }
    #editor-modal .ed-row { min-height: 58px; padding: 11px 13px !important; gap: 9px !important; }
    #editor-modal .ed-del,
    #editor-modal .dm-edit-button { width: 38px !important; height: 38px !important; border-radius: 11px !important; display: inline-grid !important; place-items: center !important; border: 1px solid var(--card-border, #dbe4ee) !important; }
    #editor-modal .ed-btn-add,
    #editor-modal .ed-save-btn,
    #editor-modal .ed-btn-secondary { min-height: 44px !important; border-radius: 13px !important; padding: 10px 16px !important; font-weight: 850 !important; }
    #editor-modal .ed-btn-secondary { border: 1px solid var(--card-border, #dbe4ee); background: var(--surface-3, #f1f5f9); color: var(--text, #0f172a); cursor: pointer; }
    #editor-modal .dm-temperature-actions { display: grid !important; grid-template-columns: 1fr 1fr; gap: 9px !important; }
    #editor-modal .dm-temperature-actions > button:only-child { grid-column: 1 / -1; }
    #editor-modal .dm-config-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    #editor-modal .dm-config-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    #editor-modal .dm-config-field .ed-input { width: 100% !important; min-width: 0 !important; margin: 0 !important; }

    #editor-modal .dm-report-row { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; grid-template-areas: "toggle actions" "fields fields" !important; gap: 12px !important; align-items: center !important; padding: 14px !important; }
    #editor-modal .dm-report-toggle { grid-area: toggle; width: max-content; display: inline-flex !important; align-items: center; gap: 8px; padding: 7px 11px; border-radius: 999px; background: rgba(14,165,233,.11); font-weight: 800; }
    #editor-modal .dm-report-fields { grid-area: fields; display: grid; grid-template-columns: minmax(150px,.75fr) minmax(130px,.45fr) minmax(240px,1.3fr); gap: 10px; align-items: end; min-width: 0; }
    #editor-modal .dm-report-actions { grid-area: actions; display: flex !important; gap: 7px !important; }
    #editor-modal .dm-report-actions button { width: 38px !important; height: 38px !important; border-radius: 11px !important; border: 1px solid var(--card-border, #dbe4ee) !important; background: var(--surface-3, #f1f5f9) !important; color: var(--text, #0f172a) !important; }

    #page-appliances-main .appl-page-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 390px)) !important; justify-content: center !important; align-items: start !important; gap: 14px !important; }
    #page-appliances-main .appl-wide-card.dm-control-device { grid-template-columns: 94px minmax(0,1fr) !important; width: 100% !important; max-width: 390px !important; min-height: 128px !important; border-radius: 20px !important; }
    #page-appliances-main .appl-wide-card.dm-control-device .appl-info { padding: 12px !important; gap: 8px !important; }
    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual { min-height: 128px !important; }
    #page-appliances-main .appl-spark { display: none !important; }
    #page-appliances-main .appl-action-btn[data-dm-power-toggle="true"] { min-width: 86px !important; min-height: 38px !important; font-size: 12px !important; }
    #page-appliances-main .appl-actions { margin-top: auto !important; }

    #page-tapparelle > div { max-width: 980px !important; }
    #tapp-grid { grid-template-columns: repeat(auto-fit, minmax(270px, 330px)) !important; gap: 14px !important; padding: 12px 0 70px !important; }
    #tapp-grid .tapp-card { min-height: 0 !important; padding: 14px !important; border-radius: 20px !important; gap: 10px !important; }
    #tapp-grid .tapp-win { height: 126px !important; border-radius: 16px !important; }
    #tapp-grid .tapp-pos { font-size: 17px !important; min-height: 22px !important; }
    #tapp-grid .tapp-btn,
    .dm-shutter-popup .dm-shutter-actions button { min-height: 42px !important; border-radius: 12px !important; border: 1px solid var(--card-border, #dbe4ee) !important; box-shadow: none !important; font-weight: 800 !important; }
    #tapp-grid .tapp-btn[data-svc="open_cover"] { background: rgba(16,185,129,.14) !important; color: #047857 !important; }
    #tapp-grid .tapp-btn[data-svc="stop_cover"] { background: var(--surface-3, #f1f5f9) !important; color: var(--text, #0f172a) !important; }
    #tapp-grid .tapp-btn[data-svc="close_cover"] { background: rgba(14,165,233,.14) !important; color: #0369a1 !important; }
    #tapp-grid .dm-shutter-bulk-actions { width: min(100%, 680px) !important; margin: 0 auto 4px !important; padding: 8px !important; border: 1px solid var(--card-border, #dbe4ee) !important; border-radius: 16px !important; background: var(--card-bg, #fff) !important; box-shadow: var(--shadow-sculpted) !important; }

    @media (max-width: 700px) {
      #editor-modal .dm-config-grid,
      #editor-modal .dm-report-fields { grid-template-columns: 1fr !important; }
      #editor-modal .dm-temperature-actions { grid-template-columns: 1fr !important; }
      #page-appliances-main .appl-page-grid { grid-template-columns: 1fr !important; }
      #page-appliances-main .appl-wide-card.dm-control-device { grid-template-columns: 82px minmax(0,1fr) !important; max-width: none !important; min-height: 118px !important; }
      #page-appliances-main .appl-wide-card.dm-control-device .appl-visual { min-height: 118px !important; }
      #page-appliances-main .appl-wide-card.dm-control-device .appl-primary strong { font-size: 20px !important; }
      #page-appliances-main .appl-wide-card.dm-control-device .appl-st { font-size: 9px !important; }
      #page-appliances-main .appl-action-btn[data-dm-power-toggle="true"] { min-width: 78px !important; font-size: 11px !important; }
      #tapp-grid { grid-template-columns: 1fr !important; }
      #tapp-grid .tapp-card { max-width: 330px !important; width: 100% !important; margin: 0 auto !important; }
      #tapp-grid .dm-shutter-bulk-actions { display: grid !important; grid-template-columns: 1fr 1fr !important; }
    }
  `;
  document.head.append(style);
}

function installRuntimePatches() {
  const results = [
    installServiceBridgeFix(),
    installApplianceEditorFix(),
    installAlertsEditorFix(),
    installLightsEditorFix(),
  ];
  return results.every(Boolean);
}

function decorate() {
  decorateReportRows();
  decorateApplianceCards();
}

function install() {
  installCss();
  installRuntimePatches();
  repairApplianceEntities();
  decorate();
  if (globalThis[FLAG]?.installed) return;
  globalThis[FLAG] = { installed: true };
  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorate);
  }).observe(document.documentElement, { childList: true, subtree: true });
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    installRuntimePatches();
    repairApplianceEntities();
    decorate();
    if (attempts >= 30) clearInterval(timer);
  }, 500);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
