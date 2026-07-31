/* DashboardModern 0.14.10: cumulative Energy, report visuals and structural UI fixes. */
const RELEASE_0150_FLAG = "__DASHBOARDMODERN_RELEASE_0150__";

export const TOTAL_ENERGY_FIELDS = Object.freeze([
  {
    group: "house",
    key: "total_energy",
    labelIt: "Contatore totale consumo casa",
    labelEn: "Home total energy meter",
    example: "sensor.casa_energia_totale",
  },
  {
    group: "grid",
    key: "total_import_energy",
    labelIt: "Contatore totale energia prelevata",
    labelEn: "Grid total imported energy meter",
    example: "sensor.solarman_total_grid_energy",
  },
  {
    group: "grid",
    key: "total_export_energy",
    labelIt: "Contatore totale energia immessa",
    labelEn: "Grid total exported energy meter",
    example: "sensor.solarman_total_export_energy",
  },
  {
    group: "solar",
    key: "total_energy",
    labelIt: "Contatore totale produzione fotovoltaica",
    labelEn: "Solar total production meter",
    example: "sensor.solarman_total_pv_energy",
  },
  {
    group: "battery",
    key: "total_charged_energy",
    labelIt: "Contatore totale energia caricata",
    labelEn: "Battery total charged energy meter",
    example: "sensor.battery_total_charged_energy",
  },
  {
    group: "battery",
    key: "total_discharged_energy",
    labelIt: "Contatore totale energia scaricata",
    labelEn: "Battery total discharged energy meter",
    example: "sensor.battery_total_discharged_energy",
  },
]);

const MDI_GLYPHS = Object.freeze({
  "mdi:stove": "♨️",
  "mdi:fire": "🔥",
  "mdi:fridge-outline": "❄️",
  "mdi:fridge-bottom": "🧊",
  "mdi:snowflake": "❄️",
  "mdi:washing-machine": "🧺",
  "mdi:dishwasher": "🍽️",
  "mdi:tumble-dryer": "💨",
  "mdi:microwave": "〰️",
  "mdi:water-boiler": "🚿",
  "mdi:television": "📺",
  "mdi:air-conditioner": "❄️",
  "mdi:fan": "🌀",
  "mdi:robot-vacuum": "🤖",
  "mdi:vacuum": "🧹",
  "mdi:coffee-maker": "☕",
  "mdi:kettle": "🫖",
  "mdi:toaster": "🍞",
  "mdi:power-plug": "🔌",
  "mdi:flash": "⚡",
  "mdi:devices": "🔌",
});

export function mdiGlyph(icon) {
  const value = String(icon || "").trim().toLowerCase();
  if (!value.startsWith("mdi:")) return String(icon || "");
  if (MDI_GLYPHS[value]) return MDI_GLYPHS[value];
  if (/fridge|snow|ice/.test(value)) return "❄️";
  if (/stove|oven|fire/.test(value)) return "♨️";
  if (/washing|laundry/.test(value)) return "🧺";
  if (/dish/.test(value)) return "🍽️";
  if (/dryer|wind|fan/.test(value)) return "💨";
  if (/water|boiler|shower/.test(value)) return "🚿";
  if (/television|monitor/.test(value)) return "📺";
  if (/coffee/.test(value)) return "☕";
  if (/kettle/.test(value)) return "🫖";
  if (/toaster/.test(value)) return "🍞";
  return "⚡";
}

export function validateTotalEnergyEntity(entityId, states = globalThis.STATES || {}) {
  const id = String(entityId || "").trim();
  if (!id) return { valid: true, empty: true, reason: "" };
  const state = states?.[id];
  if (!state) return { valid: true, pending: true, reason: "metadata-unavailable" };
  const attributes = state.attributes || {};
  const unit = String(attributes.unit_of_measurement || "").toLowerCase().replace(/\s+/g, "");
  const deviceClass = String(attributes.device_class || "").toLowerCase();
  const stateClass = String(attributes.state_class || "").toLowerCase();
  const energy = /^(wh|kwh|mwh)$/.test(unit) || deviceClass === "energy";
  const cumulative = stateClass === "total" || stateClass === "total_increasing";
  if (!energy) return { valid: false, reason: "not-energy", unit, stateClass };
  if (!cumulative) return { valid: false, reason: "not-cumulative", unit, stateClass };
  return { valid: true, reason: "", unit, stateClass };
}

function isEnglish() {
  return document.documentElement.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function dataStore() {
  return globalThis.DashboardModernModules?.store;
}

function applianceItems() {
  const store = dataStore();
  return [
    ...(store?.getSection?.("appliances") || []),
    ...(store?.getSection?.("loads") || []),
  ];
}

function itemGlyph(item = {}) {
  const explicit = item.report_icon || item.emoji_icon || item.icon;
  if (String(explicit || "").startsWith("mdi:")) return mdiGlyph(explicit);
  if (explicit) return explicit;
  const token = String(
    item.visual_key || item.device_type || item.type || item.category || item.name || "",
  ).toLowerCase();
  if (/forno|oven|stove|piano/.test(token)) return "♨️";
  if (/frigo|fridge|refriger|freezer|congel/.test(token)) return "❄️";
  if (/lavatrice|washer|washing/.test(token)) return "🧺";
  if (/lavastoviglie|dishwasher/.test(token)) return "🍽️";
  if (/asciugatrice|dryer/.test(token)) return "💨";
  if (/microonde|microwave/.test(token)) return "〰️";
  if (/boiler|scaldabagno/.test(token)) return "🚿";
  if (/television|\btv\b/.test(token)) return "📺";
  if (/caffe|coffee/.test(token)) return "☕";
  return "⚡";
}

function reportItemMaps() {
  const items = applianceItems();
  return {
    byId: new Map(items.map((item) => [String(item.id || ""), item])),
    byName: new Map(items.map((item) => [String(item.name || "").trim().toLowerCase(), item])),
  };
}

function reportPreviewMarkup(item, size = 30) {
  const image = String(item?.image || item?.image_url || "").trim();
  if (image)
    return `<img src="${escapeHtml(image)}" alt="" style="width:${size}px;height:${size}px;object-fit:contain">`;
  try {
    const appliance = globalThis.cdApplianceVisual?.(item, size);
    if (appliance && !String(appliance).includes("<ha-icon")) return appliance;
  } catch (_error) {}
  return `<span class="dm-report-glyph" aria-hidden="true">${escapeHtml(itemGlyph(item))}</span>`;
}

function itemForReportRow(row, maps) {
  const byId = maps.byId.get(String(row.dataset.reportId || row.dataset.deviceId || ""));
  if (byId) return byId;
  const name =
    row.querySelector("[data-report-name]")?.value ||
    row.querySelector(".ed-row-name,.g-name,.appl-wide-name")?.textContent ||
    "";
  return maps.byName.get(String(name).trim().toLowerCase()) || null;
}

function decorateReportVisuals() {
  const maps = reportItemMaps();
  document.querySelectorAll("[data-report-id], [data-device-report]").forEach((row) => {
    const item = itemForReportRow(row, maps);
    if (!item) return;
    const glyph = itemGlyph(item);
    row.dataset.reportGlyph = glyph;
    let preview = row.querySelector(".dm-report-icon-preview");
    if (!preview) {
      preview = document.createElement("span");
      preview.className = "dm-report-icon-preview";
      row.prepend(preview);
    }
    const signature = `${item.id || ""}|${item.image || item.image_url || ""}|${item.visual_key || ""}|${item.icon || ""}`;
    if (preview.dataset.dmVisualSignature !== signature) {
      preview.innerHTML = reportPreviewMarkup(item, 30);
      preview.dataset.dmVisualSignature = signature;
      preview.setAttribute("aria-label", item.name || copy("Elettrodomestico", "Appliance"));
    }
  });

  document.querySelectorAll("select").forEach((select) => {
    if (!/ed-dev-selector|report|device/i.test(`${select.id} ${select.name} ${select.className}`)) return;
    for (const option of select.options || []) {
      if (!/mdi:[a-z0-9-]+/i.test(option.textContent || "")) continue;
      option.textContent = option.textContent.replace(/mdi:[a-z0-9-]+/gi, (icon) => mdiGlyph(icon));
    }
  });

  const scopes = [
    document.getElementById("page-energy"),
    document.getElementById("page-energia"),
    document.getElementById("ed-pane-analisi"),
    document.getElementById("dp-report"),
    document.getElementById("dp-reports"),
  ].filter(Boolean);
  for (const scope of scopes) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement?.tagName)) return;
      if (!/mdi:[a-z0-9-]+/i.test(node.nodeValue || "")) return;
      node.nodeValue = node.nodeValue.replace(/mdi:[a-z0-9-]+/gi, (icon) => mdiGlyph(icon));
    });
  }
}

function decorateApplianceTotals() {
  document.querySelectorAll(".appl-wide-card .appl-mini, [data-appliance-id] .appl-mini").forEach((node) => {
    const text = String(node.textContent || "").trim();
    if (!text.startsWith("🔋")) return;
    const value = text.replace(/^🔋\s*/, "");
    node.textContent = `${copy("∑ Totale", "∑ Total")} ${value}`.trim();
    node.dataset.metric = "total-energy";
    node.title = copy("Energia totale consumata", "Total energy consumed");
  });
}

function totalFieldStatus(input) {
  const result = validateTotalEnergyEntity(input.value, globalThis.STATES || {});
  input.dataset.validation = result.valid ? (result.pending ? "pending" : "valid") : "invalid";
  const output = input.closest(".ed-slot")?.querySelector("[data-total-validation]");
  if (!output) return result;
  if (result.empty) output.textContent = "";
  else if (result.pending)
    output.textContent = copy(
      "Entità non ancora disponibile: sarà verificata al prossimo aggiornamento.",
      "Entity metadata is not available yet; it will be checked on the next update.",
    );
  else if (result.reason === "not-energy")
    output.textContent = copy(
      "Serve un contatore energia in Wh/kWh, non un sensore di potenza W/kW.",
      "Use an energy meter in Wh/kWh, not a W/kW power sensor.",
    );
  else if (result.reason === "not-cumulative")
    output.textContent = copy(
      "L'entità deve avere state_class total_increasing oppure total.",
      "The entity must have state_class total_increasing or total.",
    );
  else
    output.textContent = copy(
      "Contatore cumulativo valido: giorno, mese e anno saranno calcolati dalle statistiche.",
      "Valid cumulative meter: day, month and year will be calculated from statistics.",
    );
  return result;
}

function markEnergyDirty(root) {
  if (!root) return;
  const actions = root.querySelector("[data-energy-actions]");
  const save = actions?.querySelector("[data-energy-save]");
  const status = actions?.querySelector("[data-energy-status]");
  if (actions) actions.dataset.state = "dirty";
  if (save) save.disabled = false;
  if (status) status.textContent = copy("Modifiche non salvate", "Unsaved changes");
}

function createTotalField(definition, value) {
  const field = document.createElement("label");
  field.className = "ed-slot dm-total-energy-field";
  field.dataset.energyTotalField = `${definition.group}.${definition.key}`;
  const label = isEnglish() ? definition.labelEn : definition.labelIt;
  field.innerHTML = `<span class="ed-slot-lbl">${escapeHtml(label)} <span class="ed-acc-n">kWh</span> <span class="ed-acc-n dm-total-recommended">${copy("Consigliato", "Recommended")}</span></span><span class="ed-hint">${copy("Contatore cumulativo Home Assistant. Il Report ricava automaticamente giorno, mesi e anni.", "Cumulative Home Assistant meter. The Report automatically derives days, months and years.")}</span>`;
  const row = document.createElement("span");
  row.className = "ed-form-row";
  const input = document.createElement("input");
  input.id = `dm-energy-${definition.group}-${definition.key}`;
  input.name = `${definition.group}.${definition.key}`;
  input.className = "ed-input ed-slot-in mono";
  input.dataset.entityInput = "true";
  input.value = value || "";
  input.placeholder = definition.example;
  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.dataset.entityTarget = input.id;
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `${copy("Seleziona", "Select")} ${label}`);
  picker.addEventListener("click", () => globalThis.wzPickEntity?.(input));
  row.append(input, picker);
  const validation = document.createElement("output");
  validation.className = "dm-total-validation";
  validation.dataset.totalValidation = "";
  field.append(row, validation);
  for (const eventName of ["input", "change"]) {
    input.addEventListener(eventName, () => {
      totalFieldStatus(input);
      markEnergyDirty(input.closest('[data-editor="energy"]'));
    });
  }
  totalFieldStatus(input);
  return field;
}

function energyGroupBlock(root, group) {
  return root.querySelector(`#dm-energy-${group}-power`)?.closest("details.ed-acc") || null;
}

function updateEnergyCount(block) {
  const counter = block?.querySelector("summary small");
  if (!counter) return;
  const inputs = [...block.querySelectorAll('input[name*="."]')];
  const configured = inputs.filter((input) => String(input.value || "").trim()).length;
  counter.textContent = `${configured}/${inputs.length} ${copy("configurati", "configured")}`;
}

function installEnergySave(root) {
  const save = root.querySelector("[data-energy-save]");
  if (!save || save.dataset.dmTotalSaveMounted === "true") return;
  save.dataset.dmTotalSaveMounted = "true";
  save.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const store = dataStore();
      if (!store?.getSection || !store?.replaceSection) return;
      const invalid = [...root.querySelectorAll("[data-energy-total-field] input")].filter(
        (input) => !totalFieldStatus(input).valid,
      );
      const actions = root.querySelector("[data-energy-actions]");
      if (!actions) return;
      const status = actions.querySelector("[data-energy-status]");
      if (invalid.length) {
        actions.dataset.state = "error";
        save.disabled = false;
        if (status)
          status.textContent = copy(
            "Correggi i contatori totali evidenziati.",
            "Fix the highlighted total meters.",
          );
        invalid[0].focus();
        return;
      }

      const model = store.getSection("energy") || {};
      root.querySelectorAll('input[name*="."]').forEach((input) => {
        const [group, key] = input.name.split(".");
        if (!group || !key) return;
        model[group] ||= {};
        model[group][key] = String(input.value || "").trim();
      });
      model.metadata = {
        ...(model.metadata || {}),
        semantics_version: 3,
        cumulative_statistics: true,
      };
      actions.dataset.state = "loading";
      save.disabled = true;
      if (status) status.textContent = copy("Salvataggio Energia…", "Saving Energy…");
      try {
        await store.replaceSection("energy", model);
        actions.dataset.state = "success";
        if (status)
          status.textContent = copy(
            "Energia salvata. I periodi saranno calcolati dalle statistiche di Home Assistant.",
            "Energy saved. Period totals will be calculated from Home Assistant statistics.",
          );
        globalThis.cdTotalsRun?.();
        Promise.resolve(globalThis.cdRefreshPeriodDeltas?.(true)).catch(() => {});
        globalThis.renderEnergyDashboard?.();
      } catch (error) {
        actions.dataset.state = "error";
        save.disabled = false;
        if (status)
          status.textContent = `${copy("Salvataggio fallito", "Save failed")}: ${error.message}`;
      }
    },
    true,
  );
}

function decorateEnergyEditor() {
  const root = document.querySelector('[data-editor="energy"]');
  if (!root) return;
  const model = dataStore()?.getSection?.("energy") || {};
  const flows = root.querySelector('[data-energy-panel="flows"]');
  if (flows && !flows.querySelector("[data-total-energy-intro]")) {
    const intro = document.createElement("aside");
    intro.className = "dm-total-energy-intro";
    intro.dataset.totalEnergyIntro = "";
    intro.innerHTML = `<strong>∑ ${copy("Contatori totali automatici", "Automatic total meters")}</strong><span>${copy("Inserisci il contatore cumulativo in kWh. I campi giornalieri, mensili e annuali restano disponibili soltanto come override opzionali.", "Enter the cumulative kWh meter. Daily, monthly and yearly fields remain available only as optional overrides.")}</span>`;
    flows.prepend(intro);
  }

  for (const definition of TOTAL_ENERGY_FIELDS) {
    if (root.querySelector(`[data-energy-total-field="${definition.group}.${definition.key}"]`))
      continue;
    const block = energyGroupBlock(root, definition.group);
    const body = block?.querySelector(".ed-acc-body");
    if (!body) continue;
    const field = createTotalField(definition, model[definition.group]?.[definition.key] || "");
    const totals = [...body.querySelectorAll("[data-energy-total-field]")];
    const lastTotal = totals.at(-1);
    if (lastTotal) lastTotal.after(field);
    else body.prepend(field);
    updateEnergyCount(block);
  }
  root.querySelectorAll("details.ed-acc").forEach(updateEnergyCount);
  installEnergySave(root);
}

function decorateEditorActions() {
  const root = document.getElementById("editor-modal") || document.getElementById("ed-body");
  if (!root) return;
  root.querySelectorAll("button").forEach((button) => {
    if (button.classList.contains("dm-entity-picker") || button.classList.contains("ed-head-close"))
      return;
    const text = String(button.textContent || "").trim().toLowerCase();
    if (/salva|save/.test(text)) {
      button.classList.add("dm-unified-action", "dm-unified-save");
      button.dataset.dmAction = "save";
    } else if (/aggiungi|\badd\b/.test(text)) {
      button.classList.add("dm-unified-action", "dm-unified-add");
      button.dataset.dmAction = "add";
    } else if (/annulla|cancel/.test(text)) {
      button.classList.add("dm-unified-action", "dm-unified-cancel");
      button.dataset.dmAction = "cancel";
    }
  });
}

function installStyles() {
  if (document.getElementById("dm-release-0150-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0150-styles";
  style.textContent = `
    .dm-total-energy-intro{display:grid;gap:5px;margin:0 0 14px;padding:14px 16px;border:1px solid rgba(14,165,233,.22);border-radius:18px;background:linear-gradient(135deg,rgba(224,242,254,.9),rgba(236,253,245,.92));color:#075985}
    .dm-total-energy-intro strong{font-size:14px;font-weight:950;letter-spacing:.02em}.dm-total-energy-intro span{font-size:12px;font-weight:700;line-height:1.45}
    .dm-total-energy-field{margin:0 0 12px!important;padding:14px!important;border:1px solid rgba(14,165,233,.2)!important;border-radius:16px!important;background:rgba(240,249,255,.72)!important}
    .dm-total-recommended{background:#dcfce7!important;color:#047857!important}.dm-total-validation{display:block;min-height:17px;margin-top:7px;font-size:11px;font-weight:800;color:#047857}
    .dm-total-energy-field input[data-validation="invalid"]{border-color:#ef4444!important;box-shadow:0 0 0 3px rgba(239,68,68,.12)!important}.dm-total-energy-field input[data-validation="invalid"]~*{}.dm-total-energy-field:has(input[data-validation="invalid"]) .dm-total-validation{color:#b91c1c}
    #temp-grid .temp-card,#temp-grid .temp-card.dm-temperature-card-0149{box-sizing:border-box!important;position:relative!important;display:grid!important;grid-template-columns:64px minmax(0,1fr)!important;grid-template-rows:auto!important;grid-template-areas:none!important;align-items:center!important;gap:16px!important;width:100%!important;min-width:0!important;min-height:126px!important;height:auto!important;padding:20px!important;overflow:hidden!important}
    #temp-grid .temp-card>.cp-icon,#temp-grid .temp-card>.dm-temperature-room-icon{position:static!important;inset:auto!important;grid-column:1!important;grid-row:1!important;align-self:center!important;justify-self:center!important;width:58px!important;height:58px!important;min-width:58px!important;margin:0!important;transform:none!important}
    #temp-grid .temp-card>.cp-info{position:static!important;inset:auto!important;grid-column:2!important;grid-row:1!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:10px!important;min-width:0!important;width:100%!important;margin:0!important;transform:none!important}
    #temp-grid .temp-card .cp-name{position:static!important;inset:auto!important;grid-area:auto!important;display:block!important;margin:0!important;max-width:100%!important;font-size:17px!important;line-height:1.15!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;transform:none!important}
    #temp-grid .temp-card .temp-values{position:static!important;inset:auto!important;grid-area:auto!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:end!important;gap:14px!important;width:100%!important;min-width:0!important;margin:0!important;transform:none!important}
    #temp-grid .temp-card .temp-main,#temp-grid .temp-card .temp-hum{position:static!important;inset:auto!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;min-width:0!important;margin:0!important;transform:none!important}
    #temp-grid .temp-card .temp-label{position:static!important;display:block!important;max-width:100%!important;margin:0 0 4px!important;font-size:9px!important;line-height:1.15!important;font-weight:900!important;letter-spacing:.08em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;transform:none!important}
    #temp-grid .temp-card .temp-number{position:static!important;display:block!important;margin:0!important;font-size:clamp(32px,4vw,46px)!important;line-height:.9!important;font-weight:950!important;white-space:nowrap!important;transform:none!important}
    #temp-grid .temp-card .temp-number small{font-size:.36em!important;margin-left:1px!important}
    .dm-report-icon-preview{overflow:hidden!important;font-size:24px!important}.dm-report-icon-preview svg,.dm-report-icon-preview img{display:block!important;max-width:30px!important;max-height:30px!important;width:30px!important;height:30px!important}.dm-report-glyph{font-size:25px;line-height:1}
    .appl-wide-card .appl-mini[data-metric="total-energy"]{display:inline-flex!important;align-items:center!important;gap:4px!important;color:var(--text-dim)!important}
    #editor-modal .dm-unified-action{min-height:46px!important;padding:11px 18px!important;border-radius:14px!important;border:0!important;font-weight:900!important;letter-spacing:.01em!important;box-shadow:0 8px 20px rgba(15,23,42,.1)!important;transition:transform .16s ease,filter .16s ease!important}
    #editor-modal .dm-unified-action:active{transform:translateY(1px)!important}#editor-modal .dm-unified-save{background:linear-gradient(135deg,#10b981,#059669)!important;color:#fff!important}#editor-modal .dm-unified-add{background:linear-gradient(135deg,#38bdf8,#0284c7)!important;color:#fff!important}#editor-modal .dm-unified-cancel{background:#e2e8f0!important;color:#334155!important}
    @media(max-width:820px){#temp-grid .temp-card,#temp-grid .temp-card.dm-temperature-card-0149{grid-template-columns:54px minmax(0,1fr)!important;gap:12px!important;min-height:112px!important;padding:16px!important}#temp-grid .temp-card>.cp-icon,#temp-grid .temp-card>.dm-temperature-room-icon{width:50px!important;height:50px!important;min-width:50px!important}#temp-grid .temp-card .temp-values{gap:9px!important}#temp-grid .temp-card .temp-number{font-size:clamp(30px,9vw,42px)!important}.dm-total-energy-field{padding:12px!important}}
    @media(max-width:420px){#temp-grid .temp-card,#temp-grid .temp-card.dm-temperature-card-0149{grid-template-columns:48px minmax(0,1fr)!important;gap:10px!important;padding:14px!important}#temp-grid .temp-card>.cp-icon,#temp-grid .temp-card>.dm-temperature-room-icon{width:44px!important;height:44px!important;min-width:44px!important}#temp-grid .temp-card .cp-name{font-size:15px!important}#temp-grid .temp-card .temp-label{font-size:8px!important}#temp-grid .temp-card .temp-number{font-size:31px!important}}
  `;
  document.head.append(style);
}

function decorateAll() {
  decorateEnergyEditor();
  decorateReportVisuals();
  decorateApplianceTotals();
  decorateEditorActions();
}

function install() {
  if (globalThis[RELEASE_0150_FLAG]?.installed) return;
  globalThis[RELEASE_0150_FLAG] = { installed: true };
  installStyles();
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorateAll);
  };
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-report-id"],
  });
  globalThis.addEventListener("dashboardmodern:legacy-ready", schedule);
  globalThis.addEventListener("resize", schedule, { passive: true });
  setInterval(decorateAll, 1500);
  schedule();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
