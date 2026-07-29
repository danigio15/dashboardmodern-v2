/* Canonical runtime helpers consumed directly by both vendored dashboards. */
import {
  applianceGroups,
  applianceEnergyReport,
  applianceMedia,
  applianceName,
  applianceRoomId,
  applianceState,
  controllableEntity,
  normalizeCamera,
  normalizeCameras,
  normalizeRooms,
  isConfiguredRoom,
  removeCamera,
  saveCamera,
  stableRoomId,
} from "../src/legacy/dashboard-data.js";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { getDeviceDisplayName, getDeviceVisual, normalizeDevice } from "../src/core/device-model.js";
import { createEnergyReportRows, createRenderCoordinator, loadPopupMetrics, renderDeviceCard, renderEnergyEditor } from "../src/core/renderers.js";
import { SCHEMA_VERSION } from "../src/core/device-model.js";
import { BUILD_INFO } from "./build-info.js";
import { canonicalReportDevices } from "../src/core/energy-projection.js";

export const MODULES_VERSION = 14;
const LOCALE = globalThis.document?.documentElement?.lang === "en" ? "en" : "it";
const COPY = Object.freeze({
  it: { optional: "Facoltativo", select: "Seleziona", saveReport: "Salva Report", saved: "Report salvato", energySaved: "Energia salvata", dirty: "Modifiche non salvate", saving: "Salvataggio…", addManual: "Aggiungi voce manuale", empty: "Nessun elemento configurato.", reportIntro: "Seleziona e ordina il Report senza modificare l'ordine della dashboard.", reportLabel: "Etichetta", reportEntity: "Entità Report", history: "Storico", name: "Nome", entity: "Entità", add: "Aggiungi", required: "Nome ed entità sono obbligatori", moveUp: "Sposta su", moveDown: "Sposta giù", remove: "Elimina", energyCost: "Costo energia", energyRates: "Tariffe usate dal Report Energia.", saveCosts: "Salva costi", loadsIntro: "Carichi e Report condividono il modello canonico senza duplicati.", appliances: "Elettrodomestici / dispositivi", secondaryLoads: "Carichi secondari", noLoads: "Nessun carico configurato", editLoad: "Modifica carico", newLoad: "Nuovo carico", visibleReport: "Visibile nel report", visibleDashboard: "Visibile nella dashboard", addLoad: "Aggiungi carico", saveChanges: "Salva modifiche", powerEntity: "Entità potenza", dailyEnergy: "Energia giornaliera", monthlyEnergy: "Energia mensile", totalEnergy: "Energia totale", state: "Stato", control: "Comando ON/OFF", diagnostics: "Diagnostica runtime", languageVariant: "Lingua / variante", activeRenderer: "Renderer attivo", loadNameRequired: "Inserisci il nome del carico", energySaveFailed: "Salvataggio Energia fallito" },
  en: { optional: "Optional", select: "Select", saveReport: "Save Report", saved: "Report saved", energySaved: "Energy saved", dirty: "Unsaved changes", saving: "Saving…", addManual: "Add manual entry", empty: "No configured items.", reportIntro: "Select and order Report entries without changing dashboard order.", reportLabel: "Label", reportEntity: "Report entity", history: "History", name: "Name", entity: "Entity", add: "Add", required: "Name and entity are required", moveUp: "Move up", moveDown: "Move down", remove: "Delete", energyCost: "Energy cost", energyRates: "Rates used by the Energy Report.", saveCosts: "Save costs", loadsIntro: "Loads and Report share the canonical model without duplicates.", appliances: "Appliances / devices", secondaryLoads: "Secondary loads", noLoads: "No configured loads", editLoad: "Edit load", newLoad: "New load", visibleReport: "Visible in Report", visibleDashboard: "Visible on dashboard", addLoad: "Add load", saveChanges: "Save changes", powerEntity: "Power entity", dailyEnergy: "Daily energy", monthlyEnergy: "Monthly energy", totalEnergy: "Total energy", state: "State", control: "On/off control", diagnostics: "Runtime diagnostics", languageVariant: "Language / variant", activeRenderer: "Active renderer", loadNameRequired: "Enter a load name", energySaveFailed: "Energy save failed" },
});
const t = (key) => COPY[LOCALE][key] || key;

const store = new DashboardStore({
  sync: async () => {
    globalThis.cdMarkDirty?.();
    return globalThis.cdSyncPush?.();
  },
  onStatus: (status) => globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:status", { detail: status })),
});
store.migrate();
store.installLegacyWriteBridge();
const applyRuntimeProjection = () =>
  globalThis.cdApplyCanonicalOverrides?.(store.getSection("entityOverrides"));
applyRuntimeProjection();
store.subscribe((change) => {
  if (change.status === "optimistic" || change.status === "rollback") applyRuntimeProjection();
});

// The vendored UI keeps its established markup/CSS. This is the single bridge
// that translates canonical store changes into its existing partial renderers.
createRenderCoordinator(store, {
  renderSection(section) {
    if (section === "appliances") {
      globalThis.renderAppliances?.(); globalThis.renderApplianceSection?.(true);
    } else if (section === "cameras") {
      const grid = globalThis.document?.getElementById?.("cam-grid"); if (grid) grid._sig = "";
      globalThis.buildCamCards?.(); globalThis.refreshCameras?.();
    } else if (section === "rooms") {
      globalThis.buildTempCards?.(); globalThis.renderTemperature?.();
    }
  },
  renderEnergyReport() {
    globalThis.cdRebuildReportDevices?.();
    globalThis.buildReportSelect?.();
  },
  renderNavbar() { globalThis.cdApplyNavVis?.(); },
  renderRoomSelectors() { globalThis.cdFillRoomSelects?.(); },
  renderCurrentEditor(section) {
    const tab = globalThis.document?.querySelector?.(".ed-tab.active")?.dataset?.tab;
    const sectionTabs = {
      appliances: "appliances", loads: "sez1", report: "sez1", energy: "sez1", cameras: "sezioni", rooms: "stanze",
      ev: "sezioni", lights: "luci", climate: "sezioni", covers: "tapp",
      pool: "pool", irrigation: "irr",
    };
    const expected = section === "rooms" && tab === "sez7" ? "sez7" : sectionTabs[section];
    const matches = expected === tab || (expected === "sezioni" && tab?.startsWith("sez"));
    if (!globalThis.document?.getElementById?.("ed-body") || !matches) return;
    // Re-render the active body directly; editorSwitch is navigation and was
    // the accidental refresh mechanism that left confirmed deletes visible.
    const body = globalThis.document.getElementById("ed-body");
    if (tab === "sez7" && section === "rooms") {
      renderEditorTab("sez7", body);
      return;
    }
    if (tab === "sez1" && section === "energy") {
      renderEditorTab("sez1", body);
      return;
    }
    if (tab === "sez1" && section === "loads") {
      const panel = body.querySelector('[data-energy-panel="loads"]');
      if (panel) { mountLoadsEditor(panel); mountCurrentEditor("loads", panel); panel.hidden = false; }
      return;
    }
    if (tab === "sez1" && section === "report") {
      const panel = body.querySelector('[data-energy-panel="report"]');
      if (panel) { renderReportEditor(panel); mountReportEditor("report", panel); panel.hidden = false; }
      return;
    }
    if (tab === "appliances") {
      body.innerHTML = globalThis.cdSecToggleHtml("appliances") + globalThis.editorRenderAppliances() + '<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>';
      globalThis.edApplRenderEnts?.();
    } else if (tab === "load") mountLoadsEditor(body);
    else if (tab === "stanze") body.innerHTML = globalThis.editorRenderStanze();
    else if (tab === "luci") body.innerHTML = globalThis.editorRenderLuci();
    else if (tab === "tapp") body.innerHTML = globalThis.cdSecToggleHtml("tapparelle") + globalThis.editorRenderTapparelle();
    else if (tab === "pool") body.innerHTML = globalThis.cdSecToggleHtml("piscina") + globalThis.editorRenderPiscina();
    else if (tab === "irr") body.innerHTML = globalThis.cdSecToggleHtml("irrigazione") + globalThis.editorRenderIrrigazione();
    else if (tab?.startsWith("sez") && tab !== "sezioni" && tab !== "sez1") {
      body.innerHTML = globalThis.editorRenderSezioni();
      globalThis.edFilterSez?.(body, Number(tab.slice(3)));
    }
    mountCurrentEditor(tab, body);
  },
  renderDropdowns() { globalThis.cdFillRoomSelects?.(); },
  renderDashboard() { globalThis.render?.(); },
});

let activeEnergyPanel = "flows";
function renderEnergyEditorTab(target) {
  const model = store.getSection("energy");
  const draft = structuredClone(model);
  renderEnergyEditor(globalThis.document, target, model, store.getSection("appliances"), globalThis.STATES || {},
    globalThis.document?.documentElement?.lang === "en" ? "en" : "it", {
      onPick: (input) => globalThis.wzPickEntity?.(input),
      renderLoads: (loads) => { mountLoadsEditor(loads); mountCurrentEditor("loads", loads); },
      renderReport: (report) => { renderReportEditor(report); mountReportEditor("report", report); },
      renderSettings: (settings) => {
        settings.innerHTML = `${globalThis.cdEnViewsHtml?.() || ""}
          <div class="ed-form dm-energy-cost-card"><div class="ed-sec-title">💶 ${t("energyCost")}</div>
          <div class="ed-hint">${t("energyRates")}</div>
          <div class="ed-form-row"><input id="ed-costo-kwh" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh prelevato" value="${globalThis.cdCfg?.("cd_costo_kwh") || ""}"><input id="ed-prezzo-imm" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh immesso" value="${globalThis.cdCfg?.("cd_prezzo_immissione") || ""}"></div>
          <button class="ed-save-btn" onclick="edSaveCosti()">💾 ${t("saveCosts")}</button></div>`;
      },
      onChange: (group, key, value) => {
        draft[group] ||= {}; draft[group][key] = value;
      },
      initialTab: activeEnergyPanel,
      onTabChange: (tab) => { activeEnergyPanel = tab; },
      onSave: async ({ actions, save, status }) => {
        draft.metadata = { ...(draft.metadata || {}), semantics_version: 2 };
        actions.dataset.state = "loading"; save.disabled = true; status.textContent = t("saving");
        try {
          await store.replaceSection("energy", draft);
          const current = target.querySelector("[data-energy-actions]");
          if (current) { current.dataset.state = "success"; current.querySelector("[data-energy-status]").textContent = t("energySaved"); }
        } catch (error) {
          const current = target.querySelector("[data-energy-actions]");
          if (current) { current.dataset.state = "error"; current.querySelector("[data-energy-status]").textContent = `${t("energySaveFailed")}: ${error.message}`; }
        }
      },
    });
}

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export function createEntityField({ id, label, value = "", placeholder = "sensor.entity", domain = "", optional = true } = {}) {
  const domainAttr = domain ? ` data-domain="${esc(domain)}"` : "";
  const opt = optional ? ` <span class="ed-acc-n">${t("optional")}</span>` : "";
  return `<label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${esc(label)}${opt}</span><span class="ed-form-row"><input id="${esc(id)}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="${esc(placeholder)}"${domainAttr}><button type="button" class="dm-entity-picker" data-entity-target="${esc(id)}" aria-label="${t("select")} ${esc(label)}">🔍</button></span></label>`;
}
function createIconField(id, value = "") {
  return `<span class="ed-form-row dm-icon-field" data-icon-field><input id="${esc(id)}" class="ed-input ed-icon-input" value="${esc(value)}"><button type="button" class="dm-icon-picker" data-icon-target="${esc(id)}" aria-label="${t("select")} icon">🎨</button></span>`;
}
const entityField = (id, label, value, placeholder) => createEntityField({ id, label, value, placeholder });

export function renderTemperatureEditor(target) {
  const allRooms = store.getSection("rooms");
  const configured = allRooms.filter((room) => room.temp || room.hum);
  const rows = configured.map((room) => `<article class="ed-row dm-temperature-card" data-temperature-room data-room-id="${esc(room.id)}">
    <div class="dm-temperature-card-icon">${globalThis.cdIconMarkup?.(room.icon || "🌡️", 28) || esc(room.icon || "🌡️")}</div>
    <div class="ed-row-main"><div class="ed-row-new">${esc(room.name)}</div><div class="ed-row-old">${room.floor ? `🏢 ${esc(room.floor)} · ` : ""}<span class="mono">${esc(room.temp)}</span>${room.hum ? ` · <span class="mono">${esc(room.hum)}</span>` : ""}</div></div>
    <button type="button" class="ed-del dm-temperature-edit" data-temperature-edit aria-label="${LOCALE === "en" ? "Edit" : "Modifica"}">✏️</button>
    <button type="button" class="ed-del" data-temperature-delete aria-label="${t("remove")}">🗑️</button>
  </article>`).join("");
  const options = allRooms.map((room) => `<option value="${esc(room.id)}" ${(room.temp || room.hum) ? "disabled" : ""}>${esc(room.name)}${(room.temp || room.hum) ? (LOCALE === "en" ? " — configured" : " — configurata") : ""}</option>`).join("");
  const empty = LOCALE === "en" ? "Configure at least one room first in the Rooms section." : "Configura prima almeno una stanza nella sezione Stanze.";
  target.innerHTML = `<div class="ed-intro" data-temperature-editor>${LOCALE === "en" ? "Temperature uses canonical rooms: it adds sensors without creating duplicate rooms." : "Temperatura usa le stanze canoniche: aggiunge i sensori senza creare stanze duplicate."}</div><div class="ed-list" data-temperature-list>${rows || `<div class="ed-empty">${t("empty")}</div>`}</div>
    ${allRooms.length ? `<form class="ed-form dm-temperature-form" data-temperature-form><div class="ed-sec-title" data-temperature-form-title>＋ ${LOCALE === "en" ? "Add temperature" : "Aggiungi temperatura"}</div><label class="ed-slot"><span class="ed-slot-lbl">${LOCALE === "en" ? "Room" : "Stanza"}</span><select id="dm-temperature-room" class="ed-input" required><option value="">— ${LOCALE === "en" ? "Select room" : "Seleziona stanza"} —</option>${options}</select></label><label class="ed-slot"><span class="ed-slot-lbl">${LOCALE === "en" ? "Icon" : "Simbolo"}</span>${createIconField("dm-temperature-icon", "🌡️")}</label><output class="ed-row-old dm-temperature-floor" data-temperature-floor></output>${createEntityField({ id: "ed-pl-temp", label: LOCALE === "en" ? "Temperature entity" : "Entità temperatura", optional: false })}${createEntityField({ id: "dm-humidity-new", label: LOCALE === "en" ? "Humidity entity" : "Entità umidità" })}<div class="dm-temperature-actions"><button type="submit" class="ed-btn-add" data-temperature-submit>${t("add")}</button><button type="button" class="ed-del" data-temperature-cancel hidden>${LOCALE === "en" ? "Cancel" : "Annulla"}</button></div></form>` : `<div class="ed-empty dm-temperature-no-rooms">${empty}<button type="button" class="ed-btn-add" data-temperature-go-rooms>${LOCALE === "en" ? "Configure rooms" : "Configura stanze"}</button></div>`}`;
}

export function mountTemperatureEditor(_section, target) {
  mountEntityPickers(target);
  const select = target.querySelector("#dm-temperature-room");
  const form = target.querySelector("[data-temperature-form]");
  let editingId = "";
  let selectedRoomId = "";
  const refreshOptions = () => {
    const configuredIds = new Set(
      store
        .getSection("rooms")
        .filter((room) => room.temp || room.hum)
        .map((room) => room.id),
    );
    [...(select?.options || [])].forEach((option) => {
      option.disabled = configuredIds.has(option.value) && option.value !== editingId;
    });
  };
  const populate = (room, mode = "add") => {
    editingId = mode === "edit" ? room?.id || "" : "";
    selectedRoomId = mode === "add" ? room?.id || "" : "";
    if (!select) return;
    refreshOptions();
    select.value = editingId || selectedRoomId;
    select.disabled = Boolean(editingId);
    target.querySelector("#dm-temperature-icon").value = room?.icon || "🌡️";
    target.querySelector("#ed-pl-temp").value = room?.temp || "";
    target.querySelector("#dm-humidity-new").value = room?.hum || "";
    target.querySelector("[data-temperature-floor]").textContent = room?.floor ? `🏢 ${room.floor}` : "";
    target.querySelector("[data-temperature-form-title]").textContent = editingId ? `${LOCALE === "en" ? "Edit" : "Modifica"} ${room.name}` : `＋ ${LOCALE === "en" ? "Add temperature" : "Aggiungi temperatura"}`;
    target.querySelector("[data-temperature-submit]").textContent = editingId ? (LOCALE === "en" ? "Save changes" : "Salva modifiche") : t("add");
    target.querySelector("[data-temperature-cancel]").hidden = !editingId;
  };
  refreshOptions();
  select?.addEventListener("change", () =>
    populate(
      store.getSection("rooms").find((room) => room.id === select.value),
      "add",
    ),
  );
  target.querySelectorAll("[data-temperature-edit]").forEach((button) =>
    button.addEventListener("click", () =>
      populate(
        store
          .getSection("rooms")
          .find((room) => room.id === button.closest("[data-room-id]").dataset.roomId),
        "edit",
      ),
    ),
  );
  target
    .querySelector("[data-temperature-cancel]")
    ?.addEventListener("click", () => populate(null, "add"));
  target.querySelectorAll("[data-temperature-delete]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.closest("[data-room-id]").dataset.roomId;
    await store.updateItem("rooms", id, { temp: "", hum: "" });
  }));
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editingId || selectedRoomId;
    const temp = target.querySelector("#ed-pl-temp").value.trim();
    if (!id || !temp.includes(".")) return globalThis.alert?.(t("required"));
    await store.updateItem("rooms", id, { icon: target.querySelector("#dm-temperature-icon").value.trim() || "🌡️", temp, hum: target.querySelector("#dm-humidity-new").value.trim() });
  });
  target.querySelector("[data-temperature-go-rooms]")?.addEventListener("click", () => globalThis.editorSwitch?.("stanze"));
}

export function mountEntityPickers(target) {
  if (!target?.querySelectorAll) return;

  const lightAddEntityIds = /^(?:luce|light)-add-ent$/;
  const explicitLegacyIds = /^(?:ed-(?:pl-(?:temp|ph|cl|pump|heat|light)|irr-(?:ent|rain|weather)|tp-ent|luce-ent|cam-ent)|(?:luce|light)-add-ent|appl-ent-new|ed-avv-ent)$/;
  const inputs = new Set(target.querySelectorAll(
    "[data-entity-input], [data-entity-field] input, input.ed-slot-in[data-ref], input[data-domain]",
  ));

  target.querySelectorAll("input").forEach((input) => {
    const next = input.nextElementSibling;
    if (explicitLegacyIds.test(input.id) || next?.matches?.(".dm-entity-picker, button[onclick*='wzPickEntity']")) {
      inputs.add(input);
    }
  });

  inputs.forEach((input) => {
    input.dataset.entityInput = "true";
    if (!input.id) input.id = `dm-entity-${[...target.querySelectorAll("input")].indexOf(input)}`;
    if (lightAddEntityIds.test(input.id)) {
      input.dataset.lightAddEntity = "";
    }
    let button = input.parentElement?.querySelector?.(`.dm-entity-picker[data-entity-target="${CSS.escape(input.id)}"]`);
    const adjacent = input.nextElementSibling;
    if (!button && adjacent?.matches?.(".dm-entity-picker, button[onclick*='wzPickEntity']")) {
      button = adjacent;
      button.classList.add("dm-entity-picker");
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "dm-entity-picker";
      button.textContent = "🔍";
      input.insertAdjacentElement("afterend", button);
    }
    button.dataset.entityTarget = input.id;
    button.setAttribute("aria-label", `${t("select")} entity_id`);
    button.onclick = null;
    if (button.dataset.pickerMounted !== "true") {
      button.dataset.pickerMounted = "true";
      button.addEventListener("click", () => globalThis.wzPickEntity?.(input));
    }
  });

  target.querySelectorAll(".dm-icon-picker[data-icon-target]").forEach((button) => {
    if (button.dataset.pickerMounted === "true") return;
    button.dataset.pickerMounted = "true";
    button.addEventListener("click", () => globalThis.dmIconPicker?.(`#${button.dataset.iconTarget}`));
  });
}


export function renderReportRow(item, index) {
  const fieldToken = String(item.id || index).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `<div class="ed-row dm-report-row" data-report-id="${esc(item.id)}" data-section="${esc(item.section || "loads")}">
    <label><input type="checkbox" data-report-toggle ${item.show_in_report !== false ? "checked" : ""}> Report</label>
    <input class="ed-input" data-report-label placeholder="${t("reportLabel")}" value="${esc(item.report_label || item.name)}">
    ${createIconField(`dm-report-icon-${fieldToken}`, item.report_icon || item.emoji_icon || item.icon)}
    ${createEntityField({ id: `dm-report-entity-${fieldToken}`, label: t("reportEntity"), value: item.report_entity || item.monthly_energy_entity || item.total_energy_entity, optional: false })}
    ${item.category === "manual-report" ? createEntityField({ id: `dm-report-history-${fieldToken}`, label: t("history"), value: item.history_entity }) : ""}
    <span><button type="button" data-report-up aria-label="${t("moveUp")}">▲</button><button type="button" data-report-down aria-label="${t("moveDown")}">▼</button>${item.category === "manual-report" ? `<button type="button" data-report-delete aria-label="${t("remove")}">🗑️</button>` : ""}</span>
    <input type="hidden" data-report-name value="${esc(item.name)}"><input type="hidden" data-report-category value="${esc(item.category)}">
  </div>`;
}

function renderReportEditor(target) {
  const items = [...store.getSection("appliances"), ...store.getSection("loads")]
    .filter((item) => item.category !== "manual-report" || item.show_in_dashboard === false)
    .sort((a, b) => (a.report_order ?? a.order ?? 0) - (b.report_order ?? b.order ?? 0));
  target.innerHTML = `<div class="ed-intro">${t("reportIntro")}</div><div class="ed-list" data-report-list>${items.map(renderReportRow).join("") || `<div class="ed-empty">${t("empty")}</div>`}</div>
    <button type="button" class="ed-btn-add" data-report-add>＋ ${t("addManual")}</button>
    <div class="ed-form" data-report-manual hidden><input class="ed-input" data-manual-name placeholder="${t("name")}">${createIconField("dm-manual-report-icon")}${createEntityField({ id: "dm-manual-report-entity", label: t("entity"), optional: false })}${createEntityField({ id: "dm-manual-report-history", label: t("history") })}<button type="button" class="ed-btn-add" data-manual-confirm>${t("add")}</button></div>
    <div class="ed-action-bar" data-report-actions data-state="clean"><button type="button" class="ed-save-btn" data-report-save disabled>💾 ${t("saveReport")}</button><output data-report-status>${t("saved")}</output></div>`;
}

function mountReportRowControls(row, list, dirty) {
  mountEntityPickers(row);
  row.querySelector("[data-report-up]")?.addEventListener("click", () => {
    const sibling = row.previousElementSibling;
    if (sibling?.matches?.("[data-report-id]")) list.insertBefore(row, sibling);
    dirty();
  });
  row.querySelector("[data-report-down]")?.addEventListener("click", () => {
    const sibling = row.nextElementSibling;
    if (sibling?.matches?.("[data-report-id]")) list.insertBefore(sibling, row);
    dirty();
  });
  row.querySelector("[data-report-delete]")?.addEventListener("click", () => {
    row.remove();
    dirty();
  });
}

function mountReportEditor(_tab, target) {
  const list = target.querySelector("[data-report-list]");
  const save = target.querySelector("[data-report-save]");
  const status = target.querySelector("[data-report-status]");
  const actions = target.querySelector("[data-report-actions]");
  const dirty = () => { actions.dataset.state = "dirty"; save.disabled = false; status.textContent = t("dirty"); };
  target.oninput = dirty;
  target.onchange = dirty;
  target.querySelectorAll("[data-report-id]").forEach((row) =>
    mountReportRowControls(row, list, dirty),
  );
  target.querySelector("[data-report-add]")?.addEventListener("click", () => { target.querySelector("[data-report-manual]").hidden = false; });
  target.querySelector("[data-manual-confirm]")?.addEventListener("click", () => {
    const name = target.querySelector("[data-manual-name]").value.trim();
    const entity = target.querySelector("#dm-manual-report-entity").value.trim();
    if (!name || !entity.includes(".")) return globalThis.alert?.(t("required"));
    const id = `load-manual-${Date.now().toString(36)}`;
    const wrapper = globalThis.document.createElement("div");
    wrapper.innerHTML = renderReportRow({ id, section: "loads", category: "manual-report", name, report_entity: entity, history_entity: target.querySelector("#dm-manual-report-history").value.trim(), report_icon: target.querySelector("#dm-manual-report-icon").value.trim(), show_in_dashboard: false }, list.querySelectorAll("[data-report-id]").length);
    const added = wrapper.firstElementChild;
    list.querySelector(".ed-empty")?.remove();
    list.append(added);
    mountReportRowControls(added, list, dirty);
    dirty();
  });
  save?.addEventListener("click", async () => {
    const before = store.getState(); actions.dataset.state = "loading"; save.disabled = true; status.textContent = t("saving");
    const draft = [...list.querySelectorAll("[data-report-id]")].map((rowElement, report_order) => ({
      id: rowElement.dataset.reportId, section: rowElement.dataset.section, category: rowElement.querySelector("[data-report-category]").value,
      name: rowElement.querySelector("[data-report-name]").value, show_in_report: rowElement.querySelector("[data-report-toggle]").checked,
      report_label: rowElement.querySelector("[data-report-label]").value.trim(), report_icon: rowElement.querySelector("[data-icon-field] input").value.trim(),
      report_entity: rowElement.querySelectorAll("[data-entity-field] input")[0]?.value || "",
      history_entity: rowElement.querySelectorAll("[data-entity-field] input")[1]?.value || "", report_order,
    }));
    try { await store.saveReport(draft); const currentActions = target.querySelector("[data-report-actions]"); currentActions.dataset.state = "success"; target.querySelector("[data-report-status]").textContent = t("saved"); }
    catch (error) { globalThis.console?.error?.("[Report] rollback", error, before); renderReportEditor(target); mountReportEditor("report", target); const rolled = target.querySelector("[data-report-actions]"); rolled.dataset.state = "error"; target.querySelector("[data-report-status]").textContent = `Error: ${error.message}`; }
  });
  mountEntityPickers(target);
  const entityInputs = target.querySelectorAll("[data-entity-field] input").length;
  const pickers = target.querySelectorAll("[data-entity-field] .dm-entity-picker").length;
  if (entityInputs !== pickers) throw new Error(`Entity picker invariant failed: ${entityInputs} inputs / ${pickers} pickers`);
}

function renderDiagnostics(target) {
  const rows = {
    "Integration version": BUILD_INFO.integrationVersion,
    "Dashboard version": globalThis.DASHBOARD_VERSION || BUILD_INFO.dashboardVersion,
    "Module version": MODULES_VERSION, "Schema version": store.getState().schema_version,
    "HTML URL": globalThis.location?.href || "", "modules-entry.js URL": import.meta.url,
    "Static asset hash": location.pathname.match(/dashboardmodern_static\/([^/]+)/)?.[1] || BUILD_INFO.assetHash, [t("languageVariant")]: `${document.documentElement.lang || "?"} / ${location.pathname.split("/").pop()}`,
    [t("activeRenderer")]: document.querySelector(".ed-tab.active")?.dataset?.tab || "diagnostics",
    "Git commit": BUILD_INFO.commit, "Build date": BUILD_INFO.date,
  };
  target.innerHTML = `<div class="ed-sec-title">🩺 ${t("diagnostics")}</div><div class="ed-list">${Object.entries(rows).map(([key, value]) => `<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">${esc(key)}</div><div class="ed-row-old mono">${esc(value)}</div></div></div>`).join("")}</div>`;
  target.dataset.runtimeDiagnostics = "true";
}

export const EDITOR_TAB_ALIASES = Object.freeze({
  sez0: "home", sez1: "energy", sez2: "ev", sez3: "solar", sez4: "security",
  sez6: "server", sez7: "temperature", sez8: "actions", sez9: "climate",
  load: "loads", runtime: "diagnostics",
});
export const resolveEditorTab = (tab) => EDITOR_TAB_ALIASES[tab] || tab;

export const EDITOR_REGISTRY = Object.freeze({
  energy: { render: renderEnergyEditorTab, mount: mountCurrentEditor, visibilityKey: "energy" },
  loads: { render: mountLoadsEditor, mount: mountCurrentEditor, visibilityKey: "energy" },
  report: { render: renderReportEditor, mount: mountReportEditor, visibilityKey: "energy" },
  temperature: { render: renderTemperatureEditor, mount: mountTemperatureEditor, visibilityKey: "temp" },
  diagnostics: { render: renderDiagnostics, mount: mountCurrentEditor, visibilityKey: null },
});

export function dispatchEditorTab(tab, target, registry = EDITOR_REGISTRY) {
  const resolved = resolveEditorTab(tab);
  const descriptor = registry[resolved];
  if (!descriptor || !target) return false;
  globalThis.document?.querySelectorAll?.(".ed-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  descriptor.render(target);
  descriptor.mount?.(resolved, target);
  target.dataset.renderer = resolved;
  return true;
}

export function renderEditorTab(tab, target = globalThis.document?.getElementById?.("ed-body")) {
  return dispatchEditorTab(tab, target);
}

export function registerEditorTabs(root = globalThis.document) {
  const tabs = root?.querySelector?.(".ed-tabs");
  if (!tabs || tabs.querySelector('[data-tab="runtime"]')) return;
  const button = root.createElement("button"); button.type = "button"; button.className = "ed-tab";
  button.dataset.tab = "runtime"; button.textContent = "🩺 Runtime";
  button.addEventListener("click", () => renderEditorTab("runtime")); tabs.append(button);
}

export function mountCurrentEditor(section, target = globalThis.document?.getElementById?.("ed-body")) {
  if (!target) return;
  mountEntityPickers(target);
  globalThis.cdFillRoomSelects?.();
  target.querySelectorAll?.("details.ed-acc").forEach((details) => details.dataset.editorMounted = "true");
  target.dataset.mountedSection = section || "";
}
function mountLoadsEditor(target, editId = "") {
  const loads = store.getSection("loads");
  const appliances = store.getSection("appliances");
  const current = loads.find((item) => item.id === editId) || {};
  const cards = (items, readOnly = false) => items.map((item) => `<div class="ed-row" data-load-id="${esc(item.id)}"><div class="ed-row-main"><div class="ed-row-new">${esc(item.emoji_icon || item.icon || "🔌")} ${esc(item.name || t("newLoad"))}</div><div class="ed-row-old">${esc(item.category || "secondary")}</div></div>${readOnly ? "" : `<button class="ed-del" data-edit-load="${esc(item.id)}" title="${t("editLoad")}">✏️</button><button class="ed-del" data-delete-load="${esc(item.id)}" title="${t("remove")}">🗑️</button>`}</div>`).join("") || `<div class="ed-empty">${t("noLoads")}</div>`;
  target.innerHTML = `<div class="ed-intro">${t("loadsIntro")}</div><details class="ed-acc" open><summary class="ed-acc-head">A. ${t("appliances")} <span class="ed-acc-n">${appliances.length}</span></summary><div class="ed-acc-body">${cards(appliances, true)}</div></details>
    <details class="ed-acc" open><summary class="ed-acc-head">B. ${t("secondaryLoads")} <span class="ed-acc-n">${loads.filter((x) => x.category !== "manual-report").length}</span></summary><div class="ed-acc-body">${cards(loads.filter((x) => x.category !== "manual-report"))}</div></details>
    <div class="ed-form" data-load-form><div class="ed-sec-title">${editId ? t("editLoad") : t("newLoad")}</div><div class="ed-form-row"><input id="dm-load-name" class="ed-input" placeholder="${t("name")}" value="${esc(current.name)}"><input id="dm-load-icon" class="ed-input ed-icon-input" placeholder="🔌 / mdi:power-plug" value="${esc(current.emoji_icon || current.icon)}"></div><div class="ed-form-row"><select id="dm-load-room" class="ed-input">${globalThis.cdRoomOptions?.(current.room_id) || ""}</select></div>${entityField("dm-load-power", t("powerEntity"), current.power_entity, "sensor.load_power")}${entityField("dm-load-day", t("dailyEnergy"), current.daily_energy_entity)}${entityField("dm-load-month", t("monthlyEnergy"), current.monthly_energy_entity)}${entityField("dm-load-total", t("totalEnergy"), current.total_energy_entity)}${entityField("dm-load-history", t("history"), current.history_entity)}${entityField("dm-load-state", t("state"), current.state_entity)}${entityField("dm-load-control", t("control"), current.control_entity, "switch.load")}<label class="ed-intro"><input id="dm-load-report" type="checkbox" ${current.show_in_report !== false ? "checked" : ""}> ${t("visibleReport")}</label><label class="ed-intro"><input id="dm-load-dashboard" type="checkbox" ${current.show_in_dashboard !== false ? "checked" : ""}> ${t("visibleDashboard")}</label><button class="ed-btn-add" data-save-load>💾 ${editId ? t("saveChanges") : t("addLoad")}</button></div>`;
  target.querySelectorAll?.("[data-edit-load]").forEach((button) => button.addEventListener("click", () => mountLoadsEditor(target, button.dataset.editLoad)));
  target.querySelectorAll?.("[data-delete-load]").forEach((button) => button.addEventListener("click", async () => { try { await store.removeItem("loads", button.dataset.deleteLoad); } catch (error) { globalThis.alert?.(error.message); } }));
  target.querySelector?.("[data-save-load]")?.addEventListener("click", async () => {
    const value = (id) => target.querySelector(`#${id}`)?.value?.trim() || "";
    const item = { name: value("dm-load-name"), icon: value("dm-load-icon"), category: current.category && current.category !== "manual-report" ? current.category : "secondary", room_id: value("dm-load-room"), power_entity: value("dm-load-power"), daily_energy_entity: value("dm-load-day"), monthly_energy_entity: value("dm-load-month"), total_energy_entity: value("dm-load-total"), history_entity: value("dm-load-history"), state_entity: value("dm-load-state"), control_entity: value("dm-load-control"), show_in_report: !!target.querySelector("#dm-load-report")?.checked, show_in_dashboard: !!target.querySelector("#dm-load-dashboard")?.checked, order: current.order ?? loads.length };
    if (!item.name) return globalThis.alert?.(t("loadNameRequired"));
    try { await (editId ? store.updateItem("loads", editId, item) : store.addItem("loads", item)); }
    catch (error) { globalThis.alert?.(error.message); }
  });
}

const DashboardModernModules = Object.freeze({
  version: MODULES_VERSION,
  data: Object.freeze({
    canonicalReportDevices,
    getDeviceDisplayName,
    getDeviceVisual,
    normalizeDevice,
    stableRoomId,
    normalizeRooms,
    isConfiguredRoom,
    applianceRoomId,
    applianceGroups,
    applianceEnergyReport,
    applianceMedia,
    applianceName,
    applianceState,
    controllableEntity,
    normalizeCamera,
    normalizeCameras,
    saveCamera,
    removeCamera,
  }),
  store,
  EDITOR_REGISTRY,
  renderEditorTab,
  dispatchEditorTab,
  resolveEditorTab,
  registerEditorTabs,
  hydrateCanonicalRuntime,
  diagnostics: Object.freeze({ BUILD_INFO, MODULES_VERSION, SCHEMA_VERSION, htmlUrl: globalThis.location?.href, modulesUrl: import.meta.url }),
  render: Object.freeze({ createEnergyReportRows, createRenderCoordinator, createEntityField, loadPopupMetrics, mountCurrentEditor, mountEntityPickers, mountLoadsEditor, mountReportEditor, renderEnergyEditorTab, renderReportEditor, renderDeviceCard, renderEnergyEditor }),
});

globalThis.DashboardModernModules = DashboardModernModules;

let canonicalRuntimeHydrated = false;
export function hydrateCanonicalRuntime() {
  if (canonicalRuntimeHydrated) return false;
  if (!globalThis.__DASHBOARDMODERN_LEGACY_READY__ || globalThis.document?.readyState === "loading") {
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", hydrateCanonicalRuntime, {
      once: true,
    });
    return false;
  }
  canonicalRuntimeHydrated = true;
  applyRuntimeProjection();
  globalThis.cdRebuildReportDevices?.();
  globalThis.buildReportSelect?.();
  globalThis.cdApplyNavVis?.();
  globalThis.renderAppliances?.();
  globalThis.renderApplianceSection?.(true);
  globalThis.buildDeviceCards?.();
  globalThis.render?.();
  return true;
}

hydrateCanonicalRuntime();
export default DashboardModernModules;
