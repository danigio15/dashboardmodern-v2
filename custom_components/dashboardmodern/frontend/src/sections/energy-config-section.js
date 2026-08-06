import { clean, doc, english, installStyle, root, section, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_CONFIG_SECTION__";
const state = (root[KEY] ||= { installed: false, observer: null });

const GROUPS = Object.freeze([
  ["house", "🏠", "Consumi casa", "Home consumption", "total_energy"],
  ["solar", "☀️", "Produzione fotovoltaica", "Solar production", "total_energy"],
  ["grid", "🔌", "Energia prelevata dalla rete", "Grid imported energy", "total_import_energy"],
  ["gridExport", "↗️", "Energia immessa in rete", "Grid exported energy", "total_export_energy"],
  ["batteryCharge", "🔋", "Energia caricata in batteria", "Battery charged energy", "total_charged_energy"],
  ["batteryDischarge", "🔋", "Energia scaricata dalla batteria", "Battery discharged energy", "total_discharged_energy"],
]);

function energy() {
  return section("energy", {}) || {};
}

function groupData(name) {
  if (name === "gridExport") return energy().grid || {};
  if (name === "batteryCharge" || name === "batteryDischarge") return energy().battery || {};
  return energy()[name] || {};
}

function periodValue(group, period) {
  const data = groupData(group);
  const prefix = group === "grid" ? "import_" : group === "gridExport" ? "export_" : group === "batteryCharge" ? "charged_" : group === "batteryDischarge" ? "discharged_" : "";
  return clean(data[`${period}_${prefix}energy`] || data[`${period}_energy`]);
}

function totalValue(group, key) {
  return clean(groupData(group)[key]);
}

function row(group, icon, it, en, totalKey) {
  const total = totalValue(group, totalKey);
  const day = periodValue(group, "daily");
  const month = periodValue(group, "monthly");
  const year = periodValue(group, "annual");
  const label = english ? en : it;
  const source = total || t("Non configurato", "Not configured");
  return `<article class="dm-energy-config-card" data-energy-config-group="${group}">
    <header><span>${icon}</span><strong>${label}</strong></header>
    <p class="dm-energy-primary"><b>${t("Sensore principale consigliato", "Recommended primary sensor")}</b><code>${source}</code></p>
    <p>${t("Usa un contatore cumulativo in kWh con state_class total o total_increasing. Da questo sensore la dashboard ricava giorno, mese, anno, mesi precedenti e Report tramite le statistiche di Home Assistant.", "Use a cumulative kWh meter with state_class total or total_increasing. The dashboard derives day, month, year, previous months and Report from Home Assistant statistics.")}</p>
    <details><summary>${t("Sensori facoltativi del periodo", "Optional period sensors")}</summary>
      <dl><div><dt>${t("Oggi", "Today")}</dt><dd>${day || "—"}</dd></div><div><dt>${t("Mese corrente", "Current month")}</dt><dd>${month || "—"}</dd></div><div><dt>${t("Anno corrente", "Current year")}</dt><dd>${year || "—"}</dd></div></dl>
      <small>${t("Compilali soltanto se possiedi già utility_meter affidabili. Sostituiscono il calcolo del relativo periodo, ma non servono per i mesi precedenti.", "Fill these only when reliable utility_meter entities already exist. They override that period but are not used for previous months.")}</small>
    </details>
  </article>`;
}

function relabelFields(editor) {
  editor.querySelectorAll(".dm-energy-total-field,.dm-total-energy-field,[data-energy-total-field]").forEach((field) => {
    field.classList.add("dm-energy-primary-field");
    const label = field.querySelector(".ed-slot-lbl");
    if (label && !label.querySelector(".dm-energy-required-note")) {
      label.insertAdjacentHTML("beforeend", `<span class="dm-energy-required-note">${t("CONSIGLIATO · necessario per storico", "RECOMMENDED · required for history")}</span>`);
    }
    let help = field.querySelector(".dm-energy-total-purpose");
    if (!help) {
      help = doc.createElement("p");
      help.className = "dm-energy-total-purpose";
      field.append(help);
    }
    help.textContent = t("Contatore cumulativo kWh. Calcola correttamente anche mesi precedenti e Report. Non usare un sensore W/kW e non usare un sensore che si azzera ogni mese.", "Cumulative kWh meter. Correctly calculates previous months and Report. Do not use a W/kW sensor or one that resets monthly.");
  });
}

export function renderEnergyConfigGuide() {
  const editor = doc?.querySelector('#editor-modal [data-editor="energy"],#ed-body[data-editor="energy"]');
  if (!editor) return false;
  let guide = editor.querySelector(".dm-energy-config-guide");
  if (!guide) {
    guide = doc.createElement("section");
    guide.className = "dm-energy-config-guide";
    editor.prepend(guide);
  }
  guide.innerHTML = `<header><strong>⚡ ${t("Configurazione Energia", "Energy configuration")}</strong><p>${t("Per ogni flusso configura prima il sensore totale cumulativo. I sensori giornaliero, mensile e annuale sono solo facoltativi.", "For each flow configure the cumulative total sensor first. Daily, monthly and annual sensors are optional.")}</p></header><div class="dm-energy-config-grid">${GROUPS.map((item) => row(...item)).join("")}</div>`;
  relabelFields(editor);
  return true;
}

function installStyles() {
  installStyle("dm-energy-config-section-style", `
    #editor-modal .dm-energy-config-guide{display:grid!important;gap:14px!important;margin:0 0 18px!important;padding:16px!important;border:1px solid color-mix(in srgb,var(--info-color,#0284c7) 30%,var(--divider-color,#dbe4ee))!important;border-radius:18px!important;background:color-mix(in srgb,var(--info-color,#0284c7) 7%,var(--ha-card-background,#fff))!important}
    #editor-modal .dm-energy-config-guide>header{display:grid!important;gap:5px!important}#editor-modal .dm-energy-config-guide>header strong{font-size:18px!important}#editor-modal .dm-energy-config-guide>header p{margin:0!important;color:var(--secondary-text-color,#64748b)!important;line-height:1.45!important}
    #editor-modal .dm-energy-config-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}.dm-energy-config-card{display:grid!important;gap:8px!important;padding:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:15px!important;background:var(--ha-card-background,#fff)!important}.dm-energy-config-card header{display:flex!important;align-items:center!important;gap:8px!important}.dm-energy-config-card p{margin:0!important;font-size:12px!important;line-height:1.45!important}.dm-energy-config-card code{display:block!important;margin-top:5px!important;padding:7px 9px!important;border-radius:9px!important;background:var(--secondary-background-color,#f1f5f9)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-energy-config-card summary{cursor:pointer!important;font-weight:800!important}.dm-energy-config-card dl{display:grid!important;gap:6px!important;margin:9px 0!important}.dm-energy-config-card dl>div{display:grid!important;grid-template-columns:100px minmax(0,1fr)!important;gap:8px!important}.dm-energy-config-card dt{font-weight:800!important}.dm-energy-config-card dd{margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-family:monospace!important}
    #editor-modal .dm-energy-required-note{display:inline-flex!important;margin-left:7px!important;padding:3px 7px!important;border-radius:999px!important;background:color-mix(in srgb,var(--success-color,#10b981) 16%,transparent)!important;color:var(--success-color,#047857)!important;font-size:9px!important;font-weight:900!important}.dm-energy-total-purpose{margin:7px 0 0!important;color:var(--info-color,#0369a1)!important;font-size:11px!important;font-weight:800!important;line-height:1.4!important}
    @media(max-width:760px){#editor-modal .dm-energy-config-grid{grid-template-columns:1fr!important}.dm-energy-config-guide{padding:12px!important}}
  `);
}

export function installEnergyConfigSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  wrapFunction("editorSwitch", "__dmEnergyConfigSection", renderEnergyConfigGuide);
  root.addEventListener?.("dashboardmodern:legacy-ready", renderEnergyConfigGuide);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(".ed-tab,[data-energy-tab],.sub-tab-btn")) root.queueMicrotask?.(renderEnergyConfigGuide);
  }, true);
  renderEnergyConfigGuide();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installEnergyConfigSection, { once: true });
else installEnergyConfigSection();
