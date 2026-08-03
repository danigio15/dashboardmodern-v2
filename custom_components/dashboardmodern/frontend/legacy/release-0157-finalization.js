/* DashboardModern 0.14.17 final guard: correct selectors, total meters and bounded retries. */
const FINAL_KEY_0157 = "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__";
const PERIOD_ATTR_0157 = "data-dm-period-loading-0157";
const ROOM_ATTR_0157 = "data-dm-appliance-room-0157";
const LEGACY_PERIOD_ATTR_0157 = "data-dm-period-loading0157";
const LEGACY_ROOM_ATTR_0157 = "data-dm-appliance-room0157";
const TOTAL_FIELDS_0157 = [
  ["house", "total_energy", "Energia totale casa", "Total home energy", "sensor.casa_energia_totale"],
  ["grid", "total_import_energy", "Energia totale prelevata", "Total imported energy", "sensor.rete_prelievo_totale"],
  ["grid", "total_export_energy", "Energia totale immessa", "Total exported energy", "sensor.rete_immissione_totale"],
  ["solar", "total_energy", "Energia totale fotovoltaico", "Total solar energy", "sensor.fv_energia_totale"],
  ["battery", "total_charged_energy", "Energia totale caricata", "Total charged energy", "sensor.batteria_caricata_totale"],
  ["battery", "total_discharged_energy", "Energia totale scaricata", "Total discharged energy", "sensor.batteria_scaricata_totale"],
];

function finalState0157() {
  return (globalThis.__DASHBOARDMODERN_RELEASE_0157_FINAL__ ||= {
    retry: 0,
    editorId: "",
    pendingEnergy: {},
    storeWrapped: false,
    applianceWrapped: false,
    runtimeWrapped: false,
    repaired: false,
  });
}

const english0157 = () => document.documentElement.lang === "en";
const text0157 = (it, en) => (english0157() ? en : it);
const clean0157 = (value) => String(value || "").trim();
const escape0157 = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/"/g, "&quot;");

function normalizeSelectors0157() {
  document.querySelectorAll(`[${LEGACY_PERIOD_ATTR_0157}]`).forEach((node) => {
    node.setAttribute(PERIOD_ATTR_0157, "");
  });
  document.querySelectorAll(`[${LEGACY_ROOM_ATTR_0157}]`).forEach((node) => {
    node.setAttribute(ROOM_ATTR_0157, node.getAttribute(LEGACY_ROOM_ATTR_0157) || "");
  });
}

function stopChurn0157() {
  const runtime = globalThis[FINAL_KEY_0157];
  if (!runtime) return false;
  if (runtime.wrapperTimer) {
    clearInterval(runtime.wrapperTimer);
    clearTimeout(runtime.wrapperTimer);
    runtime.wrapperTimer = 0;
  }
  runtime.pageObserver?.disconnect?.();
  runtime.pageObserver = null;
  return true;
}

function wrapRuntime0157() {
  const state = finalState0157();
  const runtime = globalThis[FINAL_KEY_0157];
  if (!runtime?.installed) return false;
  if (!state.runtimeWrapped) {
    const decorate = runtime.decorateAppliances;
    if (typeof decorate === "function") {
      runtime.decorateAppliances = function decorateAppliancesFinal0157() {
        const result = decorate.apply(this, arguments);
        normalizeSelectors0157();
        return result;
      };
    }
    const temperature = runtime.decorateTemperatures;
    if (typeof temperature === "function") {
      runtime.decorateTemperatures = function decorateTemperaturesFinal0157() {
        const result = temperature.apply(this, arguments);
        normalizeSelectors0157();
        return result;
      };
    }
    state.runtimeWrapped = true;
  }
  stopChurn0157();
  runtime.decorateAppliances?.();
  runtime.decorateTemperatures?.();
  normalizeSelectors0157();
  return true;
}

function chainHas0157(fn, marker) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current[marker]) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function applianceField0157(value) {
  const label = text0157("Sensore energia totale", "Total energy sensor");
  return `<label class="ed-slot dm-entity-field dm-config-field dm-total-energy-field-0157" data-entity-field><span class="ed-slot-lbl">${label}</span><span class="ed-form-row"><input id="appl-total-energy-entity" class="ed-input mono" data-entity-input value="${escape0157(value)}" placeholder="sensor.forno_energia_totale"><button type="button" class="dm-entity-picker" data-entity-target="appl-total-energy-entity" aria-label="${label}">🔍</button></span></label>`;
}

function installApplianceEditor0157() {
  const state = finalState0157();
  if (state.applianceWrapped) return true;
  const renderer = globalThis.editorRenderAppliances;
  const save = globalThis.edApplSave;
  const edit = globalThis.edApplEdit;
  const cancel = globalThis.edApplCancel;
  if (![renderer, save, edit, cancel].every((fn) => typeof fn === "function")) return false;

  if (!chainHas0157(edit, "__dm0157TotalEdit")) {
    function editFinal0157(index) {
      state.editorId = clean0157((globalThis.getAppliances?.() || [])[Number(index)]?.id);
      return edit.apply(this, arguments);
    }
    editFinal0157.__dm0157TotalEdit = true;
    editFinal0157.__dmPrevious = edit;
    globalThis.edApplEdit = editFinal0157;
  }
  if (!chainHas0157(cancel, "__dm0157TotalCancel")) {
    function cancelFinal0157() {
      state.editorId = "";
      return cancel.apply(this, arguments);
    }
    cancelFinal0157.__dm0157TotalCancel = true;
    cancelFinal0157.__dmPrevious = cancel;
    globalThis.edApplCancel = cancelFinal0157;
  }
  if (!chainHas0157(renderer, "__dm0157TotalRenderer")) {
    function rendererFinal0157() {
      const template = document.createElement("template");
      template.innerHTML = renderer.apply(this, arguments);
      const form = [...template.content.querySelectorAll(".ed-form")].at(-1);
      if (!form || form.querySelector("#appl-total-energy-entity")) return template.innerHTML;
      const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances") || [];
      const item = items.find((entry) => clean0157(entry.id) === state.editorId) || {};
      const canonical = form.querySelector("[data-appliance-canonical-fields]");
      const holder = canonical?.querySelector(".dm-config-grid") || canonical || form;
      holder.insertAdjacentHTML("beforeend", applianceField0157(item.total_energy_entity || ""));
      return template.innerHTML;
    }
    rendererFinal0157.__dm0157TotalRenderer = true;
    rendererFinal0157.__dmPrevious = renderer;
    globalThis.editorRenderAppliances = rendererFinal0157;
  }
  if (!chainHas0157(save, "__dm0157TotalSave")) {
    async function saveFinal0157() {
      const total = clean0157(document.getElementById("appl-total-energy-entity")?.value);
      const name = clean0157(document.getElementById("appl-name")?.value);
      const editId = state.editorId;
      const result = await save.apply(this, arguments);
      const store = globalThis.DashboardModernModules?.store;
      if (!store?.getSection || !store?.updateItem) return result;
      const items = store.getSection("appliances") || [];
      const item = items.find((entry) => clean0157(entry.id) === editId) ||
        [...items].reverse().find((entry) => !name || clean0157(entry.name) === name);
      if (!item) return result;
      await store.updateItem("appliances", item.id, {
        total_energy_entity: total,
        report_entity: total || item.report_entity || item.energy_entity || "",
        history_entity: total || item.history_entity || item.report_entity || item.energy_entity || "",
        entities: [...new Set([...(item.entities || []), total].filter(Boolean))],
      });
      state.editorId = "";
      globalThis.cdRebuildReportDevices?.();
      globalThis.buildReportSelect?.();
      return result;
    }
    saveFinal0157.__dm0157TotalSave = true;
    saveFinal0157.__dmPrevious = save;
    globalThis.edApplSave = saveFinal0157;
  }
  state.applianceWrapped = true;
  return true;
}

function installEnergyStore0157() {
  const state = finalState0157();
  const store = globalThis.DashboardModernModules?.store;
  const original = store?.replaceSection;
  if (state.storeWrapped) return true;
  if (typeof original !== "function") return false;
  async function replaceSectionFinal0157(section, value) {
    if (section !== "energy") return original.apply(this, arguments);
    const merged = structuredClone(value || {});
    Object.entries(state.pendingEnergy).forEach(([path, entity]) => {
      const [group, key] = path.split(".");
      merged[group] ||= {};
      merged[group][key] = clean0157(entity);
    });
    return original.call(this, section, merged);
  }
  replaceSectionFinal0157.__dm0157TotalMerge = true;
  replaceSectionFinal0157.__dmPrevious = original;
  store.replaceSection = replaceSectionFinal0157;
  state.storeWrapped = true;
  return true;
}

function decorateEnergyEditor0157() {
  const root = document.querySelector('[data-editor="energy"]');
  if (!root) return false;
  installEnergyStore0157();
  const model = globalThis.DashboardModernModules?.store?.getSection?.("energy") || {};
  TOTAL_FIELDS_0157.forEach(([group, key, it, en, placeholder]) => {
    const id = `dm-energy-${group}-${key}`;
    if (root.querySelector(`#${id}`)) return;
    const anchor = root.querySelector(`[name="${group}.power"], [name^="${group}."]`);
    const body = anchor?.closest(".ed-acc-body");
    if (!body) return;
    const field = document.createElement("label");
    field.className = "ed-slot dm-total-energy-field-0157";
    field.innerHTML = `<span class="ed-slot-lbl">${english0157() ? en : it} <span class="ed-acc-n">kWh</span> <span class="ed-acc-n">${text0157("Facoltativo", "Optional")}</span></span><span class="ed-hint">${text0157("Contatore cumulativo Home Assistant", "Home Assistant cumulative meter")}</span><span class="dm-entity-field" data-entity-field><span class="ed-form-row"><input id="${id}" name="${group}.${key}" class="ed-input ed-slot-in mono" data-entity-input value="${escape0157(model?.[group]?.[key] || "")}" placeholder="${placeholder}"><button type="button" class="dm-entity-picker" data-entity-target="${id}" aria-label="${english0157() ? en : it}">🔍</button></span></span>`;
    const input = field.querySelector("input");
    const remember = () => { state.pendingEnergy[`${group}.${key}`] = input.value; };
    input.addEventListener("input", remember);
    input.addEventListener("change", remember);
    body.append(field);
  });
  globalThis.DashboardModernModules?.render?.mountEntityPickers?.(root);
  return true;
}

async function repairHistoricalSources0157() {
  const state = finalState0157();
  if (state.repaired) return true;
  const store = globalThis.DashboardModernModules?.store;
  if (!store?.getSection || !store?.replaceSection) return false;
  const items = store.getSection("appliances") || [];
  const repaired = items.map((item) => {
    const total = clean0157(item.total_energy_entity);
    if (!total || (item.report_entity === total && item.history_entity === total)) return item;
    return {
      ...item,
      report_entity: total,
      history_entity: total,
      entities: [...new Set([...(item.entities || []), total])],
    };
  });
  state.repaired = true;
  if (repaired.some((item, index) => item !== items[index])) await store.replaceSection("appliances", repaired);
  return true;
}

function injectStyle0157() {
  if (document.getElementById("dm-release-0157-final-style")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0157-final-style";
  style.textContent = `
    #page-appliances-main .dm-appliance-metrics-0157{width:auto!important;display:inline-flex!important;align-items:center!important;gap:4px!important;flex-wrap:wrap!important;margin:0!important}
    #page-appliances-main .dm-appliance-metric-0157{display:inline-flex!important;align-items:baseline!important;gap:4px!important;padding:3px 6px!important;border-radius:8px!important;line-height:1.05!important}
    #page-appliances-main .dm-appliance-metric-0157 small{font-size:7.5px!important;line-height:1!important}
    #page-appliances-main .dm-appliance-metric-0157 strong{font-size:10.5px!important;line-height:1!important}
    #page-appliances-main .dm-appliance-room-nav-0157 button{min-height:36px!important;padding:7px 10px!important}
    .dm-total-energy-field-0157{border-color:rgba(16,185,129,.28)!important;background:rgba(236,253,245,.46)!important}
  `;
  document.head.append(style);
}

function settle0157() {
  normalizeSelectors0157();
  stopChurn0157();
  const runtimeReady = wrapRuntime0157();
  const editorReady = installApplianceEditor0157();
  const storeReady = installEnergyStore0157();
  decorateEnergyEditor0157();
  repairHistoricalSources0157().catch((error) => console.warn("[DashboardModern] total energy repair", error));
  return runtimeReady && editorReady && storeReady;
}

function retry0157(attempt = 0) {
  const state = finalState0157();
  if (settle0157() || attempt >= 12) return;
  clearTimeout(state.retry);
  state.retry = setTimeout(() => retry0157(attempt + 1), 75);
}

globalThis.__DASHBOARDMODERN_RELEASE_0157_FINALIZE__ = settle0157;

function install0157() {
  injectStyle0157();
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("#ed-sel-month,#ed-sel-year")) queueMicrotask(normalizeSelectors0157);
  }, true);
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.(".ed-tab,.ed-inner-tab")) queueMicrotask(decorateEnergyEditor0157);
  }, true);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => retry0157(0));
  globalThis.addEventListener?.("pageshow", () => retry0157(0));
  retry0157(0);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install0157, { once: true });
  else install0157();
}
